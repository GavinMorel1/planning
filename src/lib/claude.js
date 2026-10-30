// Claude integration. All calls go through the Cloudflare Worker (VITE_PROXY_URL), which holds
// the API key. For local development only, VITE_ANTHROPIC_KEY calls the API directly.
import { fileToBase64 } from './util'
import { supabase } from './supabase'

const PROXY = (import.meta.env.VITE_PROXY_URL || '').replace(/\/+$/, '')
const DIRECT_KEY = import.meta.env.VITE_ANTHROPIC_KEY || ''
export const CLAUDE_ENABLED = Boolean(PROXY || DIRECT_KEY)
export const MODEL = 'claude-opus-5'

async function messages(body) {
  if (!CLAUDE_ENABLED) throw new Error('Claude is not configured. Set VITE_PROXY_URL (see docs/SETUP.md).')
  const url = PROXY ? `${PROXY}/anthropic/v1/messages` : 'https://api.anthropic.com/v1/messages'
  const headers = { 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01', 'anthropic-beta': 'server-side-fallback-2026-07-01' }
  if (!PROXY) { headers['x-api-key'] = DIRECT_KEY; headers['anthropic-dangerous-direct-browser-access'] = 'true' }
  else if (supabase) {
    // The Worker only serves signed-in users: send the Supabase session token (never an API key).
    const { data } = await supabase.auth.getSession()
    const token = data?.session?.access_token
    if (!token) throw new Error('Sign in again to use Claude (no active session).')
    headers.Authorization = `Bearer ${token}`
  }
  const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ model: MODEL, fallbacks: 'default', ...body }) })
  if (r.status === 401) throw new Error('Claude is not available: your login was not accepted by the Worker. Sign out and back in.')
  if (r.status === 429) throw new Error('Too many Claude requests right now. Wait a minute and try again.')
  if (!r.ok) { const t = await r.text(); throw new Error(`Claude API ${r.status}: ${t.slice(0, 300)}`) }
  const d = await r.json()
  if (d.stop_reason === 'refusal') throw new Error('Claude declined this request.')
  return d
}

function textOf(d) { return (d.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n') }
function jsonOf(d) {
  const t = textOf(d).trim()
  try { return JSON.parse(t) } catch {}
  const m = t.match(/\{[\s\S]*\}/); if (m) { try { return JSON.parse(m[0]) } catch {} }
  throw new Error('Claude returned something that is not JSON.')
}

const SYSTEM = `You are a senior planning strategist at Paradiem, a Registered Investment Advisor that acts as an advocate for families. Paradiem aligns family and capital with a 100-Year Vision. Everything you write is grounded in the family's own goals and intentions, is specific to their documents and numbers, and never invents facts. Where a fact is missing, say "not provided". Use plain, warm, professional language a client could read. Tax law year: ${new Date().getFullYear()}.`

// ─── Document extraction ───
const EXTRACT_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['doc_type', 'title', 'summary', 'parties', 'fiduciaries', 'key_terms', 'dates', 'financials', 'flags', 'planning_notes'],
  properties: {
    doc_type: { type: 'string', description: 'e.g. Will, Revocable Trust, Durable POA, Form 1040, Form 1065, K-1, Form 709, Operating Agreement, Buy-Sell, Life Insurance Policy, Brokerage Statement, eMoney Report, Other' },
    title: { type: 'string' },
    summary: { type: 'string', description: '3-5 sentence plain-English summary' },
    parties: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['name', 'role'], properties: { name: { type: 'string' }, role: { type: 'string' } } } },
    fiduciaries: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['name', 'role', 'successor'], properties: { name: { type: 'string' }, role: { type: 'string' }, successor: { type: 'boolean' } } } },
    key_terms: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['term', 'detail'], properties: { term: { type: 'string' }, detail: { type: 'string' } } }, description: 'Dispositive provisions, distribution standards, trust splits at death, ownership percentages, transfer restrictions, coverage amounts' },
    dates: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['label', 'date'], properties: { label: { type: 'string' }, date: { type: 'string' } } } },
    financials: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['label', 'value'], properties: { label: { type: 'string' }, value: { type: 'string' } } }, description: 'AGI, taxable income, marginal bracket, capital gains, charitable deductions, K-1 income, exemption used, account values, death benefit, cash value, premiums' },
    flags: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['severity', 'issue'], properties: { severity: { type: 'string', enum: ['red', 'amber', 'green'] }, issue: { type: 'string' } } }, description: 'Gaps, risks, outdated provisions, missing documents this one references, tax exposures' },
    planning_notes: { type: 'array', items: { type: 'string' }, description: 'Specific observations a planner would put in a Gap Analysis' },
  },
}

export async function extractDocument(file, { category, familyName } = {}) {
  const isPdf = /pdf$/i.test(file.type) || /\.pdf$/i.test(file.name)
  const isImage = /^image\//.test(file.type)
  const content = []
  if (isPdf) content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: await fileToBase64(file) }, title: file.name })
  else if (isImage) content.push({ type: 'image', source: { type: 'base64', media_type: file.type, data: await fileToBase64(file) } })
  else content.push({ type: 'text', text: `FILE ${file.name}:\n${await file.text()}` })
  content.push({ type: 'text', text: `Read this document uploaded for the ${familyName || 'client'} family under the checklist category "${category || 'Other'}". Extract the structured facts a planning strategist needs for a Family Capital Gap Analysis. Flag anything outdated, missing, or that creates tax or protection exposure.` })
  const d = await messages({ max_tokens: 16000, system: SYSTEM, output_config: { format: { type: 'json_schema', schema: EXTRACT_SCHEMA } }, messages: [{ role: 'user', content }] })
  return jsonOf(d)
}

// ─── Gap analysis drafting per goal ───
const GOAL_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['status_suggestion', 'observations', 'challenges', 'cost_of_inaction', 'recommended_tools'],
  properties: {
    status_suggestion: { type: 'string', enum: ['met', 'missed', 'unclear'] },
    observations: { type: 'array', items: { type: 'string' }, description: '3-5 bullets. Facts from the documents, numbers and retreat notes. Second person ("You mentioned...").' },
    challenges: { type: 'array', items: { type: 'string' }, description: '1-3 bullets on what happens if nothing changes' },
    cost_of_inaction: { type: 'object', additionalProperties: false, required: ['amount', 'basis'], properties: { amount: { type: ['number', 'null'] }, basis: { type: 'string', description: 'One sentence showing the arithmetic, or "not quantifiable"' } } },
    recommended_tools: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['tool_id', 'tier', 'rationale'], properties: { tool_id: { type: 'string' }, tier: { type: 'string', enum: ['Protect', 'Deadline', 'Structural', 'Optimize', 'Legacy'] }, rationale: { type: 'string', description: 'Two sentences: why this tool for this family and this goal' } } } },
  },
}

export async function draftGoal({ goal, family, context, tools }) {
  const toolList = tools.map((t) => `${t.id}: ${t.name} — fits when ${t.fit.slice(0, 2).join('; ')}. Not when ${t.disqualifiers.slice(0, 2).join('; ') || 'n/a'}.`).join('\n')
  const prompt = `FAMILY CONTEXT\n${context}\n\nGOAL\n"${goal.text}"\n\nPLANNER NOTES\n${goal.notes || '(none)'}\n\nAVAILABLE PLANNING TOOLS (only recommend from this list, by tool_id)\n${toolList}\n\nDraft the Gap Analysis page for this goal: observations, potential challenges, a potential cost of inaction with its basis, and the tools you would recommend with the priority tier (Protect = hurts the family if something happens tomorrow; Deadline = a statutory window or pending transaction; Structural = shapes the estate or entities; Optimize = reduces tax or improves cash flow; Legacy = builds the 100-year vision).`
  const d = await messages({ max_tokens: 16000, system: SYSTEM, output_config: { format: { type: 'json_schema', schema: GOAL_SCHEMA } }, messages: [{ role: 'user', content: prompt }] })
  return jsonOf(d)
}

// ─── Estate flow chart draft ───
const FLOW_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['nodes', 'edges', 'lines', 'notes'],
  properties: {
    nodes: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['id', 'type', 'label', 'amount', 'col', 'row'], properties: { id: { type: 'string' }, type: { type: 'string', enum: ['couple', 'individual', 'trust', 'irs', 'charity', 'other'] }, label: { type: 'string' }, amount: { type: ['number', 'null'] }, col: { type: 'integer', description: '0-4 left to right' }, row: { type: 'integer', description: '0 = during life, 1 = first death, 2 = second death, 3 = heirs' } } } },
    edges: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['from', 'to', 'label', 'amount'], properties: { from: { type: 'string' }, to: { type: 'string' }, label: { type: 'string' }, amount: { type: ['number', 'null'] } } } },
    lines: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['row', 'label'], properties: { row: { type: 'integer' }, label: { type: 'string' } } } },
    notes: { type: 'array', items: { type: 'string' } },
  },
}
export async function draftFlowchart({ family, context }) {
  const prompt = `FAMILY CONTEXT\n${context}\n\nDraft the CURRENT estate flow chart for this family as boxes and numbered flows, using the convention: couple box at top, the OLDER spouse passes first, then the survivor, then heirs. Include marital / bypass / survivor / children's trusts only if the documents create them; otherwise show outright transfers under the will or intestacy. Include an IRS box with estimated estate tax where the estate exceeds the exemption. Number edge labels "(1) ...", "(2) ..." in the order assets move. Amounts in dollars.`
  const d = await messages({ max_tokens: 16000, system: SYSTEM, output_config: { format: { type: 'json_schema', schema: FLOW_SCHEMA } }, messages: [{ role: 'user', content: prompt }] })
  return jsonOf(d)
}

// ─── Free-form helper (summaries, rewrites) ───
export async function ask(prompt, { maxTokens = 8000 } = {}) {
  const d = await messages({ max_tokens: maxTokens, system: SYSTEM, messages: [{ role: 'user', content: prompt }] })
  return textOf(d)
}

// ─── Cash-flow intake: one document in, proposed model changes out (nothing is saved here) ───
import { intakeSchema, INTAKE_SYSTEM_RULES, intakeFieldGuide, existingRecordHints } from '../cashflow/intake'
import { xlsxToText } from './xlsxText'

export const INTAKE_MAX_BYTES = 20 * 1024 * 1024
export const INTAKE_ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,.gif,.csv,.xlsx,.xls,.txt'

export async function extractCashflow(file, { familyName, model } = {}) {
  if (file.size > INTAKE_MAX_BYTES) throw new Error(`${file.name} is larger than ${INTAKE_MAX_BYTES / 1024 / 1024} MB.`)
  const name = file.name
  const isPdf = /pdf$/i.test(file.type) || /\.pdf$/i.test(name)
  const isImage = /^image\//.test(file.type) || /\.(png|jpe?g|webp|gif)$/i.test(name)
  const isXlsx = /\.xlsx$/i.test(name)
  if (/\.xls$/i.test(name)) throw new Error(`${name}: old .xls files are not supported. Save as .xlsx or .csv and drop it again.`)
  const content = []
  if (isPdf) content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: await fileToBase64(file) }, title: name })
  else if (isImage) content.push({ type: 'image', source: { type: 'base64', media_type: file.type || 'image/png', data: await fileToBase64(file) } })
  else if (isXlsx) content.push({ type: 'text', text: `SPREADSHEET ${name} (tab-separated, one block per sheet):\n${await xlsxToText(await file.arrayBuffer())}` })
  else content.push({ type: 'text', text: `FILE ${name}:\n${(await file.text()).slice(0, 150000)}` })
  content.push({ type: 'text', text: `Document file name: ${name}\nFamily: ${familyName || 'client'}\n\nFields you may extract (collection: field (type)):\n${intakeFieldGuide()}\n\n${existingRecordHints(model)}\n\nRead the document and return the extraction. Set source_file to exactly "${name}".` })
  const d = await messages({ max_tokens: 16000, system: `${SYSTEM}\n\n${INTAKE_SYSTEM_RULES}`, output_config: { format: { type: 'json_schema', schema: intakeSchema() } }, messages: [{ role: 'user', content }] })
  const out = jsonOf(d)
  return { ...out, source_file: name }
}

// ─── Plain-English narrative for client reports (editable by the planner before export) ───
export async function writeNarrative({ familyName, facts, tone = 'warm, plain-English, professional' }) {
  const prompt = `Write a short client-ready narrative (about 250 to 350 words, 3 to 5 short paragraphs, no headings, no bullet points) summarising these cash-flow planning results for the ${familyName} family. Tone: ${tone}. Use only the numbers provided; do not invent figures, do not promise outcomes, and note that projections are hypothetical. Say plainly when something needs attention.\n\nRESULTS (JSON)\n${JSON.stringify(facts, null, 1)}`
  const d = await messages({ max_tokens: 2000, system: SYSTEM, messages: [{ role: 'user', content: prompt }] })
  return textOf(d).trim()
}

// ─── Goals and Intentions document → one entry per goal (each becomes its own slide) ───
const GOALS_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['goals', 'couple_names', 'notes'],
  properties: {
    couple_names: { type: 'string', description: 'The clients\' names as written on the document, or an empty string' },
    goals: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['text', 'title', 'page', 'confidence'], properties: {
      text: { type: 'string', description: 'The goal or intention in the clients\' own wording, one goal only, as a single sentence or phrase. Fix obvious typos only.' },
      title: { type: 'string', description: 'A 2 to 5 word label for the goal, for example "Emergency reserves" or "Charitable giving"' },
      page: { type: ['integer', 'null'], description: 'Page of the document the goal appears on, or null' },
      confidence: { type: 'string', enum: ['high', 'medium', 'low'], description: 'low when the text was hard to read or you are unsure it is a goal' },
    } } },
    notes: { type: 'string', description: 'Anything the planner should check, for example an unreadable section. Empty string when nothing.' },
  },
}
export const GOALS_ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,.txt,.docx'
export async function extractGoals(file, { familyName } = {}) {
  if (file.size > INTAKE_MAX_BYTES) throw new Error(`${file.name} is larger than ${INTAKE_MAX_BYTES / 1024 / 1024} MB.`)
  const name = file.name
  const isPdf = /pdf$/i.test(file.type) || /\.pdf$/i.test(name)
  const isImage = /^image\//.test(file.type) || /\.(png|jpe?g|webp)$/i.test(name)
  if (/\.docx$/i.test(name)) throw new Error('Word files are not read directly. Save it as a PDF and upload that, or paste the goals instead.')
  const content = []
  if (isPdf) content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: await fileToBase64(file) }, title: name })
  else if (isImage) content.push({ type: 'image', source: { type: 'base64', media_type: file.type || 'image/png', data: await fileToBase64(file) } })
  else content.push({ type: 'text', text: `FILE ${name}:\n${(await file.text()).slice(0, 120000)}` })
  content.push({ type: 'text', text: `This is the "Goals and Intentions" document for ${familyName || 'a client family'}. List every separate goal or intention the clients wrote, in document order, one entry each.\nRules: keep their wording; do not merge two goals or split one goal; do not add goals that are not on the page; skip headings, instructions, page numbers and signatures; never invent dollar amounts. Return the JSON only.` })
  const d = await messages({ max_tokens: 8000, system: `${SYSTEM}\n\nYou are transcribing a client document exactly. Accuracy over completeness: if something is unreadable, say so in notes.`, output_config: { format: { type: 'json_schema', schema: GOALS_SCHEMA } }, messages: [{ role: 'user', content }] })
  const out = jsonOf(d)
  return { ...out, source_file: name }
}

/** Split pasted text into goals: one per line, bullets and numbering removed. */
export function goalsFromText(text) {
  return String(text || '').split(/\r?\n/).map((l) => l.replace(/^[\s•▪■\-*\d.)✓×]+/, '').trim()).filter((l) => l.length > 2).map((t) => ({ text: t, title: '', page: null, confidence: 'high' }))
}

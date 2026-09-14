// Claude integration. All calls go through the Cloudflare Worker (VITE_PROXY_URL), which holds
// the API key. For local development only, VITE_ANTHROPIC_KEY calls the API directly.
import { fileToBase64 } from './util'

const PROXY = (import.meta.env.VITE_PROXY_URL || '').replace(/\/+$/, '')
const DIRECT_KEY = import.meta.env.VITE_ANTHROPIC_KEY || ''
export const CLAUDE_ENABLED = Boolean(PROXY || DIRECT_KEY)
export const MODEL = 'claude-opus-5'

async function messages(body) {
  if (!CLAUDE_ENABLED) throw new Error('Claude is not configured. Set VITE_PROXY_URL (see docs/SETUP.md).')
  const url = PROXY ? `${PROXY}/anthropic/v1/messages` : 'https://api.anthropic.com/v1/messages'
  const headers = { 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01', 'anthropic-beta': 'server-side-fallback-2026-07-01' }
  if (!PROXY) { headers['x-api-key'] = DIRECT_KEY; headers['anthropic-dangerous-direct-browser-access'] = 'true' }
  const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ model: MODEL, fallbacks: 'default', ...body }) })
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

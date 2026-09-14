// Build the plain-text family context handed to Claude for drafting.
import { fmtUsd, num, ageFrom } from './util'
import { familyFlags, FLAG_LABELS } from './flags'
import { DOC_CATEGORIES } from '../data/docCategories'
import { ASSET_TYPES, netWorthOf, totalAssets, totalLiab } from '../tabs/Families'

export function familyContext(f, settings) {
  const p = f.profile || {}
  const tax = settings?.tax?.[new Date().getFullYear()] || Object.values(settings?.tax || {})[0] || {}
  const lines = []
  lines.push(`FAMILY: ${f.name}. Tier: ${f.tier === 'under5' ? 'under $5M' : '$5M+'}. State: ${p.state || 'not provided'}${p.city ? `, ${p.city}` : ''}.`)
  const sp = (s, i) => s?.name ? `${s.name}${s.dob ? ` (age ${ageFrom(s.dob)})` : ''}` : `Spouse ${i} not provided`
  lines.push(`Spouses: ${sp(p.spouse1, 1)}; ${sp(p.spouse2, 2)}.`)
  if ((f.children || []).length) lines.push(`Children: ${f.children.map((c) => `${c.name || 'unnamed'}${c.dob ? ` (${ageFrom(c.dob)})` : ''}${c.married ? ', married' : ''}${c.inBusiness ? ', works in the business' : ''}${c.specialNeeds ? ', special needs' : ''}${c.notes ? ` — ${c.notes}` : ''}`).join('; ')}.`)
  if (p.grandchildren) lines.push(`Grandchildren: ${p.grandchildren}.`)
  if (p.dependents) lines.push(`Other dependents: ${p.dependents}.`)
  lines.push(`Household income: ${p.householdIncome ? fmtUsd(p.householdIncome) : 'not provided'}. Net worth: ${fmtUsd(netWorthOf(f))} (assets ${fmtUsd(totalAssets(f))}, liabilities ${fmtUsd(totalLiab(f))}).`)
  if (p.vision) lines.push(`100-YEAR VISION (client's words): ${p.vision}`)
  if (f.business?.owner) { const b = f.business; lines.push(`BUSINESS: ${b.name || 'unnamed'} (${b.entity || 'entity not provided'}), value ${b.value ? fmtUsd(b.value) : 'not provided'}, revenue ${b.revenue ? fmtUsd(b.revenue) : 'not provided'}, other owners ${b.otherOwners || 0}, sale horizon ${b.saleHorizonYears || 'none'} years${b.salePending ? ', SALE PENDING' : ''}, succession plan ${b.successionPlan ? 'yes' : 'no'}, successor ${b.successor || 'none'}, key employees ${b.keyEmployees ? 'yes' : 'no'}.`) }
  const assets = f.balanceSheet?.assets || []
  if (assets.length) lines.push(`ASSETS: ${assets.map((a) => `${a.name || ASSET_TYPES.find((t) => t.value === a.type)?.label} [${a.type}, ${a.owner}] ${fmtUsd(a.value)}${a.basis ? ` basis ${fmtUsd(a.basis)}` : ''}${a.salePending ? ' (sale pending)' : ''}`).join('; ')}.`)
  const liab = f.balanceSheet?.liabilities || []
  if (liab.length) lines.push(`LIABILITIES: ${liab.map((l) => `${l.name} ${fmtUsd(l.value)}${l.rate ? ` at ${l.rate}%` : ''}`).join('; ')}.`)
  const e = f.estateTax || {}
  lines.push(`ESTATE TAX (${new Date().getFullYear()}): exemption ${fmtUsd(tax.estateExemption)} per person; used spouse1 ${fmtUsd(num(e.s1?.creditUsed))}, spouse2 ${fmtUsd(num(e.s2?.creditUsed))}; GST used ${fmtUsd(num(e.s1?.gstUsed))} / ${fmtUsd(num(e.s2?.gstUsed))}; estate tax rate ${tax.estateTaxRate}%.`)
  const docs = DOC_CATEGORIES.map((c) => { const d = f.documents?.[c.id]; return `${c.label}: ${d?.status || 'missing'}` })
  lines.push(`DOCUMENT CHECKLIST: ${docs.join('; ')}.`)
  for (const c of DOC_CATEGORIES) for (const file of (f.documents?.[c.id]?.files || [])) {
    if (!file.extraction) continue
    const x = file.extraction
    lines.push(`DOCUMENT "${file.name}" (${x.doc_type}): ${x.summary} Key terms: ${(x.key_terms || []).map((k) => `${k.term}: ${k.detail}`).join('; ')}. Financials: ${(x.financials || []).map((k) => `${k.label} ${k.value}`).join('; ')}. Flags: ${(x.flags || []).map((k) => `[${k.severity}] ${k.issue}`).join('; ')}. Notes: ${(x.planning_notes || []).join(' ')}`)
  }
  if ((f.goals || []).length) lines.push(`GOALS & INTENTIONS: ${f.goals.map((g, i) => `${i + 1}. ${g.text}${g.status !== 'open' ? ` [${g.status}]` : ''}`).join(' ')}`)
  if (f.notes) lines.push(`PLANNER NOTES: ${f.notes}`)
  lines.push(`FLAGS: ${familyFlags(f, tax).map((x) => FLAG_LABELS[x] || x).join(', ') || 'none'}.`)
  return lines.join('\n')
}

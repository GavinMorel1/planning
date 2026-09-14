// Match tools to a family. Score = number of matched triggers, plus goal-keyword hits.
import { TOOLS, tierRank } from '../data/tools'
import { familyFlags } from './flags'

export function recommendTools(family, tax) {
  const flags = new Set(familyFlags(family, tax))
  const goals = family?.goals || []
  const out = []
  for (const t of TOOLS) {
    const hits = (t.triggers || []).filter((x) => flags.has(x))
    const goalHits = goals.filter((g) => {
      const txt = (g.text || '').toLowerCase()
      return (t.goalKeys || []).some((k) => txt.includes(k))
    })
    if (!hits.length) continue
    out.push({ tool: t, hits, goalIds: goalHits.map((g) => g.id), score: hits.length * 2 + goalHits.length })
  }
  return out.sort((a, b) => tierRank(a.tool.tier) - tierRank(b.tool.tier) || b.score - a.score)
}

export function rationaleFor(rec, family) {
  const goals = (family?.goals || []).filter((g) => rec.goalIds.includes(g.id)).map((g) => `"${g.text}"`)
  const why = rec.tool.fit.slice(0, 2).join('; ')
  const because = goals.length ? `It serves the family's stated goal${goals.length > 1 ? 's' : ''} ${goals.join(' and ')}.` : 'It matches the family’s situation.'
  return `${rec.tool.name}: ${why}. ${because}`
}

// Federal estate tax snapshots, one per adult death in the projection.
//
// Rules: assets are valued at the end of the death year (from the projection row). At the first of two spousal deaths joint
// accounts split 50/50 and individually owned accounts belong to their owner; everything the decedent owned passes to the
// surviving spouse (unlimited marital deduction), so no tax is due and the full exemption is "unused" and ported (DSUE) if
// cfg.portability !== false. The survivor owns every account at their own death. Exemption = cfg.estateExemption indexed by
// inflation from taxYear to the year of death (unless indexTables is false) + DSUE (fixed dollars). Life insurance counts when the
// policy is flagged inEstate, insures the decedent and is still in force (term policies: premiumEndYear not passed). Not modelled:
// state estate/inheritance taxes, administration costs, lifetime taxable gifts, portability elections, trusts (ILITs aside).
import type { CashflowModel, Id } from '../types'
import type { EngineConfig, EstateSnapshot, Projection } from './types'
import { buildPlan } from './plan'
import { indexFactor } from './tax'

export function estateSnapshots(model: CashflowModel, projection: Projection, cfg: EngineConfig): EstateSnapshot[] {
  const ctx = buildPlan(model, cfg)
  const a = model.assumptions
  const out: EstateSnapshot[] = []
  const deaths = ctx.adults.map((m, i) => ({ m, i })).sort((p, q) => p.m.deathYear - q.m.deathYear || p.i - q.i).map((x) => x.m)
  const processed = new Set<Id>()
  let dsue = 0
  for (const d of deaths) {
    const year = d.deathYear
    const row = projection.rows.find((r) => r.year === year) ?? projection.rows[projection.rows.length - 1]
    if (!row) continue
    const spouseAlive = ctx.adults.some((o) => o.id !== d.id && !processed.has(o.id))
    // Share of an account that belongs to the decedent: with a living spouse, own accounts 100% and joint 50%; the last
    // survivor owns everything that passed to them (dependents' own accounts excluded).
    const dependentIds = new Set(ctx.members.filter((x) => !x.isAdult).map((x) => x.id))
    const share = (ownerId: Id | 'joint'): number => {
      if (spouseAlive) return ownerId === d.id ? 1 : ownerId === 'joint' ? 0.5 : 0
      return dependentIds.has(ownerId) ? 0 : 1
    }
    let assets = 0
    for (const acc of ctx.accounts) assets += (row.accountBalances[acc.id] ?? 0) * share(acc.ownerId)
    // liabilities follow the secured asset's ownership, else are split like joint debt
    const ti = ctx.years.findIndex((y) => y.year === row.year)
    let liabilities = 0
    for (const { liability, schedule } of ctx.liabilities) {
      const bal = ti >= 0 ? schedule.years[ti].endBalance : 0
      const sec = liability.securedById ? ctx.accounts.find((x) => x.id === liability.securedById) : undefined
      liabilities += bal * (sec ? share(sec.ownerId) : spouseAlive ? 0.5 : 1)
    }
    let insurance = 0
    for (const p of model.insurance) {
      if (p.insuredId !== d.id || !p.inEstate) continue
      if (p.kind === 'term' && p.premiumEndYear !== null && p.premiumEndYear < year) continue
      insurance += p.deathBenefit
    }
    const gross = assets + insurance
    const net = Math.max(0, gross - liabilities)
    const marital = spouseAlive ? net : 0
    const taxable = net - marital
    const own = cfg.estateExemption * indexFactor(year, a.inflationPct, ctx.taxYear, cfg.indexTables !== false)
    const available = own + dsue
    const used = Math.min(taxable, available)
    const tax = Math.max(0, taxable - available) * (cfg.estateTaxRate / 100)
    if (spouseAlive && cfg.portability !== false) dsue += Math.max(0, own - used)
    out.push({
      year, deceasedId: d.id, deceasedName: d.name, grossEstate: gross, insuranceInEstate: insurance, liabilities, maritalDeduction: marital,
      taxableEstate: taxable, exemptionAvailable: available, exemptionUsed: used, federalEstateTax: tax, netToHeirs: net - tax,
      note: spouseAlive ? 'Passes to the surviving spouse (unlimited marital deduction); unused exemption ported.' : dsue > 0 ? 'Second death: own exemption plus the ported exemption (DSUE) from the first death.' : 'Estate of the last surviving member.',
    })
    processed.add(d.id)
  }
  return out
}

// "Family Capital Gap Analysis+" deck (under-$5M clients: the engagement ends with moving their investments). Slide order and
// content follow the reference deck; every number comes from fields on the family record or from the Cashflow engine.
import PptxGenJS from 'pptxgenjs'
import * as K from './deckkit'
import { kit, logoData, asDataUrl, longDate, coupleName, DEFAULT_NEXT_STEPS } from './deckkit'
import * as U from './slidesUnder5'
import * as P from './slidesPlus'
import { gapPlusOf, slideOn, planFor, cashNeedsFromPlan, fiveYearStatement, lifetimeTable, endSummary, planGap } from './gapPlus'
import { fmtUsd, num } from './util'

const hasAudit = (a) => a.curAnnualReturn || a.curDividendYield || a.curTotalReturn
/** Cash-need fields: what the planner typed wins; blanks fall back to what the plan draws from savings. */
const withPlanCash = (a, plan) => {
  const c = cashNeedsFromPlan(plan)
  if (!c) return a
  const out = { ...a }
  Object.keys(c).forEach((k) => { if (out[k] === '' || out[k] == null) out[k] = c[k] })
  return out
}

export async function buildGapPlus(f, settings, { model = null } = {}) {
  const [logo, small, white] = await Promise.all([logoData(), asDataUrl('deck/paradiem-logo-small.png'), asDataUrl('deck/paradiem-logo-white.png')])
  kit.logoSmall = small; kit.logoWhite = white; kit.logoAll = true; kit.eyebrow = null; kit.outlines = settings?.deckOutlines !== false; kit.next = null
  try {
    const pptx = new PptxGenJS()
    pptx.layout = 'LAYOUT_16x9'
    pptx.author = 'Paradiem'; pptx.company = 'Paradiem, LLC'; pptx.title = `Family Capital Gap Analysis+ — ${f.name}`
    const gp = gapPlusOf(f), a = { ...(f.assessment || {}), date: gp.date || f.assessment?.date }
    const on = (id) => slideOn(gp, id)
    const goals = (f.goals || []).filter((g) => g.text)
    const plan = planFor(model, settings, gp.baseScenario)
    const baseA = withPlanCash(a, plan)
    const none = planGap(model)

    K.cover(pptx, logo, 'Family Capital Gap Analysis +\nBlueprint', gp.coverName || coupleName(f), gp.date || a.date)
    K.disclosures(pptx)
    K.twoKinds(pptx)
    P.processPlus(pptx)
    K.divider(pptx, ['Preparing the Money for the Family'], 'Section one')
    P.goalsListPlus(pptx, goals)
    K.divider(pptx, ['Our Financial Security', 'and Fulfillment'], 'Financial overview')
    if (on('balance')) K.balanceSheetSlide(pptx, f)
    for (const g of goals) if (!g.skipPlus) P.obsSolutions(pptx, { title: g.title || g.text, observations: g.observations || [], solutions: g.solutions || [] })
    for (const t of gp.analysis) if (t.title) P.obsSolutions(pptx, { title: t.title, observations: t.observations || [], solutions: t.solutions || [] })

    K.divider(pptx, ['Planning Assumptions', '& Strategies'], 'Current plan analysis')
    if (on('assumptions')) P.assumptionsSlide(pptx, { cash: gp.assumptions.cashGrowth, invest: gp.assumptions.investGrowth })
    if (on('pensionSS') && gp.pensionSS.some(Boolean)) P.bulletSlide(pptx, 'Current plan analysis', 'Pension and Social Security', gp.pensionSS)
    if (on('strategies') && gp.strategies.some(Boolean)) P.bulletSlide(pptx, 'Current plan analysis', 'Potential Strategies Analyzed', gp.strategies)
    if (on('cashFlow5')) P.statementSlide(pptx, { eyebrow: 'Base plan', title: '5-Year Cash Flow', statement: fiveYearStatement(plan), image: gp.images.cashFlow5, note: none })
    if (on('cashNeeds')) { P.cashNeedsOverview(pptx, baseA); K.cashNeeds(pptx, baseA, { eyebrow: 'Base plan' }) }
    if (on('buyOption')) K.buyOption(pptx)
    if (on('ownership')) K.proposedOwnership(pptx, a, f.name)
    if (on('dividend')) U.dividendStats(pptx, settings.performance)
    if (on('growth')) K.perfTable(pptx, 'growth', settings.performance)
    if (on('audit') && hasAudit(a)) U.audit(pptx, a)
    if (on('lifeboat')) K.lifeboat(pptx, a, f.name)
    if (on('lifetime')) P.lifetimeSlides(pptx, { eyebrow: 'Base plan', title: 'Lifetime Cash Flow', table: lifetimeTable(plan), image: gp.images.lifetime, note: none })

    const ltcAmt = num(gp.ltc.amount)
    if (on('ltc') && ltcAmt > 0) {
      const tag = `${fmtUsd(ltcAmt)} LTC annuity`
      const ltcPlan = planFor(model, settings, gp.ltc.scenarioId)
      const la = withPlanCash({ ...gp.ltc.invest, date: a.date }, ltcPlan)
      P.bulletSlide(pptx, 'LTC annuity', `${fmtUsd(ltcAmt)} LTC Annuity`, gp.ltc.bullets)
      kit.eyebrow = tag
      P.statementSlide(pptx, { eyebrow: 'Base plan', title: '5-Year Cash Flow', statement: fiveYearStatement(ltcPlan), image: gp.images.ltcCashFlow5, note: gp.ltc.scenarioId ? none : 'Choose the annuity scenario in the deck editor.' })
      P.cashNeedsOverview(pptx, la); K.cashNeeds(pptx, la, { eyebrow: tag })
      K.proposedOwnership(pptx, la, f.name)
      kit.eyebrow = null
      if (hasAudit(la)) U.audit(pptx, la)
      K.lifeboat(pptx, la, f.name)
      kit.eyebrow = tag
      P.lifetimeSlides(pptx, { eyebrow: 'Base plan', title: 'Lifetime Cash Flow', table: lifetimeTable(ltcPlan), image: gp.images.ltcLifetime, note: gp.ltc.scenarioId ? none : 'Choose the annuity scenario in the deck editor.' })
      kit.eyebrow = null
      P.planVsAnnuity(pptx, { base: endSummary(plan), ltc: endSummary(ltcPlan) })
    }

    if (on('summary') && gp.planSummary.some(Boolean)) P.bulletSlide(pptx, 'Plan summary', 'Plan Summary', gp.planSummary)
    K.divider(pptx, ['Timeline and', 'Next Steps'])
    if (on('timeline')) { if (gp.images.timeline) P.statementSlide(pptx, { eyebrow: 'Timeline', title: 'Timeline: First Year', image: gp.images.timeline }); else K.timelineSlide(pptx, f) }
    if (on('nextSteps')) { const steps = gp.nextSteps.filter(Boolean); K.nextStepsSlide(pptx, steps.length ? steps : (f.gapMeta?.nextSteps || []).filter(Boolean).length ? f.gapMeta.nextSteps.filter(Boolean) : DEFAULT_NEXT_STEPS) }
    return await pptx.write({ outputType: 'blob' })
  } finally { kit.logoAll = false; kit.eyebrow = null }
}

/** Outline shown in the Presentations tab so the planner can see what the deck will contain for this family. */
export function gapPlusOutline(f, model, settings) {
  const gp = gapPlusOf(f), on = (id) => slideOn(gp, id)
  const goals = (f.goals || []).filter((g) => g.text && !g.skipPlus)
  const out = ['Cover', 'Disclosures', 'Two Kinds of Return', 'Our Process', 'Section one: Preparing the Money for the Family', 'Goals and Intentions', 'Financial overview', on('balance') && 'Balance sheet', `Observations / Solutions pages (${goals.length} goals${gp.analysis.filter((t) => t.title).length ? ` + ${gp.analysis.filter((t) => t.title).length} topics` : ''})`, 'Planning Assumptions & Strategies', on('assumptions') && 'Assumptions in plan', on('pensionSS') && gp.pensionSS.some(Boolean) && 'Pension and Social Security', on('strategies') && gp.strategies.some(Boolean) && 'Potential strategies analyzed', on('cashFlow5') && '5-Year Cash Flow', on('cashNeeds') && '5 Year Cash Needs (2 layouts)', on('buyOption') && 'Buy-option cash strategy', on('ownership') && 'Proposed ownership', on('dividend') && 'Dividend strategy returns', on('growth') && 'Growth strategy returns', on('audit') && hasAudit(f.assessment || {}) && 'Performance audit', on('lifeboat') && 'Lifeboat drill', on('lifetime') && 'Lifetime Cash Flow', on('ltc') && num(gp.ltc.amount) > 0 && 'LTC annuity section (8–9 slides)', on('summary') && gp.planSummary.some(Boolean) && 'Plan summary', 'Timeline and Next Steps', on('timeline') && 'Timeline: first year', on('nextSteps') && 'Next steps']
  return out.filter(Boolean)
}

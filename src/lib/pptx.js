// Deck builders: Family Capital Assessment (two variants) and Family Capital Gap Analysis.
// Slide functions live in deckkit.js (shared) and slidesUnder5.js (under-$5M deck).
import PptxGenJS from 'pptxgenjs'
import * as K from './deckkit'
import { kit, logoData, longDate, chunk } from './deckkit'
import { COPY } from '../data/defaults'
import { CASE_STUDIES } from '../data/caseStudies'
import { gapFee, blueprintMonthly, DEFAULT_FEE_SCHEDULE } from './fees'
import { fmtUsd, num } from './util'
import { tierRank } from '../data/tools'
import { netWorthOf } from '../tabs/Families'
import { animationSteps, injectAnimation } from './flowpptx'
import * as U from './slidesUnder5'
import { blendedAumRate } from './fees'
const { asDataUrl, imageDims, INVEST_FOOT } = K
const {
  cover, disclosures, framework, twoKinds, processSlide, incomeClarity, philosophy, principles, ownersLens, perfTable,
  proposedOwnership, cashNeeds, buyOption, proposedPerf, lifeboat, nextStep, gapSummary, blueprint, caseStudy, teamSlides, pathForward,
  divider, goalsList, planAnalysisList, goalAnalysis, estateTaxSlide, balanceSheetSlide, flowSlide, toolPages, timelineSlide, nextStepsSlide,
  coupleName, DEFAULT_NEXT_STEPS,
} = K

// ───────────────────────── Assessment deck ─────────────────────────
/** Which Assessment variant this family's deck uses (planner can toggle; defaults to the family's tier). */
export const assessmentVariant = (f) => f.assessment?.variant || (f.tier === 'under5' ? 'under5' : 'over5')

export async function buildAssessment(f, settings) {
  kit.logoSmall = null; kit.outlines = settings?.deckOutlines !== false
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_16x9'
  pptx.author = 'Paradiem'; pptx.company = 'Paradiem, LLC'; pptx.title = `Family Capital Assessment — ${f.name}`
  const variant = assessmentVariant(f)
  if (variant === 'under5') return buildAssessmentUnder5(pptx, f, settings)
  const [logo, smallLogo] = await Promise.all([logoData(), asDataUrl('deck/paradiem-logo-small.png')])
  kit.logoSmall = smallLogo
  const a = f.assessment || {}
  const fs = settings.feeSchedule || DEFAULT_FEE_SCHEDULE
  const nw = num(a.clarityNetWorth) || netWorthOf(f)
  const hasScores = (o) => o && ['innovation', 'inspiration', 'infrastructure'].some((k) => o[k] !== '' && o[k] != null)
  cover(pptx, logo, 'Family Capital Assessment', a.coverName || coupleName(f), a.date)
  disclosures(pptx)
  framework(pptx, { tiles: true })
  twoKinds(pptx)
  processSlide(pptx, 1)
  U.numbers4(pptx, settings, a, f, nw, true)
  philosophy(pptx)
  principles(pptx)
  U.lensSingle(pptx, hasScores(a.scorecardOverview) ? a.scorecardOverview : a.scorecard, true)
  U.lensCompare(pptx, a.scorecardCurrent, a.scorecard, true)
  if (num(a.currentAlloc?.stocks) + num(a.currentAlloc?.bonds) + num(a.currentAlloc?.cash) + num(a.currentAlloc?.other) > 0 || num(a.dividendPct) + num(a.growthPct) > 0) U.pies(pptx, a)
  perfTable(pptx, 'growth', settings.performance)
  U.dividendStats(pptx, settings.performance)
  U.ownership(pptx, a, f)
  cashNeeds(pptx, a)
  buyOption(pptx)
  U.audit(pptx, a)
  proposedPerf(pptx, a, f.name)
  lifeboat(pptx, a, f.name)
  U.numbers4(pptx, settings, a, f, nw, true)
  const fee = num(a.gapFeeOverride) || gapFee(netWorthOf(f), fs)
  nextStep(pptx, 'nextStepOver5', fee, 'Family Capital Gap Analysis')
  gapSummary(pptx, f.goals || [], { override: { met: a.gapMet, missed: a.gapMissed, total: a.gapTotal, cost: a.gapCost } })
  blueprint(pptx)
  const picked = Array.isArray(a.caseStudies) && a.caseStudies.length ? a.caseStudies : []
  for (const id of picked) { const cs = CASE_STUDIES.find((c) => c.id === id); if (cs) caseStudy(pptx, cs) }
  await teamSlides(pptx, settings.roster)
  pathForward(pptx, [['Schedule Kick-Off call for your Family Capital Gap Analysis', `${fmtUsd(fee)} Investment`], ['Provide Documents, Complete Surveys, Participate in 90-minute Initial Retreat', 'Data Gathering'], ['Receive Your Family Capital Gap Analysis', 'Estimated 2 weeks after step 2 complete']])
  return pptx.write({ outputType: 'blob' })
}

// The under-$5M deck (32 slides in the reference). Optional slides can be switched off in the Assessment tab.
async function buildAssessmentUnder5(pptx, f, settings) {
  const logo = await logoData()
  const a = f.assessment || {}
  const fs = settings.feeSchedule || DEFAULT_FEE_SCHEDULE
  const nw = num(a.clarityNetWorth) || netWorthOf(f)
  const on = (k) => a.slides?.[k] !== false
  kit.logoSmall = null
  const [icon, insp1, insp2] = await Promise.all([asDataUrl('deck/gold-bars.png'), asDataUrl('deck/inspire-insight.png'), asDataUrl('deck/bowyer-corporate-engagement.png')])
  K.coverOld(pptx, logo, 'Family Capital Assessment', a.coverName || coupleName(f), longDate(a.date))
  disclosures(pptx)
  framework(pptx, { tiles: false })
  twoKinds(pptx)
  processSlide(pptx, 1)
  K.kit.next = { bg: 'FFFFFF', footLeft: INVEST_FOOT }; principles(pptx, 'under5')
  if (on('matthew25')) { U.matthew(pptx, 1, icon); U.matthew(pptx, 2, icon) }
  U.numbers4(pptx, settings, a, f, nw)
  if (on('income')) incomeClarity(pptx, a, f.name)
  philosophy(pptx)
  const lens = a.lensMode || 'compare'
  if (lens === 'single' || lens === 'both') U.lensSingle(pptx, a.scorecard)
  if (lens === 'compare' || lens === 'both') U.lensCompare(pptx, a.scorecardCurrent, a.scorecard)
  if (on('inspiration')) U.inspiration(pptx, [insp1, insp2])
  if (on('values') && (a.values?.categories || []).some((c) => c.name)) U.valuesScreen(pptx, a.values)
  const conv = []
  for (const c of (a.convictions || [])) if (c.name || c.logo) { const d = c.logo ? await imageDims(c.logo) : null; conv.push({ ...c, w: d?.w, h: d?.h }) }
  if (on('convictions') && conv.length) U.convictions(pptx, conv)
  U.dividendStats(pptx, settings.performance)
  perfTable(pptx, 'growth', settings.performance)
  U.ownership(pptx, a, f, { under: true })
  if (on('pies') && Object.values(a.currentAlloc || {}).some((v) => num(v) > 0)) U.pies(pptx, a)
  cashNeeds(pptx, a)
  buyOption(pptx)
  if (on('audit') && (a.curAnnualReturn || a.curDividendYield || a.curTotalReturn)) U.audit(pptx, a)
  U.proposedPerf5(pptx, a, f, settings.copy?.riskDisclosure || COPY.riskDisclosure)
  lifeboat(pptx, a, f.name)
  U.numbers4(pptx, settings, a, f, nw)
  if (on('fees')) { const aum = num(a.feeAum) || num(a.portfolioTotal); U.fees(pptx, a, fs, aum, blendedAumRate(aum, fs)) }
  const fee = num(a.gapFeeOverride) || gapFee(netWorthOf(f), fs)
  K.kit.next = { footSize: 'x7' }; nextStep(pptx, a.nextStepVariant === 'A' ? 'nextStepUnder5A' : 'nextStepUnder5B', fee, 'Family Capital Gap Analysis & Blueprint')
  await teamSlides(pptx, settings.roster)
  pathForward(pptx, [['Begin the Family Capital Gap Analysis & Blueprint', `${fmtUsd(fee)} engagement`], ['Implement Family Capital Investment', 'Ongoing advisory relationship'], ['Receive Family Capital Gap Analysis & Blueprint', 'Comprehensive Multi-Generational Wealth Roadmap']], 'under5')
  return pptx.write({ outputType: 'blob' })
}

// ───────────────────────── Gap Analysis deck ─────────────────────────
export async function buildGap(f, settings, { cashflowReport = null } = {}) {
  kit.logoSmall = null
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_16x9'
  pptx.author = 'Paradiem'; pptx.company = 'Paradiem, LLC'; pptx.title = `Family Capital Gap Analysis — ${f.name}`
  const logo = await logoData()
  const fs = settings.feeSchedule || DEFAULT_FEE_SCHEDULE
  const gm = f.gapMeta || {}
  const goals = f.goals || []
  const tax = settings.tax?.[new Date().getFullYear()] || Object.values(settings.tax || {})[0] || {}
  K.coverOld(pptx, logo, 'Family Capital Gap Analysis', coupleName(f), longDate(gm.date))
  disclosures(pptx)
  twoKinds(pptx)
  processSlide(pptx, 2)
  divider(pptx, ['What you said', 'you want.'])
  goalsList(pptx, goals)
  gapSummary(pptx, goals, { panel: true })
  for (const g of goals) goalAnalysis(pptx, g)
  const recs = (f.recommendations || []).filter((r) => r.status === 'accepted').sort((a, b) => tierRank(a.tier) - tierRank(b.tier))
  if (gm.includeToolPages !== false && recs.length) toolPages(pptx, recs)
  if (gm.includeInvestmentSlides !== false) { perfTable(pptx, 'dividend', settings.performance); perfTable(pptx, 'growth', settings.performance) }
  balanceSheetSlide(pptx, f)
  estateTaxSlide(pptx, f, tax)
  if (cashflowReport) { // sections chosen on the Presentations tab, built from the family's saved cash-flow model
    const { addReportSlides } = await import('../cashflow/reports/pptx')
    divider(pptx, ['Cash Flow', 'Planning'])
    addReportSlides(pptx, cashflowReport, { eyebrow: 'Cash flow planning', pageNumbers: false })
  }
  divider(pptx, ['Your Current', 'Estate Flow Chart'])
  let flowNames = null
  const fc = f.flowchart
  if (fc?.nodes?.length) flowNames = await flowSlide(pptx, fc)
  else if (fc?.png) { const s = pptx.addSlide(); s.background = { color: B.white }; s.addImage({ data: fc.png, x: 0.3, y: 0.15, w: 9.4, h: 5.05 }) }
  planAnalysisList(pptx, goals)
  gapSummary(pptx, goals, { panel: true })
  divider(pptx, ["What's top of mind?"])
  await teamSlides(pptx, settings.roster)
  blueprint(pptx, blueprintMonthly(netWorthOf(f), 1, fs))
  divider(pptx, ['Timeline and', 'Next Steps'])
  timelineSlide(pptx, f)
  nextStepsSlide(pptx, (gm.nextSteps || []).filter(Boolean).length ? gm.nextSteps.filter(Boolean) : DEFAULT_NEXT_STEPS)
  const blob = await pptx.write({ outputType: 'blob' })
  const anim = fc?.animation
  if (flowNames && anim?.enabled) return injectAnimation(blob, animationSteps(fc, flowNames), { mode: anim.mode || 'click', effect: anim.effect || 'appear', delayMs: Number(anim.delayMs) || 700 })
  return blob
}

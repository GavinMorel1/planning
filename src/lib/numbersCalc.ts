// "What the Numbers Reveal" calculator. Replicates the Excel workbook
// "Family Capital Assessment Calculations" cell for cell. Do not "fix" a formula here: if the workbook changes, change
// the formula in the same way and update numbersCalc.test.ts.

export type SectionId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
export const SECTION_IDS: SectionId[] = [1, 2, 3, 4, 5, 6, 7, 8]

/** Firm constants (Settings > Firm averages). Percentages are stored as plain numbers, e.g. 12.67 means 12.67%. */
export interface NumbersRates {
  generosityMult: number // B10: 4.22  (a multiplier, shown as 422%)
  incomeTaxPct: number // E10: 12.67
  capGainsPct: number // H10: 61.23
  estateTaxPct: number // K12: 90.89
  lifetimePct: number // B18: 20.27
  failure1Pct: number // E18: 70
  failure3Pct: number // H18: 90
  growthRatePct: number // K18: 2.04  (extra performance per year)
  capGainsTaxRatePct: number // H9: 20
  estateTaxRatePct: number // K11: 40
  exemption: number // K9: 30,000,000 (married); halved for a single person
  defaultLifeExpectancy: number // B3: 90
}

export const DEFAULT_RATES: NumbersRates = {
  generosityMult: 4.22, incomeTaxPct: 12.67, capGainsPct: 61.23, estateTaxPct: 90.89, lifetimePct: 20.27,
  failure1Pct: 70, failure3Pct: 90, growthRatePct: 2.04, capGainsTaxRatePct: 20, estateTaxRatePct: 40,
  exemption: 30_000_000, defaultLifeExpectancy: 90,
}

/** Per-family inputs (all optional so a half-filled form still calculates; blanks count as 0, as in Excel). */
export interface NumbersInputs {
  currentAge?: number | string | null // B2
  lifeExpectancy?: number | string | null // B3 (default 90)
  estateValue?: number | string | null // B5
  marital?: 'married' | 'single' // single halves the exemption
  exemptionOverride?: number | string | null
  annualGiving?: number | string | null // B8
  incomeTaxes?: number | string | null // E8
  taxableGain?: number | string | null // H8
  investmentAmount?: number | string | null // K17
}

export interface Step { label: string; value: number; kind?: 'usd' | 'pct' | 'num' | 'years' | 'mult' }
export interface SectionResult {
  id: SectionId
  title: string
  steps: Step[]
  /** "Value for Presentation" in dollars */
  value: number
  /** headline percentage shown on the slide box */
  pctLabel: string
  /** arrow direction on the slide */
  dir: 'up' | 'down'
  red?: boolean
}
export interface NumbersResult { yearsRemaining: number; exemption: number; sections: Record<SectionId, SectionResult> }

export const SECTION_TITLES: Record<SectionId, string> = {
  1: 'Increased Lifetime Generosity', 2: 'Reduction in Income Taxes', 3: 'Reduction of Capital Gains Taxes', 4: 'Reduction of Estate Taxes',
  5: 'Inheritance Moved into Lifetime', 6: 'Wealth Failure after First Generation', 7: 'Wealth Failure in 3rd Generation', 8: 'Investment Performance',
}
export const DEFAULT_INCLUDE = { under5: [1, 5, 6, 8] as SectionId[], over5: [1, 4, 5, 6, 8] as SectionId[] }

/** Missing / blank / non-numeric input is 0, like an empty Excel cell. */
export function n(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0
  const x = typeof v === 'number' ? v : Number(String(v).replace(/[$,%\s]/g, ''))
  return Number.isFinite(x) ? x : 0
}

/** Excel FV(rate, nper, pmt, pv, type). */
export function fv(rate: number, nper: number, pmt: number, pv: number, type: 0 | 1 = 0): number {
  if (rate === 0) return -(pv + pmt * nper)
  const g = Math.pow(1 + rate, nper)
  return -(pv * g + pmt * (1 + rate * type) * ((g - 1) / rate))
}

const pctText = (p: number) => `${Number(p.toFixed(4))}%`

export function calcNumbers(input: NumbersInputs, rates: NumbersRates = DEFAULT_RATES): NumbersResult {
  const life = input.lifeExpectancy === undefined || input.lifeExpectancy === null || input.lifeExpectancy === '' ? rates.defaultLifeExpectancy : n(input.lifeExpectancy)
  const years = life - n(input.currentAge) // B4 = B3 - B2
  const estate = n(input.estateValue) // B5
  const exemption = input.exemptionOverride !== undefined && input.exemptionOverride !== null && input.exemptionOverride !== '' ? n(input.exemptionOverride) : input.marital === 'single' ? rates.exemption / 2 : rates.exemption // K9
  const S = {} as Record<SectionId, SectionResult>

  // 1 Increased Lifetime Generosity: B9 = B8*B4, B11 = B10*B9
  const giving = n(input.annualGiving), lifeGiving = giving * years
  S[1] = { id: 1, title: SECTION_TITLES[1], dir: 'up', pctLabel: pctText(rates.generosityMult * 100), value: rates.generosityMult * lifeGiving, steps: [
    { label: 'Current Annual Giving', value: giving, kind: 'usd' }, { label: 'Years of Life Remaining', value: years, kind: 'years' },
    { label: 'Lifetime Giving', value: lifeGiving, kind: 'usd' }, { label: '% Increase', value: rates.generosityMult * 100, kind: 'pct' } ] }

  // 2 Reduction in Income Taxes: E9 = E8*B4, E11 = E10*E9
  const tax = n(input.incomeTaxes), lifeTax = tax * years
  S[2] = { id: 2, title: SECTION_TITLES[2], dir: 'down', pctLabel: pctText(rates.incomeTaxPct), value: (rates.incomeTaxPct / 100) * lifeTax, steps: [
    { label: 'Current Income Taxes', value: tax, kind: 'usd' }, { label: 'Years of Life Remaining', value: years, kind: 'years' },
    { label: 'Lifetime Taxes', value: lifeTax, kind: 'usd' }, { label: '% Decrease', value: rates.incomeTaxPct, kind: 'pct' } ] }

  // 3 Reduction of Capital Gains Taxes: H9 = H8*0.2, H11 = H10*H9
  const gain = n(input.taxableGain), cgTax = gain * (rates.capGainsTaxRatePct / 100)
  S[3] = { id: 3, title: SECTION_TITLES[3], dir: 'down', pctLabel: pctText(rates.capGainsPct), value: (rates.capGainsPct / 100) * cgTax, steps: [
    { label: 'Taxable Gain on Sale', value: gain, kind: 'usd' }, { label: `${rates.capGainsTaxRatePct}% Capital Gain Tax`, value: cgTax, kind: 'usd' },
    { label: '% Decrease', value: rates.capGainsPct, kind: 'pct' } ] }

  // 4 Reduction of Estate Taxes: K10 = K8 - exemption, K11 = IF(K10>0, K10*0.4, 0), K13 = K12*K11
  const taxableEstate = estate - exemption, estateTax = taxableEstate > 0 ? taxableEstate * (rates.estateTaxRatePct / 100) : 0
  S[4] = { id: 4, title: SECTION_TITLES[4], dir: 'down', pctLabel: pctText(rates.estateTaxPct), value: (rates.estateTaxPct / 100) * estateTax, steps: [
    { label: 'Total Estate Value', value: estate, kind: 'usd' }, { label: 'Less Exemption', value: -exemption, kind: 'usd' },
    { label: 'Taxable Estate', value: taxableEstate, kind: 'usd' }, { label: `${rates.estateTaxRatePct}% Estate Tax`, value: estateTax, kind: 'usd' },
    { label: '% Decrease', value: rates.estateTaxPct, kind: 'pct' } ] }

  // 5 Inheritance Moved into Lifetime: B19 = B17*B18
  S[5] = { id: 5, title: SECTION_TITLES[5], dir: 'up', pctLabel: pctText(rates.lifetimePct), value: estate * (rates.lifetimePct / 100), steps: [
    { label: 'Total Estate Value', value: estate, kind: 'usd' }, { label: '% Increase', value: rates.lifetimePct, kind: 'pct' } ] }

  // 6 and 7 Wealth failure: E19 = E17*E18, H19 = H17*H18
  S[6] = { id: 6, title: SECTION_TITLES[6], dir: 'down', red: true, pctLabel: pctText(rates.failure1Pct), value: estate * (rates.failure1Pct / 100), steps: [
    { label: 'Total Estate Value', value: estate, kind: 'usd' }, { label: '% Decrease', value: rates.failure1Pct, kind: 'pct' } ] }
  S[7] = { id: 7, title: SECTION_TITLES[7], dir: 'down', red: true, pctLabel: pctText(rates.failure3Pct), value: estate * (rates.failure3Pct / 100), steps: [
    { label: 'Total Estate Value', value: estate, kind: 'usd' }, { label: '% Decrease', value: rates.failure3Pct, kind: 'pct' } ] }

  // 8 Investment Performance: K19 = -FV(K18, B4, B4, K17, 1)  (the payment is the years remaining, as in the workbook), K20 = K19 - K17
  const invest = n(input.investmentAmount), r = rates.growthRatePct / 100
  const totalGrowth = -fv(r, years, years, invest, 1)
  S[8] = { id: 8, title: SECTION_TITLES[8], dir: 'up', pctLabel: pctText(rates.growthRatePct), value: totalGrowth - invest, steps: [
    { label: 'Current Investment Amount', value: invest, kind: 'usd' }, { label: '% Increase extra performance', value: rates.growthRatePct, kind: 'pct' },
    { label: 'Total Growth', value: totalGrowth, kind: 'usd' } ] }

  return { yearsRemaining: years, exemption, sections: S }
}

/** Sections to print for a family: its own checkboxes, else the deck's defaults. Order is always 1..8. */
export function includedSections(include: Partial<Record<SectionId, boolean>> | undefined, variant: 'under5' | 'over5'): SectionId[] {
  const defaults = DEFAULT_INCLUDE[variant]
  return SECTION_IDS.filter((id) => (include && include[id] !== undefined ? Boolean(include[id]) : defaults.includes(id)))
}

/** Age in whole years from an ISO date of birth, or null. */
export function ageFromDob(dob: string | undefined | null, asOf: Date = new Date()): number | null {
  if (!dob) return null
  const d = new Date(`${dob}T00:00:00`)
  if (isNaN(d.getTime())) return null
  let a = asOf.getFullYear() - d.getFullYear()
  if (asOf.getMonth() < d.getMonth() || (asOf.getMonth() === d.getMonth() && asOf.getDate() < d.getDate())) a--
  return a
}

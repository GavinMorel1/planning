import { DEFAULT_FEE_SCHEDULE } from '../lib/fees'

export const DEFAULT_ROSTER = [
  { name: 'Eric L. Dunavant', title: 'Founder & President', photo: 'headshots/eric-l-dunavant.png' },
  { name: 'Drew Brown', title: 'CEO', photo: 'headshots/drew-brown.png' },
  { name: 'Chris Callahan', title: 'Director of Relationship Management', photo: 'headshots/chris-callahan.png' },
  { name: 'Ray Marie Fenger', title: 'Chief Compliance Officer & Director of Operations', photo: 'headshots/ray-marie-fenger.png' },
  { name: 'Dani Wauchope', title: 'Chief Planning Strategist', photo: 'headshots/dani-wauchope.png' },
  { name: 'Carl Drury', title: 'Senior Planning Strategist', photo: 'headshots/carl-drury.png' },
  { name: 'Thea Lowery', title: 'Chief Relational Strategist', photo: 'headshots/thea-lowery.png' },
  { name: 'Caleb Kelso Jr.', title: 'Financial Planning Associate', photo: 'headshots/caleb-kelso-jr.png' },
  { name: 'Matthew Sullivan', title: 'Associate Advisor I', photo: 'headshots/matthew-sullivan.png' },
  { name: 'Domnic Davenport', title: 'Investment Planning Associate', photo: 'headshots/domnic-davenport.png' },
  { name: 'Carson Rich', title: 'Senior Research & Trading Associate', photo: 'headshots/carson-rich.png' },
  { name: 'Gavin Morel', title: 'Executive Operations Assistant', photo: 'headshots/gavin-morel.png' },
]

// Quarterly audited performance. Update in Settings after each audit.
export const DEFAULT_PERFORMANCE = {
  asOf: '2026-06-30',
  dividend: {
    name: '25 Stock Dividend Strategy',
    benchmarks: [{ key: 'DVY', label: 'iShares Select Dividend ETF (DVY)' }, { key: 'SPY', label: 'State Street S&P 500 ETF Trust (SPY)' }],
    annualized: {
      columns: ['YTD', '1-YR', '3-YR', '5-YR', '10-YR'],
      gross: [15.15, 30.49, 22.54, 16.32, 14.37],
      net: [14.29, 28.55, 20.72, 14.59, 12.67],
      DVY: [12.47, 21.95, 15.61, 9.91, 10.09],
      SPY: [null, 22.21, 20.48, 13.29, 15.39],
    },
    calendar: {
      columns: ['2025', '2024', '2023', '2022', '2021'],
      gross: [17.74, 19.18, 26.41, -0.79, 29.37],
      net: [15.98, 17.41, 24.53, -2.27, 27.44],
      DVY: [11.60, 16.24, 1.12, 10.09, 31.70],
      SPY: [17.72, 24.89, 26.18, -18.18, 28.73],
    },
    disclosure: "Paradiem, LLC is a Registered Investment Advisor. Performance is based on actual client accounts that are invested in Paradiem's Dividend strategy. Past performance is no guarantee of future results. Returns presented include the reinvestment of all income. Gross-of-fee performance includes trading expenses and custodial expenses. Net-of-fee performance includes actual account-level gross returns, less a model investment management fee. The model fee is deducted monthly from composite returns at the rate of 1/12 of Paradiem's highest annual fee tier. The highest rate of our annual fixed fee is 1.5%. The iShares Select Dividend ETF fund generally will invest at least 80% of its assets in the component securities of its underlying index and in investments that have economic characteristics that are substantially identical to the component securities of its underlying index. The underlying index measures the performance of the U.S.'s leading stocks by dividend yield.",
  },
  growth: {
    name: '25 Stock Growth Strategy',
    benchmarks: [{ key: 'IUSG', label: 'iShares Core S&P U.S. Growth ETF (IUSG)' }, { key: 'SPY', label: 'State Street S&P 500 ETF Trust (SPY)' }],
    annualized: {
      columns: ['1-MO', '3-MO', 'TR 5-MO'],
      gross: [3.89, 28.58, 23.80],
      net: [3.76, 28.10, 23.03],
      IUSG: [-1.72, 21.42, 11.39],
      SPY: [-1.03, 15.12, 8.49],
    },
    calendar: null,
    disclosure: "Paradiem, LLC is a Registered Investment Advisor. Performance is based on actual client accounts that are invested in Paradiem's Growth strategy. Past performance is no guarantee of future results. Returns presented include the reinvestment of all income. Gross-of-fee performance includes trading expenses and custodial expenses. Net-of-fee performance includes actual account-level gross returns, less a model investment management fee. The model fee is deducted monthly from composite returns at the rate of 1/12 of Paradiem's highest annual fee tier. The highest rate of our annual fixed fee is 1.5%.",
  },
}

// Yearly tax constants. Verify each January and after any legislation.
export const DEFAULT_TAX = {
  2026: {
    estateExemption: 15000000, gstExemption: 15000000, annualExclusion: 19000, estateTaxRate: 40,
    topOrdinaryRate: 37, ltcgRate: 20, niit: 3.8, recaptureRate: 25, corporateRate: 21,
    qsbsCap: 15000000, qofWindowDays: 180, exch1031IdDays: 45, exch1031CloseDays: 180,
    charitableAgiFloorPct: 0.5, charitableCashAgiLimitPct: 60, charitableApprecAgiLimitPct: 30,
    iraLimit: 7500, iraCatchUp: 1100, k401Limit: 24500, k401CatchUp: 8000,
    note: 'OBBBA (July 4, 2025) set the exemption at $15M per person from 2026, indexed. Verify all figures with the tax team.',
  },
}

export const DEFAULT_SETTINGS = {
  roster: DEFAULT_ROSTER,
  performance: DEFAULT_PERFORMANCE,
  tax: DEFAULT_TAX,
  feeSchedule: DEFAULT_FEE_SCHEDULE,
  firmAverages: {
    generosity: { pct: '422%', label: 'Increase in Lifetime Generosity', amount: 14770000, dir: 'up' },
    estateTax: { pct: '90.89%', label: 'Reduction of Estate Taxes', amount: 5453400, dir: 'down' },
    lifetime: { pct: '20.27%', label: 'Inheritance Moved into Lifetime', amount: 3648600, dir: 'up' },
    failure: { pct: '70%', label: 'Family Capital Failure After First Generation*', amount: 12600700, dir: 'down', footnote: '*NY Post, April 2017' },
    performance: { pct: '10.93%', label: 'Potential Portfolio Performance**', amount: 656036, dir: 'up', footnote: '**2% net over index' },
  },
  theme: 'auto',
}

// Static slide copy shared by every deck.
export const COPY = {
  footerLeft: 'PARADIEM  |  FAMILY CAPITAL ARCHITECTURE',
  footerRight: 'CONFIDENTIAL  —  NOT FOR DISTRIBUTION',
  tagline: 'Aligning Family & Capital With a 100-Year Vision',
  disclosures: [
    'Paradiem, LLC is a Registered Investment Advisor.',
    'This presentation is provided for informational and educational purposes only and is intended solely for the recipient. It is not intended as, and should not be construed as, personalized investment advice, a recommendation, or an offer to buy or sell any security or to adopt any investment strategy.',
    "Any references to investment strategies, portfolio construction, or planning concepts are general in nature and may not be suitable for all individuals. Investment decisions should be made based on an individual's specific financial situation, objectives, risk tolerance, and time horizon, and in consultation with appropriate financial, tax, and legal advisors.",
    'All investing involves risk, including the potential loss of principal. Past performance is not indicative of future results. Any forward-looking statements, projections, or scenario analyses are hypothetical in nature, subject to significant limitations, and do not reflect actual results. There is no guarantee that any investment objective or strategy will be achieved.',
    'Where performance results are shown or discussed, additional information regarding calculation methodologies, time periods, benchmarks, and material assumptions is available upon request. Any comparisons to benchmarks or indices are provided for illustrative purposes only, and such indices may differ significantly from the strategy described.',
    'Paradiem, LLC may utilize third-party data, research, or tools believed to be reliable; however, the accuracy and completeness of such information cannot be guaranteed. Any opinions expressed are as of the date of the presentation and are subject to change without notice.',
    'Advisory services are only offered to clients or prospective clients where Paradiem and its representatives are properly licensed or exempt from registration.',
    'Additional information about Paradiem, LLC including its Form ADV Part 2A (Firm Brochure), is available upon request or at www.adviserinfo.sec.gov.',
  ],
  hypothetical: 'The information presented is hypothetical and for illustrative purposes only. It is based on assumptions, estimates, and inputs provided or derived from current information, all of which are subject to change. These projections do not reflect actual investment results and are not guarantees of future performance or outcomes. Actual results will vary and may differ materially based on market conditions, investment decisions, tax law changes, and other factors. This analysis is intended to support discussion and planning and should not be relied upon as a prediction of future results or as a recommendation to take any specific action.',
  firmAveragesFootnote: '(*"Most rich families will lose it all", Catey Hill, New York Post, April 24, 2017) [**Past Performance is no guarantee of future results.]',
  riskDisclosure: "Potential performance was calculated using an average of four measurements: Average Annual Return, Last 10 Years, Last 30 Years, and Long-Term Consensus. Long-term consensus uses an average of 10.4% for the S&P 500, 0bps change in the Ten-Year US Treasury Rate, and correlation and volatility data from 2008 to present. The Six Month 95% Probability Range is calculated from the standard deviation of the portfolio (via covariance matrix), and represents a hypothetical statistical probability, but there is no guarantee any investments would perform within the range. There is a 5% probability of greater losses. IMPORTANT: The projections or other information generated regarding the likelihood of various investment outcomes are hypothetical in nature, do not reflect actual investment results and are not guarantees of future results. These figures may exclude commissions, sales charges or fees which, if included, would have had a negative effect on the annual returns.",
  caseStudyFootnote: 'Case studies are for informational and illustrative purposes only and not to be considered a guarantee of results. Actual results will vary with each situation.',
  blueprint: {
    columns: [
      { title: '100-Year Vision', items: ['Goal & Vision Alignment', 'Advisory Collaboration', 'Implementation Guidance', 'Annual Calibration', 'Community Events'] },
      { title: 'Preparing the Family for the Money', items: ['Legacy Alignment', 'Inheritance Optimization', 'Family Advocacy'] },
      { title: 'Preparing the Money for the Family', items: ['Cash Flow Prioritization', 'Tax Planning', 'Business Strategy', 'Estate Planning', 'Investment Strategy', 'Charitable Optimization'] },
    ],
  },
  nextStepOver5: {
    question: 'Is your family & capital aligned to sustain 100+ years — or exposed to silent erosion?',
    bullets: [
      ['100-Year Vision Clarity', 'Defined multi-generational intention, alignment, and legacy purpose'],
      ['Family Preparedness', 'Spousal alignment, next-generation readiness, governance structure'],
      ['Capital Architecture', 'Asset alignment, tax exposure, liquidity, generosity optimization'],
      ['Risk & Opportunity', 'Hidden vulnerabilities, concentration blind spots, leverage opportunities'],
      ['Cost of Inaction', 'Quantified analysis of what staying where you are actually costs'],
    ],
    phases: [
      ['Structural Diagnostic', 'Recent tax returns, current balance sheet, legal and trust docs, income streams & liquidity structures'],
      ['Family Alignment Review', 'Three focused alignment surveys, 90-min strategic interview, spousal & leadership alignment review'],
      ['Capital Architecture Modeling & Roadmap', 'Structural capital analysis, risk & erosion modeling, tax & transfer opportunity identification, generational impact planning'],
    ],
    delivery: 'Delivery 1-2 weeks after all data received',
  },
  nextStepUnder5A: {
    question: 'Is your family & capital aligned to sustain 100+ years — or exposed to silent erosion?',
    bullets: [
      ['100-Year Vision Clarity', 'Defined multi-generational intention, alignment, and legacy purpose'],
      ['Family Preparedness', 'Spousal alignment, next-generation readiness, governance structure'],
      ['Capital Architecture', 'Asset alignment, tax exposure, liquidity, generosity optimization'],
      ['Risk & Opportunity', 'Hidden vulnerabilities, concentration blind spots, leverage opportunities'],
    ],
    phases: [
      ['Structural Diagnostic', 'Recent tax return, current balance sheet, legal and trust docs, income streams & liquidity structures'],
      ['Family Alignment Review', 'Three focused alignment surveys, 90-min strategic interview, spousal & leadership alignment review'],
      ['Capital Architecture Modeling & Roadmap', 'Structural capital analysis, risk & erosion modeling, investment guidance, tax & transfer opportunity identification, generational impact planning'],
    ],
  },
  nextStepUnder5B: {
    question: "Is everything set up to take care of you for life — and is anyone watching for what you can't see?",
    bullets: [
      ['Dependable Income', 'Sustainable withdrawals, inflation protection, cash-flow confidence'],
      ['A Clear Picture', 'Cash flow, assets, and accounts coordinated into one view'],
      ['Protection & Advocacy', 'Guidance on wills, directives, beneficiaries, and the gaps you might miss'],
      ['Family Preparedness', "Spousal alignment, heirs' readiness, and who's ready to step in"],
    ],
    phases: [
      ['Financial Picture Review', 'Current accounts, income sources, balance sheet, and legal documents, gathered in one place'],
      ['Goals & Alignment Review', 'A focused strategic interview into your income needs, wishes, and concerns; spousal & leadership alignment review'],
      ['Capital Architecture Roadmap', 'Income strategy, protection gaps addressed, investment guidance, and a clear path forward'],
    ],
  },
}

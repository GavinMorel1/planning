// Derive family "flags" from the profile, documents and goals. Tools declare which flags make
// them a candidate. Keep this readable: the planner sees the flag list in the Priorities tab.
import { DOC_CATEGORIES } from '../data/docCategories'
import { ageFrom, num } from './util'

const COMMUNITY_PROPERTY = ['AZ', 'CA', 'ID', 'LA', 'NV', 'NM', 'TX', 'WA', 'WI']

export function familyFlags(f, tax) {
  if (!f) return []
  const flags = new Set()
  const p = f.profile || {}
  const goalsText = (f.goals || []).map((g) => g.text || '').join(' ').toLowerCase() + ' ' + (p.vision || '').toLowerCase()
  const has = (re) => re.test(goalsText)
  const children = f.children || []
  const netWorth = num(f.netWorth)
  const exemption = tax?.estateExemption || 15000000
  const spouses = [p.spouse1, p.spouse2].filter((s) => s && s.name)
  const married = spouses.length === 2

  if (married) flags.add('married')
  if (children.length) flags.add('has_children')
  const ages = children.map((c) => ageFrom(c.dob)).filter((a) => a != null)
  if (ages.some((a) => a < 18)) flags.add('minor_children')
  if (ages.some((a) => a >= 18)) flags.add('adult_children')
  if (children.some((c) => ageFrom(c.dob) >= 18 && !c.married)) flags.add('unmarried_adult_children')
  if (children.some((c) => c.inBusiness)) flags.add('children_in_business')
  if (children.some((c) => c.specialNeeds)) flags.add('special_needs')
  if (num(p.grandchildren) > 0 || has(/grandchild/)) flags.add('grandchildren')
  if (children.length || p.dependents) flags.add('dependents')
  if (COMMUNITY_PROPERTY.includes((p.state || '').toUpperCase())) flags.add('community_property_state'); else if (p.state) flags.add('not_community_property_state')
  if (p.secondMarriage) flags.add('second_marriage')
  if (p.healthConcern) flags.add('health_concern')

  // Business
  const biz = f.business || {}
  if (biz.owner) {
    flags.add('business_owner')
    if (biz.entity === 'c_corp') flags.add('c_corp')
    if (biz.entity === 's_corp') flags.add('s_corp')
    if (biz.entity === 'partnership' || biz.entity === 'llc') flags.add('partnership')
    if (num(biz.otherOwners) > 0) flags.add('multiple_owners')
    if (biz.keyEmployees) flags.add('key_employees')
    const horizon = num(biz.saleHorizonYears)
    if (biz.salePending || (horizon > 0 && horizon <= 2)) flags.add('business_sale_pending')
    if (biz.salePending || (horizon > 0 && horizon <= 10)) flags.add('business_sale_horizon')
    if (!biz.successionPlan) flags.add('no_succession_plan')
    if (!biz.successor && !children.some((c) => c.inBusiness)) flags.add('no_successor')
  }
  if (p.equityComp) flags.add('equity_comp')

  // Assets
  const assets = (f.balanceSheet?.assets || [])
  const byType = (t) => assets.filter((a) => a.type === t).reduce((s, a) => s + num(a.value), 0)
  if (byType('rental_real_estate') > 0) { flags.add('rental_real_estate'); flags.add('real_estate') }
  if (byType('residence') > 0) { flags.add('residence_owned'); flags.add('real_estate') }
  if (byType('vacation_home') > 0) { flags.add('vacation_home'); flags.add('real_estate') }
  if (byType('retirement') > 250000) flags.add('retirement_accounts')
  if (byType('taxable') > 250000) flags.add('taxable_portfolio')
  if (byType('concentrated') > 0) { flags.add('concentrated_position'); flags.add('appreciated_assets') }
  if (byType('business') > 0 || byType('rental_real_estate') > 0 || byType('concentrated') > 0) flags.add('appreciated_assets')
  if (assets.some((a) => a.salePending)) { flags.add('real_estate_sale_pending') }
  if (p.recentLiquidity) flags.add('recent_liquidity')
  if (p.existingLifeInsurance) flags.add('existing_life_insurance')
  const liab = (f.balanceSheet?.liabilities || []).reduce((s, l) => s + num(l.value), 0)
  if (liab > 0) flags.add('debt')
  const liquid = byType('cash') + byType('taxable')
  if (netWorth > 0 && liquid / netWorth < 0.2 && netWorth > exemption) flags.add('illiquid_estate')

  // Income
  const income = num(p.householdIncome)
  if (income >= 500000) flags.add('high_income')
  if (income >= 2000000) flags.add('very_high_income')
  if (p.lowIncomeYear) flags.add('low_income_year')
  if (spouses.some((s) => ageFrom(s.dob) >= 62) || p.retired) flags.add('retiree')
  if (spouses.length === 1 || p.singleIncome) flags.add('single_income')
  if (has(/income|lifestyle|spending|retire/)) flags.add('income_need')

  // Estate tax
  const combinedExemption = exemption * (married ? 2 : 1)
  if (netWorth > combinedExemption * 0.8) flags.add('estate_tax_exposure')
  if (p.inheritanceExpected) flags.add('inheritance_expected')
  if (p.multiStateProperty) flags.add('multi_state_property')

  // Intent from goals & vision
  if (has(/charit|giv|generos|tithe|donat|foundation|kingdom|ministry/)) flags.add('charitable_intent')
  if (has(/\$?\d+\s?(m|million).*(charit|giv)|foundation/)) flags.add('large_charitable_gift')
  if (has(/lifetime|during (our|my) life|while (we|i) (are|am) (alive|living)|help along the way/)) flags.add('lifetime_inheritance')
  if (has(/education|college|tuition|school/)) flags.add('education_goal')
  if (has(/100|hundred|generation|legacy|grandchild|steward/)) flags.add('hundred_year_vision')
  if (has(/protect|creditor|lawsuit|liabil/)) flags.add('asset_protection')
  if (has(/parent|mother|father|mom|dad/)) flags.add('parents_supported')

  // Documents
  const status = (id) => f.documents?.[id]?.status || 'missing'
  if (status('wills') === 'missing') flags.add('no_will')
  if (status('rlt') === 'missing') flags.add('no_rlt')
  if (status('poa') === 'missing') flags.add('no_poa')
  if (biz.owner && status('buysell') === 'missing') flags.add('no_buysell')
  if (biz.owner && status('operating') === 'missing') flags.add('no_operating_agreement')
  if (status('insurance') === 'missing' && (flags.has('minor_children') || flags.has('debt'))) flags.add('insurance_gap')
  const docYear = num(p.documentsYear)
  if (docYear && new Date().getFullYear() - docYear >= 6) flags.add('stale_documents')
  if (p.unfundedAccounts) flags.add('unfunded_accounts')

  return [...flags]
}

export const FLAG_LABELS = {
  married: 'Married', has_children: 'Has children', minor_children: 'Minor children', adult_children: 'Adult children',
  unmarried_adult_children: 'Unmarried adult children', children_in_business: 'Children in the business', special_needs: 'Special-needs beneficiary',
  grandchildren: 'Grandchildren', dependents: 'Dependents', community_property_state: 'Community-property state', not_community_property_state: 'Common-law state',
  second_marriage: 'Second marriage', health_concern: 'Health concern', business_owner: 'Business owner', c_corp: 'C-corporation', s_corp: 'S-corporation',
  partnership: 'Partnership / LLC', multiple_owners: 'Multiple owners', key_employees: 'Key employees', business_sale_pending: 'Business sale within 2 years',
  business_sale_horizon: 'Business sale within 10 years', no_succession_plan: 'No written succession plan', no_successor: 'No identified successor', equity_comp: 'Equity compensation',
  rental_real_estate: 'Rental real estate', real_estate: 'Real estate', residence_owned: 'Owns residence', vacation_home: 'Vacation home', retirement_accounts: 'Large retirement accounts',
  taxable_portfolio: 'Taxable portfolio', concentrated_position: 'Concentrated position', appreciated_assets: 'Appreciated assets', real_estate_sale_pending: 'Real estate sale pending',
  recent_liquidity: 'Recent liquidity event', existing_life_insurance: 'Existing life insurance', debt: 'Carries debt', illiquid_estate: 'Illiquid taxable estate',
  high_income: 'Income $500K+', very_high_income: 'Income $2M+', low_income_year: 'Low-income year', retiree: 'Retired / 62+', single_income: 'Single income', income_need: 'Income goal stated',
  estate_tax_exposure: 'Estate tax exposure', inheritance_expected: 'Inheritance expected', multi_state_property: 'Property in multiple states',
  charitable_intent: 'Charitable intent', large_charitable_gift: 'Large charitable gift', lifetime_inheritance: 'Lifetime inheritance goal', education_goal: 'Education goal',
  hundred_year_vision: '100-year vision language', asset_protection: 'Asset protection concern', parents_supported: 'Supports parents',
  no_will: 'No will on file', no_rlt: 'No revocable trust on file', no_poa: 'No POA on file', no_buysell: 'No buy-sell on file', no_operating_agreement: 'No operating agreement on file',
  insurance_gap: 'No insurance on file with dependents or debt', stale_documents: 'Documents 6+ years old', unfunded_accounts: 'Accounts not titled to trust', esop_sale: 'ESOP sale',
}

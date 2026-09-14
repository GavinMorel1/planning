// Case studies from the Family Capital Assessment deck. Tool suggests by archetype; planner picks.
export const CASE_STUDIES = [
  {
    id: 'hall', family: 'The Hall Family', archetype: 'Generational Real Estate Wealth Builder', tags: ['real_estate', 'inheritance_expected', 'charitable_intent', 'next_gen_business'],
    situation: [
      'Couple in their mid-50s with two adult sons',
      'Commercial real estate portfolio performing well — less than 30% leveraged',
      'In line to inherit an additional $80M of commercial real estate from his parents when they pass',
      'One son considering real estate career but uncertain about continuing the family business',
      'Wanted to gift their inheritance to charity throughout their lifetime but were unsure if they could maintain their lifestyle and inheritance goals without those assets',
      'Wanted to give $10M to charity from their inheritance but unsure how to get liquidity',
    ],
    results: [
      { label: 'Lifetime Income', value: '-24%', dir: 'down' }, { label: 'Lifetime Inheritance', value: '+3200%', dir: 'up' },
      { label: 'Income Taxes', value: '-39%', dir: 'down' }, { label: 'Inheritance Taxes', value: '-100%', dir: 'down' },
      { label: 'Lifetime Giving', value: '+564%', dir: 'up' }, { label: 'Total Giving', value: '+446%', dir: 'up' },
    ],
  },
  {
    id: 'patterson', family: 'The Patterson Family', archetype: 'Growing the Business', tags: ['business_owner', 'young_children', 'business_sale_horizon', 'debt'],
    situation: [
      'Couple in late 30s / early 40s — two young children',
      'Basic legal documents transferring entire estate to children at death',
      'No plans for lifetime inheritance',
      'Rapidly growing business — exit horizon 5–10 years',
      'Two business loans + mortgage totaling 12% of assets',
    ],
    results: [
      { label: 'Lifetime Income', value: '+88%', dir: 'up' }, { label: 'Business Value', value: '+100%', dir: 'up' },
      { label: 'Income Taxes', value: '-38.3%', dir: 'down' }, { label: 'Inheritance Taxes', value: 'Eliminated', dir: 'down' },
      { label: 'Lifetime Giving', value: '+1000%', dir: 'up' }, { label: 'Total Giving', value: '+1000%', dir: 'up' },
    ],
  },
  {
    id: 'baker', family: 'The Baker Family', archetype: 'Generational Business', tags: ['business_owner', 'children_in_business', 'equalize_inheritance', 'charitable_intent', 'grandchildren'],
    situation: [
      "Couple in their mid 60's with 3 children and 8 grandchildren",
      'The family owned a business; 2 of 3 children were active in the business',
      "Mr. Baker's brother also owned a portion of the business but wasn't active",
      'They wanted to give the business to active children and equalize inheritance for the non-active child',
      'They already had trusts set up for each child and wanted to include the family in charitable giving',
    ],
    results: [
      { label: 'Lifetime Income', value: '+117%', dir: 'up' }, { label: 'Lifetime Inheritance', value: '+339%', dir: 'up' },
      { label: 'Income Taxes', value: '-33%', dir: 'down' }, { label: 'Inheritance Taxes', value: 'Eliminated', dir: 'down' },
      { label: 'Lifetime Giving', value: '+397%', dir: 'up' }, { label: 'Total Giving', value: '+1000%', dir: 'up' },
    ],
  },
  {
    id: 'bennett', family: 'The Bennett Family', archetype: 'Selling the Business', tags: ['business_owner', 'business_sale_pending', 'equalize_inheritance', 'lifetime_inheritance'],
    situation: [
      "Couple in their early 50's with 3 children",
      'They had already set up a trust for each child providing a small lifetime inheritance',
      'They wanted to provide an additional lifetime inheritance to their children',
      "They wanted to equalize inheritances as they'd provided a college education and down payment for their oldest and college for the middle child",
      'They had a business being prepared for a future IPO or sale',
    ],
    results: [
      { label: 'Lifetime Income', value: '+80%', dir: 'up' }, { label: 'Lifetime Inheritance', value: '+378%', dir: 'up' },
      { label: 'Income Taxes', value: '+48%', dir: 'up' }, { label: 'Capital Gains Taxes', value: '-68%', dir: 'down' },
      { label: 'Lifetime Giving', value: '+823%', dir: 'up' }, { label: 'Total Giving', value: '+1000%', dir: 'up' },
    ],
  },
]

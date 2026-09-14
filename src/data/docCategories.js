// Document checklist — mirrors the Pipefile request list. Not every category is required;
// the client uploads what they have. Status per category: received | na | missing.
export const DOC_CATEGORIES = [
  { id: 'wills', label: 'Wills', group: 'Legal', kind: 'legal', protect: true },
  { id: 'rlt', label: 'Revocable Trust and Amendments', group: 'Legal', kind: 'legal', protect: true },
  { id: 'poa', label: 'Power of Attorney (General and Healthcare)', group: 'Legal', kind: 'legal', protect: true },
  { id: 'foundation', label: 'Family Foundation', group: 'Legal', kind: 'legal' },
  { id: 'nuptial', label: 'Pre-Nuptial and Post-Nuptial Agreements', group: 'Legal', kind: 'legal' },
  { id: 'operating', label: 'Operating Agreements', group: 'Business', kind: 'legal' },
  { id: 'buysell', label: 'Buy-Sell Agreements', group: 'Business', kind: 'legal' },
  { id: 'deeds', label: 'Deeds', group: 'Legal', kind: 'legal' },
  { id: 'insurance', label: 'Insurance Policies', group: 'Financial', kind: 'financial' },
  { id: 'pfs', label: 'Personal Financial Statement', group: 'Financial', kind: 'financial' },
  { id: 'statements', label: 'Investment Account Statements', group: 'Financial', kind: 'financial' },
  { id: 'ssa', label: 'Social Security Statements', group: 'Financial', kind: 'financial' },
  { id: 'tax_personal', label: 'Personal Tax Returns (previous two years)', group: 'Tax', kind: 'tax' },
  { id: 'tax_gift', label: 'Most Recent Gift Tax Returns (Form 709)', group: 'Tax', kind: 'tax' },
  { id: 'tax_business', label: 'Business Tax Returns (previous two years)', group: 'Tax', kind: 'tax' },
  { id: 'survey_financial', label: 'Financial Assessment Survey', group: 'Surveys', kind: 'survey' },
  { id: 'survey_family', label: 'Family Assessment Survey', group: 'Surveys', kind: 'survey' },
  { id: 'survey_info', label: 'Family Information & Assumptions Survey', group: 'Surveys', kind: 'survey' },
  { id: 'constitution', label: 'Family Constitution Documents', group: 'Family', kind: 'family' },
  { id: 'conflict', label: 'Conflict Resolution Guidelines', group: 'Family', kind: 'family' },
  { id: 'emoney', label: 'eMoney Reports', group: 'Planning', kind: 'planning' },
  { id: 'goals', label: 'Goals & Intentions Document', group: 'Planning', kind: 'planning' },
  { id: 'other', label: 'Other', group: 'Other', kind: 'other' },
]
export const DOC_GROUPS = ['Legal', 'Business', 'Financial', 'Tax', 'Surveys', 'Family', 'Planning', 'Other']
export const docCategory = (id) => DOC_CATEGORIES.find((c) => c.id === id)

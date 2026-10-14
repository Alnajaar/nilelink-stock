UPDATE site_content
SET draft_json = json_set(
  draft_json,
  '$.pageLabels', json_object(
    'navFeatures', 'Features',
    'navPricing', 'Plans & Pricing',
    'navBranches', 'Multi-Branch Chains',
    'navHowItWorks', 'How it works',
    'ownerSignIn', 'Owner Sign In',
    'heroSecondaryCta', 'Explore features',
    'popularPlanBadge', 'MOST POPULAR FOR BUSY CAFES',
    'branchCalculatorHeadline', 'How many branches do you operate?',
    'branchCalculatorDescription', 'Adjust slider to see your recommended plan and multi-branch configuration.',
    'branchUnitSingular', 'Store',
    'branchUnitPlural', 'Stores',
    'recommendedPlanLabel', 'Recommended Tier',
    'singleBranchRecommendation', 'Single location',
    'multiBranchRecommendation', 'Multi-branch plan',
    'provisionCta', 'Provision'
  )
),
published_json = json_set(
  published_json,
  '$.pageLabels', json_object(
    'navFeatures', 'Features',
    'navPricing', 'Plans & Pricing',
    'navBranches', 'Multi-Branch Chains',
    'navHowItWorks', 'How it works',
    'ownerSignIn', 'Owner Sign In',
    'heroSecondaryCta', 'Explore features',
    'popularPlanBadge', 'MOST POPULAR FOR BUSY CAFES',
    'branchCalculatorHeadline', 'How many branches do you operate?',
    'branchCalculatorDescription', 'Adjust slider to see your recommended plan and multi-branch configuration.',
    'branchUnitSingular', 'Store',
    'branchUnitPlural', 'Stores',
    'recommendedPlanLabel', 'Recommended Tier',
    'singleBranchRecommendation', 'Single location',
    'multiBranchRecommendation', 'Multi-branch plan',
    'provisionCta', 'Provision'
  )
),
version = version + 1,
updated_at = datetime('now')
WHERE id = 'landing';

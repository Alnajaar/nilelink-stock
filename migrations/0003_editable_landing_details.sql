UPDATE site_content
SET draft_json = json_set(
  draft_json,
  '$.description', CASE
    WHEN json_extract(draft_json, '$.description') = 'Control inventory, reduce waste, and coordinate every location from one place.'
    THEN 'Control inventory, reduce waste, and give your team clearer day-to-day operations.'
    ELSE json_extract(draft_json, '$.description')
  END,
  '$.features', json(CASE
    WHEN json_extract(draft_json, '$.features') = json_array('Stock tracking', 'Branch transfers', 'Waste insights', 'Offline workflows')
    THEN json_array('Stock tracking', 'Team time tracking', 'Waste insights', 'Offline workflows')
    ELSE json_extract(draft_json, '$.features')
  END),
  '$.pricingDescription', CASE
    WHEN json_extract(draft_json, '$.pricingDescription') = 'From a single kiosk with limited items to an expanding multi-branch chain managing thousands of SKUs across multiple locations.'
    THEN 'Compare plans for single-location cafes and growing hospitality teams, with limits that fit your current operation.'
    ELSE json_extract(draft_json, '$.pricingDescription')
  END,
  '$.multiBranchEyebrow', CASE
    WHEN json_extract(draft_json, '$.multiBranchEyebrow') = 'Multi-Location Architecture' THEN 'Hospitality Operations'
    ELSE json_extract(draft_json, '$.multiBranchEyebrow')
  END,
  '$.multiBranchHeadline', CASE
    WHEN json_extract(draft_json, '$.multiBranchHeadline') = 'One Account. Unlimited Branches. Zero Cross-Store Data Leaks.'
    THEN 'Inventory and workforce tools for hospitality teams.'
    ELSE json_extract(draft_json, '$.multiBranchHeadline')
  END,
  '$.multiBranchDescription', CASE
    WHEN json_extract(draft_json, '$.multiBranchDescription') = 'Give each cafe private access to its own stock, and let restaurant groups manage locations from one account.'
    THEN 'Manage stock, record team hours, and review day-to-day operations from one workspace.'
    ELSE json_extract(draft_json, '$.multiBranchDescription')
  END,
  '$.marketingMetrics', json_array(
    json_object('value', 'Inventory', 'label', 'Track stock and adjustments'),
    json_object('value', 'Workforce', 'label', 'Record and review staff hours'),
    json_object('value', 'Offline', 'label', 'Queue supported changes for sync'),
    json_object('value', 'Plans', 'label', 'Set configurable usage limits')
  ),
  '$.multiBranchBenefits', json_array(
    json_object('title', 'Role-based access', 'description', 'Business actions are protected by authenticated, tenant-scoped roles.'),
    json_object('title', 'Inventory records', 'description', 'Record stock movements, waste, and inventory changes.'),
    json_object('title', 'Workforce time tracking', 'description', 'Employees can record shifts and managers can review submitted hours.')
  ),
  '$.branchPreview', json_object(
    'organizationName', 'Example Organization (illustrative)',
    'activeBranchesLabel', '2 SAMPLE LOCATIONS',
    'flagshipName', 'Sample Flagship Location',
    'flagshipDetails', 'Example inventory · Example team · Sample data',
    'secondBranchName', 'Sample Second Location',
    'secondBranchDetails', 'Example inventory · Example team · Sample data',
    'singleBranchNotice', 'Example single-location business (illustrative data):',
    'singleBranchName', 'Sample Cafe',
    'singleBranchDetails', 'Example plan · 1 location'
  )
),
published_json = json_set(
  published_json,
  '$.description', CASE
    WHEN json_extract(published_json, '$.description') = 'Control inventory, reduce waste, and coordinate every location from one place.'
    THEN 'Control inventory, reduce waste, and give your team clearer day-to-day operations.'
    ELSE json_extract(published_json, '$.description')
  END,
  '$.features', json(CASE
    WHEN json_extract(published_json, '$.features') = json_array('Stock tracking', 'Branch transfers', 'Waste insights', 'Offline workflows')
    THEN json_array('Stock tracking', 'Team time tracking', 'Waste insights', 'Offline workflows')
    ELSE json_extract(published_json, '$.features')
  END),
  '$.pricingDescription', CASE
    WHEN json_extract(published_json, '$.pricingDescription') = 'From a single kiosk with limited items to an expanding multi-branch chain managing thousands of SKUs across multiple locations.'
    THEN 'Compare plans for single-location cafes and growing hospitality teams, with limits that fit your current operation.'
    ELSE json_extract(published_json, '$.pricingDescription')
  END,
  '$.multiBranchEyebrow', CASE
    WHEN json_extract(published_json, '$.multiBranchEyebrow') = 'Multi-Location Architecture' THEN 'Hospitality Operations'
    ELSE json_extract(published_json, '$.multiBranchEyebrow')
  END,
  '$.multiBranchHeadline', CASE
    WHEN json_extract(published_json, '$.multiBranchHeadline') = 'One Account. Unlimited Branches. Zero Cross-Store Data Leaks.'
    THEN 'Inventory and workforce tools for hospitality teams.'
    ELSE json_extract(published_json, '$.multiBranchHeadline')
  END,
  '$.multiBranchDescription', CASE
    WHEN json_extract(published_json, '$.multiBranchDescription') = 'Give each cafe private access to its own stock, and let restaurant groups manage locations from one account.'
    THEN 'Manage stock, record team hours, and review day-to-day operations from one workspace.'
    ELSE json_extract(published_json, '$.multiBranchDescription')
  END,
  '$.marketingMetrics', json_array(
    json_object('value', 'Inventory', 'label', 'Track stock and adjustments'),
    json_object('value', 'Workforce', 'label', 'Record and review staff hours'),
    json_object('value', 'Offline', 'label', 'Queue supported changes for sync'),
    json_object('value', 'Plans', 'label', 'Set configurable usage limits')
  ),
  '$.multiBranchBenefits', json_array(
    json_object('title', 'Role-based access', 'description', 'Business actions are protected by authenticated, tenant-scoped roles.'),
    json_object('title', 'Inventory records', 'description', 'Record stock movements, waste, and inventory changes.'),
    json_object('title', 'Workforce time tracking', 'description', 'Employees can record shifts and managers can review submitted hours.')
  ),
  '$.branchPreview', json_object(
    'organizationName', 'Example Organization (illustrative)',
    'activeBranchesLabel', '2 SAMPLE LOCATIONS',
    'flagshipName', 'Sample Flagship Location',
    'flagshipDetails', 'Example inventory · Example team · Sample data',
    'secondBranchName', 'Sample Second Location',
    'secondBranchDetails', 'Example inventory · Example team · Sample data',
    'singleBranchNotice', 'Example single-location business (illustrative data):',
    'singleBranchName', 'Sample Cafe',
    'singleBranchDetails', 'Example plan · 1 location'
  )
),
version = version + 1,
updated_at = datetime('now')
WHERE id = 'landing';

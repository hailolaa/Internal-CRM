UPDATE `growth_package` gp
JOIN (
  SELECT
    'Free Clinic Growth Audit' AS `name`,
    JSON_ARRAY(JSON_OBJECT(
      'category', 'Audit',
      'title', 'Outside-in growth audit',
      'description', 'Review the public clinic journey and identify the first commercial gaps to verify.',
      'frequency', 'One-off',
      'quantityLimit', 'One clinic journey',
      'treatmentsAndLocations', 'Selected clinic services and locations reviewed from public information',
      'dependency', 'Public website, source context and decision-maker input',
      'owner', 'Provide public clinic context and decision-maker input.',
      'exclusion', 'Connected ClinicGrower OS data, paid media management and implementation delivery',
      'thirdPartyCosts', 'No paid media included.',
      'inclusionStatus', 'included',
      'deliveryType', 'one_off',
      'isOptionalAddOn', false,
      'approvalStatus', 'not_required',
      'sortOrder', 10
    )) AS `v5_scope_items`
  UNION ALL SELECT
    'Growth Diagnostic',
    JSON_ARRAY(JSON_OBJECT(
      'category', 'Diagnosis',
      'title', 'Monthly diagnostic and priority recommendations',
      'description', 'Diagnose the commercial gaps holding back enquiries, bookings and recorded value.',
      'frequency', 'Monthly',
      'quantityLimit', 'One priority journey',
      'treatmentsAndLocations', 'Selected services and locations confirmed in discovery',
      'dependency', 'Confirmed access and source data',
      'owner', 'Confirm source access and attend the review cadence.',
      'exclusion', 'Managed media, delivery execution and custom reporting builds',
      'thirdPartyCosts', 'Paid media and third-party tools remain separate.',
      'inclusionStatus', 'included',
      'deliveryType', 'recurring',
      'isOptionalAddOn', false,
      'approvalStatus', 'not_required',
      'sortOrder', 10
    ))
  UNION ALL SELECT
    'Lead Concierge',
    JSON_ARRAY(JSON_OBJECT(
      'category', 'Lead Handling',
      'title', 'Lead response ownership and follow-up visibility',
      'description', 'Make response ownership, overdue follow-up and next actions visible for valuable enquiries.',
      'frequency', 'Weekly',
      'quantityLimit', 'One lead-handling journey',
      'treatmentsAndLocations', 'Selected priority services confirmed in discovery',
      'dependency', 'Enquiry source access and agreed response standard',
      'owner', 'Confirm enquiry handling owners and response standards.',
      'exclusion', 'New website builds, paid media management and outsourced reception',
      'thirdPartyCosts', 'Messaging, phone and provider costs remain separate.',
      'inclusionStatus', 'included',
      'deliveryType', 'recurring',
      'isOptionalAddOn', false,
      'approvalStatus', 'not_required',
      'sortOrder', 10
    ))
  UNION ALL SELECT
    'Starter Engine',
    JSON_ARRAY(JSON_OBJECT(
      'category', 'ClinicGrower OS',
      'title', 'Starter growth operating rhythm',
      'description', 'Establish a lighter operating rhythm around one priority journey.',
      'frequency', 'Monthly with weekly exceptions',
      'quantityLimit', 'One priority journey',
      'treatmentsAndLocations', 'Selected clinic service journey',
      'dependency', 'Tracking access and agreed owner responsibilities',
      'owner', 'Approve the first priority journey and provide tracking access.',
      'exclusion', 'Multi-location delivery, custom integrations and expanded campaign sets',
      'thirdPartyCosts', 'Paid media and third-party tools remain separate.',
      'inclusionStatus', 'included',
      'deliveryType', 'recurring',
      'isOptionalAddOn', false,
      'approvalStatus', 'not_required',
      'sortOrder', 10
    ))
  UNION ALL SELECT
    'Growth Partner',
    JSON_ARRAY(JSON_OBJECT(
      'category', 'Growth Management',
      'title', 'Growth accountability layer',
      'description', 'Operate the clinic journey, response ownership and growth priorities through a broader accountability rhythm.',
      'frequency', 'Monthly strategy with weekly exceptions',
      'quantityLimit', 'Approved priority journey set',
      'treatmentsAndLocations', 'Selected priority services and locations',
      'dependency', 'Source access, claims approval and clinic-side ownership',
      'owner', 'Approve journey priorities, claims and clinic-side actions.',
      'exclusion', 'Additional locations, bespoke development and unsupported data sources',
      'thirdPartyCosts', 'Paid media and third-party tools remain separate.',
      'inclusionStatus', 'included',
      'deliveryType', 'recurring',
      'isOptionalAddOn', false,
      'approvalStatus', 'not_required',
      'sortOrder', 10
    ))
  UNION ALL SELECT
    'Clinic Growth Engine',
    JSON_ARRAY(JSON_OBJECT(
      'category', 'ClinicGrower OS',
      'title', 'ClinicGrower OS commercial layer',
      'description', 'Turn patient demand into visible, accountable progression and recorded value for the selected journey.',
      'frequency', '90-day implementation, weekly exceptions and monthly strategy',
      'quantityLimit', 'One selected commercial operating journey',
      'treatmentsAndLocations', 'Priority services and locations selected in discovery',
      'dependency', 'Source access, media approval, capacity confirmation and human review',
      'owner', 'Provide source access, approve media claims and confirm capacity.',
      'exclusion', 'Photography, outsourced reception, new websites and unapproved service lines',
      'thirdPartyCosts', 'Selected platform media and third-party tools remain separate.',
      'inclusionStatus', 'included',
      'deliveryType', 'recurring',
      'isOptionalAddOn', false,
      'approvalStatus', 'not_required',
      'sortOrder', 10
    ))
  UNION ALL SELECT
    'Growth Engine Plus',
    JSON_ARRAY(JSON_OBJECT(
      'category', 'Expanded ClinicGrower OS',
      'title', 'Expanded multi-journey ClinicGrower OS layer',
      'description', 'Extend the operating layer across more journeys, service lines or locations where approved.',
      'frequency', '90-day implementation, weekly exceptions and monthly strategy',
      'quantityLimit', 'Approved multi-journey scope',
      'treatmentsAndLocations', 'Approved service lines and locations only',
      'dependency', 'Source access, journey owners and approved data connections',
      'owner', 'Confirm owners for each approved journey and provide access.',
      'exclusion', 'Unscoped locations, unsupported integrations and separate creative production',
      'thirdPartyCosts', 'Selected platform media and third-party tools remain separate.',
      'inclusionStatus', 'included',
      'deliveryType', 'recurring',
      'isOptionalAddOn', false,
      'approvalStatus', 'not_required',
      'sortOrder', 10
    ))
  UNION ALL SELECT
    'Market Leader',
    JSON_ARRAY(JSON_OBJECT(
      'category', 'Market Leadership',
      'title', 'Senior market leadership operating system',
      'description', 'Run a senior operating rhythm for clinics ready to lead a market with stronger visibility and accountability.',
      'frequency', 'Senior strategy cadence with weekly exceptions',
      'quantityLimit', 'Approved market leadership scope',
      'treatmentsAndLocations', 'Approved markets, service lines and locations',
      'dependency', 'Senior decision-maker access, source data and approved market priorities',
      'owner', 'Approve senior strategy decisions, access and market priorities.',
      'exclusion', 'Unapproved markets, third-party tools and media spend',
      'thirdPartyCosts', 'Selected platform media and third-party tools remain separate.',
      'inclusionStatus', 'included',
      'deliveryType', 'recurring',
      'isOptionalAddOn', false,
      'approvalStatus', 'not_required',
      'sortOrder', 10
    ))
) scope_seed ON scope_seed.`name` = gp.`name`
SET gp.`commercial_notes` = JSON_MERGE_PATCH(
      COALESCE(gp.`commercial_notes`, JSON_OBJECT()),
      JSON_OBJECT('v5ScopeItems', scope_seed.`v5_scope_items`)
    ),
    gp.`updated_at` = CURRENT_TIMESTAMP
WHERE gp.`deleted_at` IS NULL
  AND gp.`catalogue_version` = 'clinicgrower_v5_2026_08';

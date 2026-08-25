UPDATE `growth_package`
SET `status` = 'archived',
    `updated_at` = CURRENT_TIMESTAMP
WHERE `deleted_at` IS NULL
  AND `name` IN (
    'Clinic Growth Score',
    'Growth Diagnostic',
    'Lead Concierge',
    'Performance OS',
    'Virtual Growth Director',
    'Growth Engine',
    'Starter Engine',
    'Growth Partner',
    'Clinic Growth Engine',
    'Growth Engine Plus'
  );

INSERT INTO `growth_package`
  (`id`, `clinic_id`, `name`, `price_cents`, `currency`, `billing_frequency`, `setup_fee_cents`,
   `included_features`, `internal_notes`, `proposal_wording`, `sort_order`, `status`, `is_default`,
   `catalogue_version`, `commercial_notes`)
SELECT UUID(), c.`id`, seed.`name`, seed.`price_cents`, 'GBP', seed.`billing_frequency`, seed.`setup_fee_cents`,
       seed.`included_features`, seed.`internal_notes`, seed.`proposal_wording`, seed.`sort_order`, 'active', seed.`is_default`,
       'clinicgrower_final_2026_08_23',
       seed.`commercial_notes`
FROM `clinic` c
JOIN (
  SELECT
    'Free Clinic Growth Audit' AS `name`,
    0 AS `price_cents`,
    'one_off' AS `billing_frequency`,
    0 AS `setup_fee_cents`,
    JSON_ARRAY('High-level assessment and qualification', 'Outside-in clinic growth review', 'Recommended next step') AS `included_features`,
    'Final 2026-08-23 public funnel stage. Must not provide the verified numerical Clinic Growth Score.' AS `internal_notes`,
    'Free Clinic Growth Audit gives the clinic a high-level assessment and qualification route before paid diagnostic work.' AS `proposal_wording`,
    10 AS `sort_order`,
    0 AS `is_default`,
    JSON_OBJECT(
      'pricingSource', 'Max final pricing and package update, 2026-08-23.',
      'vatHandling', 'All prices exclude VAT.',
      'mediaSpendHandling', 'Advertising spend is separate and paid directly by the clinic.',
      'standardLocationRule', 'Standard prices are per clinic location.',
      'multiLocationRule', 'Multi-location and group requirements are bespoke.',
      'growthScoreRule', 'Free audit does not provide the verified numerical Clinic Growth Score.',
      'v5ScopeItems', JSON_ARRAY(
        JSON_OBJECT('category', 'Audit', 'item', 'High-level assessment and qualification'),
        JSON_OBJECT('category', 'Review', 'item', 'Outside-in visibility and journey review'),
        JSON_OBJECT('category', 'Next step', 'item', 'Recommendation for diagnostic or programme fit')
      )
    ) AS `commercial_notes`
  UNION ALL SELECT
    'Clinic Growth Diagnostic',
    39500,
    'one_off',
    0,
    JSON_ARRAY('Verified Clinic Growth Score', 'Revenue leakage diagnosis', 'Recommended 90-day plan'),
    'Final 2026-08-23 paid diagnostic funnel stage. GBP 395 + VAT credited against implementation when a monthly programme starts within 30 days.',
    'Clinic Growth Diagnostic unlocks the verified Clinic Growth Score, identifies revenue leakage and provides the recommended 90-day plan.',
    20,
    0,
    JSON_OBJECT(
      'pricingSource', 'Max final pricing and package update, 2026-08-23.',
      'vatHandling', 'All prices exclude VAT.',
      'creditRule', 'GBP 395 is credited against implementation when a clinic starts a monthly programme within 30 days.',
      'mediaSpendHandling', 'Advertising spend is separate and paid directly by the clinic.',
      'standardLocationRule', 'Standard prices are per clinic location.',
      'multiLocationRule', 'Multi-location and group requirements are bespoke.',
      'v5ScopeItems', JSON_ARRAY(
        JSON_OBJECT('category', 'Diagnostic', 'item', 'Verified Clinic Growth Score'),
        JSON_OBJECT('category', 'Commercial', 'item', 'Revenue leakage diagnosis'),
        JSON_OBJECT('category', 'Plan', 'item', 'Recommended 90-day implementation plan')
      )
    )
  UNION ALL SELECT
    'Treatment Growth',
    99500,
    'monthly',
    49500,
    JSON_ARRAY('One location', 'One active treatment', 'One principal acquisition channel', 'One conversion journey'),
    'Final 2026-08-23 monthly package. GBP 995 + VAT per month, GBP 495 + VAT implementation and benchmarking.',
    'Treatment Growth proves measurable growth on one priority treatment.',
    30,
    0,
    JSON_OBJECT(
      'pricingSource', 'Max final pricing and package update, 2026-08-23.',
      'vatHandling', 'All prices exclude VAT.',
      'mediaSpendHandling', 'Advertising spend is separate and paid directly by the clinic.',
      'standardLocationRule', 'Standard prices are per clinic location.',
      'multiLocationRule', 'Multi-location and group requirements are bespoke.',
      'v5ScopeItems', JSON_ARRAY(
        JSON_OBJECT('category', 'Scope', 'item', 'One clinic location'),
        JSON_OBJECT('category', 'Treatment', 'item', 'One active treatment priority'),
        JSON_OBJECT('category', 'Acquisition', 'item', 'One principal acquisition channel'),
        JSON_OBJECT('category', 'Journey', 'item', 'One conversion journey')
      )
    )
  UNION ALL SELECT
    'Clinic Growth',
    199500,
    'monthly',
    99500,
    JSON_ARRAY('One location', 'Up to three active treatment priorities', 'Up to two coordinated acquisition channels', 'Repeatable clinic growth system'),
    'Final 2026-08-23 recommended monthly package. GBP 1,995 + VAT per month, GBP 995 + VAT implementation and benchmarking.',
    'Clinic Growth turns one successful treatment pathway into a repeatable clinic growth system.',
    40,
    1,
    JSON_OBJECT(
      'pricingSource', 'Max final pricing and package update, 2026-08-23.',
      'vatHandling', 'All prices exclude VAT.',
      'mediaSpendHandling', 'Advertising spend is separate and paid directly by the clinic.',
      'standardLocationRule', 'Standard prices are per clinic location.',
      'multiLocationRule', 'Multi-location and group requirements are bespoke.',
      'publicBadge', 'Recommended for established clinics',
      'v5ScopeItems', JSON_ARRAY(
        JSON_OBJECT('category', 'Scope', 'item', 'One clinic location'),
        JSON_OBJECT('category', 'Treatments', 'item', 'Up to three active treatment priorities'),
        JSON_OBJECT('category', 'Acquisition', 'item', 'Up to two coordinated acquisition channels'),
        JSON_OBJECT('category', 'System', 'item', 'Repeatable clinic growth system')
      )
    )
  UNION ALL SELECT
    'Market Leader',
    349500,
    'monthly',
    149500,
    JSON_ARRAY('One location', 'Whole-clinic direction', 'Up to six active treatment priorities', 'Multi-channel growth'),
    'Final 2026-08-23 monthly package. GBP 3,495 + VAT per month, GBP 1,495 + VAT implementation and benchmarking.',
    'Market Leader builds the clinic patients recognise, trust and choose first.',
    50,
    0,
    JSON_OBJECT(
      'pricingSource', 'Max final pricing and package update, 2026-08-23.',
      'vatHandling', 'All prices exclude VAT.',
      'mediaSpendHandling', 'Advertising spend is separate and paid directly by the clinic.',
      'standardLocationRule', 'Standard prices are per clinic location.',
      'multiLocationRule', 'Multi-location and group requirements are bespoke.',
      'v5ScopeItems', JSON_ARRAY(
        JSON_OBJECT('category', 'Scope', 'item', 'One clinic location'),
        JSON_OBJECT('category', 'Direction', 'item', 'Whole-clinic direction'),
        JSON_OBJECT('category', 'Treatments', 'item', 'Up to six active treatment priorities'),
        JSON_OBJECT('category', 'Growth', 'item', 'Multi-channel growth')
      )
    )
) seed
WHERE NOT EXISTS (
  SELECT 1
  FROM `growth_package` existing
  WHERE existing.`clinic_id` = c.`id`
    AND existing.`name` = seed.`name`
    AND existing.`deleted_at` IS NULL
);

UPDATE `growth_package` gp
JOIN (
  SELECT
    'Free Clinic Growth Audit' AS `name`,
    0 AS `price_cents`,
    'one_off' AS `billing_frequency`,
    0 AS `setup_fee_cents`,
    JSON_ARRAY('High-level assessment and qualification', 'Outside-in clinic growth review', 'Recommended next step') AS `included_features`,
    'Final 2026-08-23 public funnel stage. Must not provide the verified numerical Clinic Growth Score.' AS `internal_notes`,
    'Free Clinic Growth Audit gives the clinic a high-level assessment and qualification route before paid diagnostic work.' AS `proposal_wording`,
    10 AS `sort_order`,
    0 AS `is_default`,
    JSON_OBJECT(
      'pricingSource', 'Max final pricing and package update, 2026-08-23.',
      'vatHandling', 'All prices exclude VAT.',
      'mediaSpendHandling', 'Advertising spend is separate and paid directly by the clinic.',
      'standardLocationRule', 'Standard prices are per clinic location.',
      'multiLocationRule', 'Multi-location and group requirements are bespoke.',
      'growthScoreRule', 'Free audit does not provide the verified numerical Clinic Growth Score.',
      'v5ScopeItems', JSON_ARRAY(
        JSON_OBJECT('category', 'Audit', 'item', 'High-level assessment and qualification'),
        JSON_OBJECT('category', 'Review', 'item', 'Outside-in visibility and journey review'),
        JSON_OBJECT('category', 'Next step', 'item', 'Recommendation for diagnostic or programme fit')
      )
    ) AS `commercial_notes`
  UNION ALL SELECT
    'Clinic Growth Diagnostic',
    39500,
    'one_off',
    0,
    JSON_ARRAY('Verified Clinic Growth Score', 'Revenue leakage diagnosis', 'Recommended 90-day plan'),
    'Final 2026-08-23 paid diagnostic funnel stage. GBP 395 + VAT credited against implementation when a monthly programme starts within 30 days.',
    'Clinic Growth Diagnostic unlocks the verified Clinic Growth Score, identifies revenue leakage and provides the recommended 90-day plan.',
    20,
    0,
    JSON_OBJECT(
      'pricingSource', 'Max final pricing and package update, 2026-08-23.',
      'vatHandling', 'All prices exclude VAT.',
      'creditRule', 'GBP 395 is credited against implementation when a clinic starts a monthly programme within 30 days.',
      'mediaSpendHandling', 'Advertising spend is separate and paid directly by the clinic.',
      'standardLocationRule', 'Standard prices are per clinic location.',
      'multiLocationRule', 'Multi-location and group requirements are bespoke.',
      'v5ScopeItems', JSON_ARRAY(
        JSON_OBJECT('category', 'Diagnostic', 'item', 'Verified Clinic Growth Score'),
        JSON_OBJECT('category', 'Commercial', 'item', 'Revenue leakage diagnosis'),
        JSON_OBJECT('category', 'Plan', 'item', 'Recommended 90-day implementation plan')
      )
    )
  UNION ALL SELECT
    'Treatment Growth',
    99500,
    'monthly',
    49500,
    JSON_ARRAY('One location', 'One active treatment', 'One principal acquisition channel', 'One conversion journey'),
    'Final 2026-08-23 monthly package. GBP 995 + VAT per month, GBP 495 + VAT implementation and benchmarking.',
    'Treatment Growth proves measurable growth on one priority treatment.',
    30,
    0,
    JSON_OBJECT(
      'pricingSource', 'Max final pricing and package update, 2026-08-23.',
      'vatHandling', 'All prices exclude VAT.',
      'mediaSpendHandling', 'Advertising spend is separate and paid directly by the clinic.',
      'standardLocationRule', 'Standard prices are per clinic location.',
      'multiLocationRule', 'Multi-location and group requirements are bespoke.',
      'v5ScopeItems', JSON_ARRAY(
        JSON_OBJECT('category', 'Scope', 'item', 'One clinic location'),
        JSON_OBJECT('category', 'Treatment', 'item', 'One active treatment priority'),
        JSON_OBJECT('category', 'Acquisition', 'item', 'One principal acquisition channel'),
        JSON_OBJECT('category', 'Journey', 'item', 'One conversion journey')
      )
    )
  UNION ALL SELECT
    'Clinic Growth',
    199500,
    'monthly',
    99500,
    JSON_ARRAY('One location', 'Up to three active treatment priorities', 'Up to two coordinated acquisition channels', 'Repeatable clinic growth system'),
    'Final 2026-08-23 recommended monthly package. GBP 1,995 + VAT per month, GBP 995 + VAT implementation and benchmarking.',
    'Clinic Growth turns one successful treatment pathway into a repeatable clinic growth system.',
    40,
    1,
    JSON_OBJECT(
      'pricingSource', 'Max final pricing and package update, 2026-08-23.',
      'vatHandling', 'All prices exclude VAT.',
      'mediaSpendHandling', 'Advertising spend is separate and paid directly by the clinic.',
      'standardLocationRule', 'Standard prices are per clinic location.',
      'multiLocationRule', 'Multi-location and group requirements are bespoke.',
      'publicBadge', 'Recommended for established clinics',
      'v5ScopeItems', JSON_ARRAY(
        JSON_OBJECT('category', 'Scope', 'item', 'One clinic location'),
        JSON_OBJECT('category', 'Treatments', 'item', 'Up to three active treatment priorities'),
        JSON_OBJECT('category', 'Acquisition', 'item', 'Up to two coordinated acquisition channels'),
        JSON_OBJECT('category', 'System', 'item', 'Repeatable clinic growth system')
      )
    )
  UNION ALL SELECT
    'Market Leader',
    349500,
    'monthly',
    149500,
    JSON_ARRAY('One location', 'Whole-clinic direction', 'Up to six active treatment priorities', 'Multi-channel growth'),
    'Final 2026-08-23 monthly package. GBP 3,495 + VAT per month, GBP 1,495 + VAT implementation and benchmarking.',
    'Market Leader builds the clinic patients recognise, trust and choose first.',
    50,
    0,
    JSON_OBJECT(
      'pricingSource', 'Max final pricing and package update, 2026-08-23.',
      'vatHandling', 'All prices exclude VAT.',
      'mediaSpendHandling', 'Advertising spend is separate and paid directly by the clinic.',
      'standardLocationRule', 'Standard prices are per clinic location.',
      'multiLocationRule', 'Multi-location and group requirements are bespoke.',
      'v5ScopeItems', JSON_ARRAY(
        JSON_OBJECT('category', 'Scope', 'item', 'One clinic location'),
        JSON_OBJECT('category', 'Direction', 'item', 'Whole-clinic direction'),
        JSON_OBJECT('category', 'Treatments', 'item', 'Up to six active treatment priorities'),
        JSON_OBJECT('category', 'Growth', 'item', 'Multi-channel growth')
      )
    )
) seed ON seed.`name` = gp.`name`
SET gp.`price_cents` = seed.`price_cents`,
    gp.`currency` = 'GBP',
    gp.`billing_frequency` = seed.`billing_frequency`,
    gp.`setup_fee_cents` = seed.`setup_fee_cents`,
    gp.`included_features` = seed.`included_features`,
    gp.`internal_notes` = seed.`internal_notes`,
    gp.`proposal_wording` = seed.`proposal_wording`,
    gp.`sort_order` = seed.`sort_order`,
    gp.`status` = 'active',
    gp.`is_default` = seed.`is_default`,
    gp.`catalogue_version` = 'clinicgrower_final_2026_08_23',
    gp.`commercial_notes` = seed.`commercial_notes`,
    gp.`updated_at` = CURRENT_TIMESTAMP
WHERE gp.`deleted_at` IS NULL;

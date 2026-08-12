SET @schema_name := DATABASE();

SET @add_package_catalogue_version := IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'growth_package' AND COLUMN_NAME = 'catalogue_version') = 0,
  'ALTER TABLE `growth_package` ADD COLUMN `catalogue_version` VARCHAR(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `is_default`',
  'SELECT ''growth_package.catalogue_version already exists'' AS message'
);
PREPARE stmt FROM @add_package_catalogue_version;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_package_commercial_notes := IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'growth_package' AND COLUMN_NAME = 'commercial_notes') = 0,
  'ALTER TABLE `growth_package` ADD COLUMN `commercial_notes` JSON DEFAULT NULL AFTER `catalogue_version`',
  'SELECT ''growth_package.commercial_notes already exists'' AS message'
);
PREPARE stmt FROM @add_package_commercial_notes;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE `growth_package`
SET `status` = 'archived',
    `catalogue_version` = COALESCE(`catalogue_version`, 'legacy_pre_v5'),
    `updated_at` = CURRENT_TIMESTAMP
WHERE `deleted_at` IS NULL
  AND `name` IN ('Clinic Growth Score', 'Performance OS', 'Growth Engine');

UPDATE `growth_package`
SET `price_cents` = 39500,
    `currency` = 'GBP',
    `billing_frequency` = 'monthly',
    `setup_fee_cents` = 0,
    `included_features` = JSON_ARRAY('Diagnostic review', 'Journey gap diagnosis', 'Monthly priority recommendations'),
    `internal_notes` = 'V5 catalogue. Entry paid diagnostic. Actual selected term must be stored on the proposal.',
    `proposal_wording` = 'Growth Diagnostic gives the clinic a focused monthly view of the commercial gaps holding back enquiries, bookings and recorded value.',
    `catalogue_version` = 'clinicgrower_v5_2026_08',
    `commercial_notes` = JSON_OBJECT(
      'mediaSpendHandling', 'Media spend is separate from the ClinicGrower fee.',
      'contractTermSource', 'Selected term must be explicitly stored on the issued proposal.',
      'vatHandling', 'ClinicGrower fees/setup and platform media tax/VAT treatment are separate fields.'
    ),
    `sort_order` = 20,
    `status` = 'active',
    `updated_at` = CURRENT_TIMESTAMP
WHERE `deleted_at` IS NULL
  AND `name` = 'Growth Diagnostic';

UPDATE `growth_package`
SET `price_cents` = 59500,
    `currency` = 'GBP',
    `billing_frequency` = 'monthly',
    `setup_fee_cents` = 0,
    `included_features` = JSON_ARRAY('Lead handling visibility', 'Response ownership', 'Follow-up accountability'),
    `internal_notes` = 'V5 catalogue. Lead-handling support. Actual selected term must be stored on the proposal.',
    `proposal_wording` = 'Lead Concierge helps the clinic protect valuable enquiries by making response ownership and follow-up visible.',
    `catalogue_version` = 'clinicgrower_v5_2026_08',
    `commercial_notes` = JSON_OBJECT(
      'mediaSpendHandling', 'Media spend is separate from the ClinicGrower fee.',
      'contractTermSource', 'Selected term must be explicitly stored on the issued proposal.',
      'vatHandling', 'ClinicGrower fees/setup and platform media tax/VAT treatment are separate fields.'
    ),
    `sort_order` = 30,
    `status` = 'active',
    `updated_at` = CURRENT_TIMESTAMP
WHERE `deleted_at` IS NULL
  AND `name` = 'Lead Concierge';

INSERT INTO `growth_package`
  (`id`, `clinic_id`, `name`, `price_cents`, `currency`, `billing_frequency`, `setup_fee_cents`,
   `included_features`, `internal_notes`, `proposal_wording`, `sort_order`, `status`, `is_default`, `catalogue_version`, `commercial_notes`)
SELECT UUID(), c.`id`, seed.`name`, seed.`price_cents`, 'GBP', seed.`billing_frequency`, seed.`setup_fee_cents`,
       seed.`included_features`, seed.`internal_notes`, seed.`proposal_wording`, seed.`sort_order`, 'active', 1,
       'clinicgrower_v5_2026_08',
       JSON_OBJECT(
         'mediaSpendHandling', seed.`media_note`,
         'contractTermSource', 'Selected term must be explicitly stored on the issued proposal.',
         'vatHandling', 'ClinicGrower fees/setup and platform media tax/VAT treatment are separate fields.',
         'pricingSource', 'V5 proposal and new ClinicGrower pricing direction.'
       )
FROM `clinic` c
JOIN (
  SELECT
    'Free Clinic Growth Audit' AS `name`,
    0 AS `price_cents`,
    'one_off' AS `billing_frequency`,
    0 AS `setup_fee_cents`,
    JSON_ARRAY('Outside-in growth audit', 'Clinic journey review', 'Priority recommendations') AS `included_features`,
    'V5 catalogue. Free audit entry point. Do not present as connected Clinic Growth Score until data is connected.' AS `internal_notes`,
    'Free Clinic Growth Audit identifies the first commercial gaps to verify before paid work starts.' AS `proposal_wording`,
    'No paid media included.' AS `media_note`,
    10 AS `sort_order`
  UNION ALL SELECT
    'Starter Engine',
    99500,
    'monthly',
    0,
    JSON_ARRAY('Starter growth operating rhythm', 'Priority journey visibility', 'Reporting cadence'),
    'V5 catalogue. £995/month plus agreed ad spend where selected.',
    'Starter Engine gives the clinic a lighter ClinicGrower OS-powered operating rhythm for the first priority journey.',
    'Agreed ad spend is separate and paid directly to the selected platform with no ClinicGrower markup.',
    40
  UNION ALL SELECT
    'Growth Partner',
    169500,
    'monthly',
    0,
    JSON_ARRAY('Growth accountability layer', 'Journey optimisation', 'Monthly action rhythm'),
    'V5 catalogue. £1,695/month plus agreed ad spend where selected.',
    'Growth Partner adds a broader accountability layer around the clinic journey, response ownership and growth priorities.',
    'Agreed ad spend is separate and paid directly to the selected platform with no ClinicGrower markup.',
    50
  UNION ALL SELECT
    'Clinic Growth Engine',
    249500,
    'monthly',
    99500,
    JSON_ARRAY('ClinicGrower OS commercial layer', '90-day implementation period', 'Journey, proof and operating rhythm', 'Platform media managed only where written scope says so'),
    'V5 reference recommendation. £2,495/month + VAT, £995 + VAT setup, selected media separate, six-month selected initial term in examples.',
    'Clinic Growth Engine is the recommended ClinicGrower OS-powered programme for turning patient demand into visible, accountable progression and recorded value.',
    'Example selected monthly paid media is £3,000 paid directly to the selected platform with no ClinicGrower markup.',
    60
  UNION ALL SELECT
    'Growth Engine Plus',
    349500,
    'monthly',
    99500,
    JSON_ARRAY('Expanded ClinicGrower OS operating layer', 'Multi-journey accountability', 'Advanced optimisation rhythm'),
    'V5 catalogue. £3,495/month plus agreed ad spend. Setup depends on approved scope.',
    'Growth Engine Plus expands the ClinicGrower OS accountability layer across more journeys, service lines or locations where approved.',
    'Agreed ad spend is separate and paid directly to the selected platform with no ClinicGrower markup.',
    70
  UNION ALL SELECT
    'Market Leader',
    499500,
    'monthly',
    99500,
    JSON_ARRAY('Market leadership operating system', 'Advanced multi-channel growth accountability', 'Senior strategy rhythm'),
    'V5 catalogue. From £4,995/month plus agreed ad spend. Confirm exact scope and term before issue.',
    'Market Leader is the senior ClinicGrower OS growth partnership for clinics ready to lead a market with stronger visibility and accountability.',
    'Agreed ad spend is separate and paid directly to the selected platform with no ClinicGrower markup.',
    80
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
  SELECT 'Free Clinic Growth Audit' AS `name`, 0 AS `price_cents`, 'one_off' AS `billing_frequency`, 0 AS `setup_fee_cents`, 10 AS `sort_order`
  UNION ALL SELECT 'Starter Engine', 99500, 'monthly', 0, 40
  UNION ALL SELECT 'Growth Partner', 169500, 'monthly', 0, 50
  UNION ALL SELECT 'Clinic Growth Engine', 249500, 'monthly', 99500, 60
  UNION ALL SELECT 'Growth Engine Plus', 349500, 'monthly', 99500, 70
  UNION ALL SELECT 'Market Leader', 499500, 'monthly', 99500, 80
) seed ON seed.`name` = gp.`name`
SET gp.`price_cents` = seed.`price_cents`,
    gp.`billing_frequency` = seed.`billing_frequency`,
    gp.`setup_fee_cents` = seed.`setup_fee_cents`,
    gp.`sort_order` = seed.`sort_order`,
    gp.`catalogue_version` = 'clinicgrower_v5_2026_08',
    gp.`status` = 'active',
    gp.`updated_at` = CURRENT_TIMESTAMP
WHERE gp.`deleted_at` IS NULL;

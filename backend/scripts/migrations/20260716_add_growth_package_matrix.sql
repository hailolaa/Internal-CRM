CREATE TABLE IF NOT EXISTS `growth_package` (
  `id` CHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` CHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` VARCHAR(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `price_cents` INT DEFAULT NULL,
  `currency` CHAR(3) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'GBP',
  `billing_frequency` ENUM('one_off','monthly','quarterly','annual','bespoke') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'monthly',
  `setup_fee_cents` INT DEFAULT NULL,
  `included_features` JSON DEFAULT NULL,
  `internal_notes` TEXT COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `proposal_wording` TEXT COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sort_order` INT NOT NULL DEFAULT 100,
  `status` ENUM('active','inactive','archived') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `is_default` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_growth_package_workspace_name_active` (`clinic_id`, `name`, `deleted_at`),
  KEY `idx_growth_package_workspace_status` (`clinic_id`, `status`),
  KEY `idx_growth_package_sort` (`clinic_id`, `sort_order`),
  CONSTRAINT `fk_growth_package_clinic`
    FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `growth_package`
  (`id`, `clinic_id`, `name`, `price_cents`, `currency`, `billing_frequency`, `setup_fee_cents`,
   `included_features`, `internal_notes`, `proposal_wording`, `sort_order`, `status`, `is_default`)
SELECT UUID(), c.id, seed.name, seed.price_cents, 'GBP', seed.billing_frequency, seed.setup_fee_cents,
       seed.included_features, seed.internal_notes, seed.proposal_wording, seed.sort_order, 'active', 1
FROM `clinic` c
JOIN (
  SELECT
    'Clinic Growth Score' AS name,
    0 AS price_cents,
    'one_off' AS billing_frequency,
    0 AS setup_fee_cents,
    JSON_ARRAY('One-off growth audit', 'Scorecard review', 'Priority recommendations') AS included_features,
    'Free one-off audit used as an entry point for qualified prospects.' AS internal_notes,
    'We will complete a Clinic Growth Score audit to identify the highest-impact growth opportunities.' AS proposal_wording,
    10 AS sort_order
  UNION ALL SELECT
    'Growth Diagnostic',
    39500,
    'monthly',
    0,
    JSON_ARRAY('Monthly diagnostic review', 'Lead journey assessment', 'Action priorities'),
    'Entry paid diagnostic for prospects that need clarity before committing to managed growth.',
    'Growth Diagnostic gives you a clear monthly view of the bottlenecks holding back lead generation and conversion.',
    20
  UNION ALL SELECT
    'Lead Concierge',
    59500,
    'monthly',
    0,
    JSON_ARRAY('Lead handling support', 'Follow-up process', 'Response visibility'),
    'For clients that need help turning inbound interest into booked conversations.',
    'Lead Concierge supports fast, consistent follow-up so valuable enquiries are not missed.',
    30
  UNION ALL SELECT
    'Performance OS',
    99500,
    'monthly',
    0,
    JSON_ARRAY('Performance dashboard', 'Tracking QA', 'Monthly optimisation rhythm'),
    'Core operating system package for measurement, reporting and growth execution rhythm.',
    'Performance OS creates the tracking, reporting and operating cadence needed to manage growth properly.',
    40
  UNION ALL SELECT
    'Growth Engine',
    199500,
    'monthly',
    0,
    JSON_ARRAY('Managed growth campaigns', 'Conversion tracking', 'Performance reporting', 'Ad spend managed separately'),
    'Managed growth package. Price excludes ad spend.',
    'Growth Engine combines campaign execution, conversion tracking and reporting. Advertising spend is billed separately.',
    50
  UNION ALL SELECT
    'Market Leader',
    349500,
    'monthly',
    0,
    JSON_ARRAY('Advanced growth strategy', 'Multi-channel execution', 'Market leadership reporting', 'Ad spend managed separately'),
    'Premium package starting from GBP 3,495/month. Price excludes ad spend and may be bespoke.',
    'Market Leader is our advanced growth partnership for clients ready to lead their local market. Advertising spend is billed separately.',
    60
) seed
WHERE NOT EXISTS (
  SELECT 1
  FROM `growth_package` existing
  WHERE existing.clinic_id = c.id
    AND existing.name = seed.name
    AND existing.deleted_at IS NULL
);

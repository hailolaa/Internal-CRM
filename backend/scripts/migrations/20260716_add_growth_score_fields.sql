SET @schema_name = DATABASE();

CREATE TABLE IF NOT EXISTS `growth_score_category` (
  `id` VARCHAR(100) NOT NULL,
  `category_key` VARCHAR(80) NOT NULL,
  `label` VARCHAR(150) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `max_score` DECIMAL(5,2) NOT NULL DEFAULT 100.00,
  `display_order` INT NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_growth_score_category_key` (`category_key`),
  KEY `idx_growth_score_category_active_order` (`is_active`, `display_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `growth_score_category`
  (`id`, `category_key`, `label`, `description`, `max_score`, `display_order`)
VALUES
  ('gsc-website-visibility', 'website_visibility', 'Website visibility', 'How easily the market can find and understand the client website.', 100.00, 10),
  ('gsc-seo', 'seo', 'SEO', 'Organic search foundations, content quality, technical SEO and rankings.', 100.00, 20),
  ('gsc-gbp', 'gbp', 'GBP', 'Google Business Profile completeness, reviews, posting and local visibility.', 100.00, 30),
  ('gsc-tracking', 'tracking', 'Tracking', 'Analytics, conversion tracking, call tracking and attribution quality.', 100.00, 40),
  ('gsc-conversion', 'conversion', 'Conversion', 'Website and landing page conversion strength.', 100.00, 50),
  ('gsc-lead-handling', 'lead_handling', 'Lead handling', 'How reliably the team follows up, qualifies and progresses enquiries.', 100.00, 60),
  ('gsc-response-speed', 'response_speed', 'Response speed', 'How quickly enquiries receive a useful response.', 100.00, 70),
  ('gsc-enquiry-visibility', 'enquiry_visibility', 'Enquiry visibility', 'How clearly lead sources, statuses and ownership are visible.', 100.00, 80),
  ('gsc-treatment-performance', 'treatment_performance', 'Treatment performance', 'Service/category performance signals and commercial strength.', 100.00, 90),
  ('gsc-revenue-leakage', 'revenue_leakage', 'Revenue leakage', 'Where missed follow-up, tracking gaps or weak conversion lose revenue.', 100.00, 100),
  ('gsc-growth-opportunity', 'growth_opportunity', 'Growth opportunity', 'Size and clarity of the next commercial growth opportunity.', 100.00, 110)
ON DUPLICATE KEY UPDATE
  `label` = VALUES(`label`),
  `description` = VALUES(`description`),
  `max_score` = VALUES(`max_score`),
  `display_order` = VALUES(`display_order`),
  `is_active` = 1;

SET @add_contact_overall = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contact' AND COLUMN_NAME = 'growth_score_overall') = 0,
  'ALTER TABLE `contact` ADD COLUMN `growth_score_overall` DECIMAL(5,2) DEFAULT NULL AFTER `recommended_package`',
  'SELECT ''contact.growth_score_overall already exists'' AS message'
);
PREPARE stmt FROM @add_contact_overall;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_contact_categories = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contact' AND COLUMN_NAME = 'growth_score_categories') = 0,
  'ALTER TABLE `contact` ADD COLUMN `growth_score_categories` JSON DEFAULT NULL AFTER `growth_score_overall`',
  'SELECT ''contact.growth_score_categories already exists'' AS message'
);
PREPARE stmt FROM @add_contact_categories;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_contact_website_visibility = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contact' AND COLUMN_NAME = 'growth_score_website_visibility') = 0,
  'ALTER TABLE `contact` ADD COLUMN `growth_score_website_visibility` DECIMAL(5,2) DEFAULT NULL AFTER `growth_score_categories`',
  'SELECT ''contact.growth_score_website_visibility already exists'' AS message'
);
PREPARE stmt FROM @add_contact_website_visibility;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_contact_seo = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contact' AND COLUMN_NAME = 'growth_score_seo') = 0,
  'ALTER TABLE `contact` ADD COLUMN `growth_score_seo` DECIMAL(5,2) DEFAULT NULL AFTER `growth_score_website_visibility`',
  'SELECT ''contact.growth_score_seo already exists'' AS message'
);
PREPARE stmt FROM @add_contact_seo;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_contact_gbp = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contact' AND COLUMN_NAME = 'growth_score_gbp') = 0,
  'ALTER TABLE `contact` ADD COLUMN `growth_score_gbp` DECIMAL(5,2) DEFAULT NULL AFTER `growth_score_seo`',
  'SELECT ''contact.growth_score_gbp already exists'' AS message'
);
PREPARE stmt FROM @add_contact_gbp;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_contact_tracking = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contact' AND COLUMN_NAME = 'growth_score_tracking') = 0,
  'ALTER TABLE `contact` ADD COLUMN `growth_score_tracking` DECIMAL(5,2) DEFAULT NULL AFTER `growth_score_gbp`',
  'SELECT ''contact.growth_score_tracking already exists'' AS message'
);
PREPARE stmt FROM @add_contact_tracking;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_contact_conversion = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contact' AND COLUMN_NAME = 'growth_score_conversion') = 0,
  'ALTER TABLE `contact` ADD COLUMN `growth_score_conversion` DECIMAL(5,2) DEFAULT NULL AFTER `growth_score_tracking`',
  'SELECT ''contact.growth_score_conversion already exists'' AS message'
);
PREPARE stmt FROM @add_contact_conversion;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_contact_lead_handling = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contact' AND COLUMN_NAME = 'growth_score_lead_handling') = 0,
  'ALTER TABLE `contact` ADD COLUMN `growth_score_lead_handling` DECIMAL(5,2) DEFAULT NULL AFTER `growth_score_conversion`',
  'SELECT ''contact.growth_score_lead_handling already exists'' AS message'
);
PREPARE stmt FROM @add_contact_lead_handling;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_contact_response_speed = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contact' AND COLUMN_NAME = 'growth_score_response_speed') = 0,
  'ALTER TABLE `contact` ADD COLUMN `growth_score_response_speed` DECIMAL(5,2) DEFAULT NULL AFTER `growth_score_lead_handling`',
  'SELECT ''contact.growth_score_response_speed already exists'' AS message'
);
PREPARE stmt FROM @add_contact_response_speed;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_contact_enquiry_visibility = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contact' AND COLUMN_NAME = 'growth_score_enquiry_visibility') = 0,
  'ALTER TABLE `contact` ADD COLUMN `growth_score_enquiry_visibility` DECIMAL(5,2) DEFAULT NULL AFTER `growth_score_response_speed`',
  'SELECT ''contact.growth_score_enquiry_visibility already exists'' AS message'
);
PREPARE stmt FROM @add_contact_enquiry_visibility;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_contact_treatment_performance = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contact' AND COLUMN_NAME = 'growth_score_treatment_performance') = 0,
  'ALTER TABLE `contact` ADD COLUMN `growth_score_treatment_performance` DECIMAL(5,2) DEFAULT NULL AFTER `growth_score_enquiry_visibility`',
  'SELECT ''contact.growth_score_treatment_performance already exists'' AS message'
);
PREPARE stmt FROM @add_contact_treatment_performance;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_contact_revenue_leakage = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contact' AND COLUMN_NAME = 'growth_score_revenue_leakage') = 0,
  'ALTER TABLE `contact` ADD COLUMN `growth_score_revenue_leakage` DECIMAL(5,2) DEFAULT NULL AFTER `growth_score_treatment_performance`',
  'SELECT ''contact.growth_score_revenue_leakage already exists'' AS message'
);
PREPARE stmt FROM @add_contact_revenue_leakage;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_contact_growth_opportunity = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contact' AND COLUMN_NAME = 'growth_score_growth_opportunity') = 0,
  'ALTER TABLE `contact` ADD COLUMN `growth_score_growth_opportunity` DECIMAL(5,2) DEFAULT NULL AFTER `growth_score_revenue_leakage`',
  'SELECT ''contact.growth_score_growth_opportunity already exists'' AS message'
);
PREPARE stmt FROM @add_contact_growth_opportunity;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_contact_rec = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contact' AND COLUMN_NAME = 'growth_score_recommended_package') = 0,
  'ALTER TABLE `contact` ADD COLUMN `growth_score_recommended_package` VARCHAR(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `growth_score_categories`',
  'SELECT ''contact.growth_score_recommended_package already exists'' AS message'
);
PREPARE stmt FROM @add_contact_rec;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_contact_gap_summary = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contact' AND COLUMN_NAME = 'growth_score_gap_summary') = 0,
  'ALTER TABLE `contact` ADD COLUMN `growth_score_gap_summary` TEXT DEFAULT NULL AFTER `growth_score_recommended_package`',
  'SELECT ''contact.growth_score_gap_summary already exists'' AS message'
);
PREPARE stmt FROM @add_contact_gap_summary;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_contact_updated = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contact' AND COLUMN_NAME = 'growth_score_updated_at') = 0,
  'ALTER TABLE `contact` ADD COLUMN `growth_score_updated_at` DATETIME DEFAULT NULL AFTER `growth_score_gap_summary`',
  'SELECT ''contact.growth_score_updated_at already exists'' AS message'
);
PREPARE stmt FROM @add_contact_updated;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_cap_overall = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'client_account_profile' AND COLUMN_NAME = 'growth_score_overall') = 0,
  'ALTER TABLE `client_account_profile` ADD COLUMN `growth_score_overall` DECIMAL(5,2) DEFAULT NULL AFTER `upsell_opportunity`',
  'SELECT ''client_account_profile.growth_score_overall already exists'' AS message'
);
PREPARE stmt FROM @add_cap_overall;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_cap_categories = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'client_account_profile' AND COLUMN_NAME = 'growth_score_categories') = 0,
  'ALTER TABLE `client_account_profile` ADD COLUMN `growth_score_categories` JSON DEFAULT NULL AFTER `growth_score_overall`',
  'SELECT ''client_account_profile.growth_score_categories already exists'' AS message'
);
PREPARE stmt FROM @add_cap_categories;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_cap_website_visibility = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'client_account_profile' AND COLUMN_NAME = 'growth_score_website_visibility') = 0,
  'ALTER TABLE `client_account_profile` ADD COLUMN `growth_score_website_visibility` DECIMAL(5,2) DEFAULT NULL AFTER `growth_score_categories`',
  'SELECT ''client_account_profile.growth_score_website_visibility already exists'' AS message'
);
PREPARE stmt FROM @add_cap_website_visibility;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_cap_seo = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'client_account_profile' AND COLUMN_NAME = 'growth_score_seo') = 0,
  'ALTER TABLE `client_account_profile` ADD COLUMN `growth_score_seo` DECIMAL(5,2) DEFAULT NULL AFTER `growth_score_website_visibility`',
  'SELECT ''client_account_profile.growth_score_seo already exists'' AS message'
);
PREPARE stmt FROM @add_cap_seo;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_cap_gbp = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'client_account_profile' AND COLUMN_NAME = 'growth_score_gbp') = 0,
  'ALTER TABLE `client_account_profile` ADD COLUMN `growth_score_gbp` DECIMAL(5,2) DEFAULT NULL AFTER `growth_score_seo`',
  'SELECT ''client_account_profile.growth_score_gbp already exists'' AS message'
);
PREPARE stmt FROM @add_cap_gbp;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_cap_tracking = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'client_account_profile' AND COLUMN_NAME = 'growth_score_tracking') = 0,
  'ALTER TABLE `client_account_profile` ADD COLUMN `growth_score_tracking` DECIMAL(5,2) DEFAULT NULL AFTER `growth_score_gbp`',
  'SELECT ''client_account_profile.growth_score_tracking already exists'' AS message'
);
PREPARE stmt FROM @add_cap_tracking;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_cap_conversion = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'client_account_profile' AND COLUMN_NAME = 'growth_score_conversion') = 0,
  'ALTER TABLE `client_account_profile` ADD COLUMN `growth_score_conversion` DECIMAL(5,2) DEFAULT NULL AFTER `growth_score_tracking`',
  'SELECT ''client_account_profile.growth_score_conversion already exists'' AS message'
);
PREPARE stmt FROM @add_cap_conversion;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_cap_lead_handling = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'client_account_profile' AND COLUMN_NAME = 'growth_score_lead_handling') = 0,
  'ALTER TABLE `client_account_profile` ADD COLUMN `growth_score_lead_handling` DECIMAL(5,2) DEFAULT NULL AFTER `growth_score_conversion`',
  'SELECT ''client_account_profile.growth_score_lead_handling already exists'' AS message'
);
PREPARE stmt FROM @add_cap_lead_handling;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_cap_response_speed = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'client_account_profile' AND COLUMN_NAME = 'growth_score_response_speed') = 0,
  'ALTER TABLE `client_account_profile` ADD COLUMN `growth_score_response_speed` DECIMAL(5,2) DEFAULT NULL AFTER `growth_score_lead_handling`',
  'SELECT ''client_account_profile.growth_score_response_speed already exists'' AS message'
);
PREPARE stmt FROM @add_cap_response_speed;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_cap_enquiry_visibility = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'client_account_profile' AND COLUMN_NAME = 'growth_score_enquiry_visibility') = 0,
  'ALTER TABLE `client_account_profile` ADD COLUMN `growth_score_enquiry_visibility` DECIMAL(5,2) DEFAULT NULL AFTER `growth_score_response_speed`',
  'SELECT ''client_account_profile.growth_score_enquiry_visibility already exists'' AS message'
);
PREPARE stmt FROM @add_cap_enquiry_visibility;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_cap_treatment_performance = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'client_account_profile' AND COLUMN_NAME = 'growth_score_treatment_performance') = 0,
  'ALTER TABLE `client_account_profile` ADD COLUMN `growth_score_treatment_performance` DECIMAL(5,2) DEFAULT NULL AFTER `growth_score_enquiry_visibility`',
  'SELECT ''client_account_profile.growth_score_treatment_performance already exists'' AS message'
);
PREPARE stmt FROM @add_cap_treatment_performance;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_cap_revenue_leakage = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'client_account_profile' AND COLUMN_NAME = 'growth_score_revenue_leakage') = 0,
  'ALTER TABLE `client_account_profile` ADD COLUMN `growth_score_revenue_leakage` DECIMAL(5,2) DEFAULT NULL AFTER `growth_score_treatment_performance`',
  'SELECT ''client_account_profile.growth_score_revenue_leakage already exists'' AS message'
);
PREPARE stmt FROM @add_cap_revenue_leakage;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_cap_growth_opportunity = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'client_account_profile' AND COLUMN_NAME = 'growth_score_growth_opportunity') = 0,
  'ALTER TABLE `client_account_profile` ADD COLUMN `growth_score_growth_opportunity` DECIMAL(5,2) DEFAULT NULL AFTER `growth_score_revenue_leakage`',
  'SELECT ''client_account_profile.growth_score_growth_opportunity already exists'' AS message'
);
PREPARE stmt FROM @add_cap_growth_opportunity;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_cap_rec = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'client_account_profile' AND COLUMN_NAME = 'growth_score_recommended_package') = 0,
  'ALTER TABLE `client_account_profile` ADD COLUMN `growth_score_recommended_package` VARCHAR(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `growth_score_categories`',
  'SELECT ''client_account_profile.growth_score_recommended_package already exists'' AS message'
);
PREPARE stmt FROM @add_cap_rec;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_cap_gap_summary = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'client_account_profile' AND COLUMN_NAME = 'growth_score_gap_summary') = 0,
  'ALTER TABLE `client_account_profile` ADD COLUMN `growth_score_gap_summary` TEXT DEFAULT NULL AFTER `growth_score_recommended_package`',
  'SELECT ''client_account_profile.growth_score_gap_summary already exists'' AS message'
);
PREPARE stmt FROM @add_cap_gap_summary;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_cap_updated = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'client_account_profile' AND COLUMN_NAME = 'growth_score_updated_at') = 0,
  'ALTER TABLE `client_account_profile` ADD COLUMN `growth_score_updated_at` DATETIME DEFAULT NULL AFTER `growth_score_gap_summary`',
  'SELECT ''client_account_profile.growth_score_updated_at already exists'' AS message'
);
PREPARE stmt FROM @add_cap_updated;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_contact_growth_score_index = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contact' AND INDEX_NAME = 'idx_contact_growth_score') = 0,
  'ALTER TABLE `contact` ADD INDEX `idx_contact_growth_score` (`clinic_id`, `growth_score_overall`, `growth_score_recommended_package`)',
  'SELECT ''idx_contact_growth_score already exists'' AS message'
);
PREPARE stmt FROM @add_contact_growth_score_index;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_cap_growth_score_index = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'client_account_profile' AND INDEX_NAME = 'idx_client_account_growth_score') = 0,
  'ALTER TABLE `client_account_profile` ADD INDEX `idx_client_account_growth_score` (`clinic_id`, `growth_score_overall`, `growth_score_recommended_package`)',
  'SELECT ''idx_client_account_growth_score already exists'' AS message'
);
PREPARE stmt FROM @add_cap_growth_score_index;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

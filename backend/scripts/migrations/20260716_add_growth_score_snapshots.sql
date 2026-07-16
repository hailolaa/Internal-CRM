SET @schema_name = DATABASE();

CREATE TABLE IF NOT EXISTS `growth_score_snapshot` (
  `id` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `contact_id` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `client_account_profile_id` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `audit_id` VARCHAR(100) DEFAULT NULL,
  `snapshot_date` DATE NOT NULL,
  `scored_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `overall_score` DECIMAL(5,2) DEFAULT NULL,
  `category_scores` JSON DEFAULT NULL,
  `website_visibility_score` DECIMAL(5,2) DEFAULT NULL,
  `seo_score` DECIMAL(5,2) DEFAULT NULL,
  `gbp_score` DECIMAL(5,2) DEFAULT NULL,
  `tracking_score` DECIMAL(5,2) DEFAULT NULL,
  `conversion_score` DECIMAL(5,2) DEFAULT NULL,
  `lead_handling_score` DECIMAL(5,2) DEFAULT NULL,
  `response_speed_score` DECIMAL(5,2) DEFAULT NULL,
  `enquiry_visibility_score` DECIMAL(5,2) DEFAULT NULL,
  `treatment_performance_score` DECIMAL(5,2) DEFAULT NULL,
  `revenue_leakage_score` DECIMAL(5,2) DEFAULT NULL,
  `growth_opportunity_score` DECIMAL(5,2) DEFAULT NULL,
  `recommended_package` VARCHAR(150) DEFAULT NULL,
  `gap_summary` TEXT DEFAULT NULL,
  `source` VARCHAR(80) NOT NULL DEFAULT 'manual',
  `notes` TEXT DEFAULT NULL,
  `created_by` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_growth_score_snapshot_contact` (`clinic_id`, `contact_id`, `snapshot_date`, `created_at`),
  KEY `idx_growth_score_snapshot_account` (`clinic_id`, `client_account_profile_id`, `snapshot_date`, `created_at`),
  KEY `idx_growth_score_snapshot_audit` (`clinic_id`, `audit_id`),
  KEY `idx_growth_score_snapshot_created_by` (`created_by`),
  CONSTRAINT `fk_growth_score_snapshot_contact`
    FOREIGN KEY (`contact_id`) REFERENCES `contact` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_growth_score_snapshot_client_account`
    FOREIGN KEY (`client_account_profile_id`) REFERENCES `client_account_profile` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_growth_score_snapshot_created_by`
    FOREIGN KEY (`created_by`) REFERENCES `user` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

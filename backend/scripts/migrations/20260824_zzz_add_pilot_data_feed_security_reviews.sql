CREATE TABLE IF NOT EXISTS `pilot_data_feed_security_review` (
  `id` CHAR(36) NOT NULL,
  `clinic_id` CHAR(36) NOT NULL,
  `source_id` CHAR(36) NULL,
  `review_status` ENUM('passed','failed','needs_review') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'needs_review',
  `tenant_isolation_status` ENUM('passed','failed') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `erasure_status` ENUM('passed','failed','not_run') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'not_run',
  `reconciliation_status` ENUM('passed','failed') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `freshness_status` ENUM('passed','failed') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `reviewed_by` VARCHAR(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `evidence` JSON NOT NULL,
  `reviewed_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_pilot_data_feed_review_source` (`clinic_id`, `source_id`),
  KEY `idx_pilot_data_feed_review_status` (`clinic_id`, `review_status`, `reviewed_at`),
  CONSTRAINT `fk_pilot_data_feed_review_clinic` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pilot_data_feed_review_source` FOREIGN KEY (`source_id`) REFERENCES `fleet_ingestion_source` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

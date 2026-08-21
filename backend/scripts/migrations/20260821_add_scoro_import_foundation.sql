CREATE TABLE IF NOT EXISTS `external_import_batch` (
  `id` CHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` CHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `source_system` VARCHAR(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `source_label` VARCHAR(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mode` ENUM('dry_run','apply','cleanup') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'dry_run',
  `status` ENUM('planned','processing','completed','completed_with_quarantine','failed','cleanup_completed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'planned',
  `source_hash` CHAR(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `total_rows` INT NOT NULL DEFAULT 0,
  `valid_rows` INT NOT NULL DEFAULT 0,
  `mapped_rows` INT NOT NULL DEFAULT 0,
  `imported_rows` INT NOT NULL DEFAULT 0,
  `skipped_duplicate_rows` INT NOT NULL DEFAULT 0,
  `quarantined_rows` INT NOT NULL DEFAULT 0,
  `relationship_failure_rows` INT NOT NULL DEFAULT 0,
  `owner_mapping_issue_rows` INT NOT NULL DEFAULT 0,
  `reconciliation_report` JSON DEFAULT NULL,
  `created_by` CHAR(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_external_import_batch_clinic_source` (`clinic_id`, `source_system`, `created_at`),
  KEY `idx_external_import_batch_status` (`clinic_id`, `source_system`, `status`),
  KEY `fk_external_import_batch_created_by` (`created_by`),
  CONSTRAINT `fk_external_import_batch_clinic`
    FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_external_import_batch_created_by`
    FOREIGN KEY (`created_by`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `external_import_record` (
  `id` CHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `batch_id` CHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` CHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `source_system` VARCHAR(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `source_entity` VARCHAR(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `source_record_id` VARCHAR(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `source_row_number` INT DEFAULT NULL,
  `source_row_hash` CHAR(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `validation_status` ENUM('valid','mapped','quarantined','imported','skipped_duplicate','cleanup_pending','cleaned') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'valid',
  `quarantine_reason` VARCHAR(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mapped_target_type` VARCHAR(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mapped_target_id` CHAR(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `candidate_matches` JSON DEFAULT NULL,
  `raw_row` JSON DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_external_import_source_identity` (`clinic_id`, `source_system`, `source_entity`, `source_record_id`),
  KEY `idx_external_import_record_batch` (`batch_id`, `source_entity`, `validation_status`),
  KEY `idx_external_import_record_target` (`mapped_target_type`, `mapped_target_id`),
  KEY `idx_external_import_record_quarantine` (`clinic_id`, `source_system`, `validation_status`, `quarantine_reason`),
  CONSTRAINT `fk_external_import_record_batch`
    FOREIGN KEY (`batch_id`) REFERENCES `external_import_batch` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_external_import_record_clinic`
    FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

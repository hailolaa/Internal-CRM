CREATE TABLE IF NOT EXISTS `contact_duplicate_candidate` (
  `id` CHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` CHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `import_batch_id` CHAR(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `existing_contact_id` CHAR(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `candidate_contact_id` CHAR(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `match_type` VARCHAR(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `score` INT NOT NULL DEFAULT 0,
  `status` ENUM('open','confirmed_duplicate','not_duplicate','merged','ignored') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'open',
  `candidate_data` JSON DEFAULT NULL,
  `resolved_by` CHAR(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `resolved_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_contact_duplicate_clinic_status` (`clinic_id`, `status`),
  KEY `idx_contact_duplicate_import_batch` (`import_batch_id`),
  KEY `idx_contact_duplicate_existing` (`existing_contact_id`),
  KEY `idx_contact_duplicate_candidate` (`candidate_contact_id`),
  KEY `fk_contact_duplicate_resolved_by` (`resolved_by`),
  CONSTRAINT `fk_contact_duplicate_candidate`
    FOREIGN KEY (`candidate_contact_id`) REFERENCES `contact` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_contact_duplicate_clinic`
    FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_contact_duplicate_existing`
    FOREIGN KEY (`existing_contact_id`) REFERENCES `contact` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_contact_duplicate_resolved_by`
    FOREIGN KEY (`resolved_by`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

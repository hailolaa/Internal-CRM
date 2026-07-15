-- Adds per-contact inbox UI state for read/star/archive controls.
-- Required by /api/comms/inbox and safe to run repeatedly.

CREATE TABLE IF NOT EXISTS `comms_conversation_state` (
  `id` CHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` CHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `contact_id` CHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `starred` TINYINT(1) NOT NULL DEFAULT 0,
  `archived_at` DATETIME DEFAULT NULL,
  `created_by` CHAR(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `updated_by` CHAR(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_comms_conversation_state_contact` (`clinic_id`, `contact_id`),
  KEY `idx_comms_conversation_state_clinic_archived` (`clinic_id`, `archived_at`),
  KEY `fk_comms_conversation_state_contact` (`contact_id`),
  KEY `fk_comms_conversation_state_created_by` (`created_by`),
  KEY `fk_comms_conversation_state_updated_by` (`updated_by`),
  CONSTRAINT `fk_comms_conversation_state_clinic`
    FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_comms_conversation_state_contact`
    FOREIGN KEY (`contact_id`) REFERENCES `contact` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_comms_conversation_state_created_by`
    FOREIGN KEY (`created_by`) REFERENCES `user` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_comms_conversation_state_updated_by`
    FOREIGN KEY (`updated_by`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Mission Control intake for ClinicGrower missed-call recovery events.
-- Additive migration: stores the cross-system client mapping, provider event
-- idempotency, and the operational recovery state without changing call/task history.

CREATE TABLE IF NOT EXISTS `clinicgrower_client_mapping` (
  `id` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `client_account_profile_id` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinicgrower_clinic_id` VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinicgrower_clinic_name` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `source_system` VARCHAR(60) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'clinicgrower',
  `default_owner_user_id` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `fallback_queue_label` VARCHAR(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Missed Call Recovery queue',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_by` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `updated_by` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_cg_client_mapping_external` (`source_system`, `clinicgrower_clinic_id`),
  UNIQUE KEY `uk_cg_client_mapping_profile` (`clinic_id`, `client_account_profile_id`),
  KEY `idx_cg_client_mapping_status` (`clinic_id`, `is_active`, `updated_at`),
  KEY `idx_cg_client_mapping_owner` (`default_owner_user_id`),
  KEY `fk_cg_client_mapping_profile` (`client_account_profile_id`),
  KEY `fk_cg_client_mapping_created_by` (`created_by`),
  KEY `fk_cg_client_mapping_updated_by` (`updated_by`),
  CONSTRAINT `fk_cg_client_mapping_workspace` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_cg_client_mapping_profile` FOREIGN KEY (`client_account_profile_id`) REFERENCES `client_account_profile` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_cg_client_mapping_owner` FOREIGN KEY (`default_owner_user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_cg_client_mapping_created_by` FOREIGN KEY (`created_by`) REFERENCES `user` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_cg_client_mapping_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `clinicgrower_missed_call_event` (
  `id` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `source_system` VARCHAR(60) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `source_event_id` VARCHAR(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `source_event_type` VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `source_event_version` INT NOT NULL,
  `source_idempotency_key` VARCHAR(160) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinicgrower_clinic_id` VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinicgrower_tenant_id` VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `clinicgrower_call_id` VARCHAR(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `provider_call_sid` VARCHAR(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `caller_number` VARCHAR(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `caller_number_normalized` VARCHAR(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tracking_number` VARCHAR(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tracking_number_normalized` VARCHAR(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `missed_call_state` ENUM('no_answer','busy','failed','canceled','voicemail') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `voicemail_state` VARCHAR(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `occurred_at` DATETIME NOT NULL,
  `recovery_sla_target_at` DATETIME NOT NULL,
  `processing_status` ENUM('accepted','duplicate','mapping_required','inactive_mapping','rejected','failed') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `processing_reason` VARCHAR(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mapping_id` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `recovery_id` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payload_summary` JSON DEFAULT NULL,
  `processed_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_cg_missed_call_event_source` (`source_system`, `source_event_id`),
  UNIQUE KEY `uk_cg_missed_call_event_idempotency` (`source_system`, `source_idempotency_key`),
  KEY `idx_cg_missed_call_event_status` (`processing_status`, `created_at`),
  KEY `idx_cg_missed_call_event_mapping` (`mapping_id`, `processing_status`),
  KEY `idx_cg_missed_call_event_call` (`clinicgrower_clinic_id`, `provider_call_sid`),
  KEY `fk_cg_missed_call_event_recovery` (`recovery_id`),
  CONSTRAINT `fk_cg_missed_call_event_mapping` FOREIGN KEY (`mapping_id`) REFERENCES `clinicgrower_client_mapping` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `missed_call_recovery` (
  `id` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `client_account_profile_id` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `mapping_id` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `contact_id` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `task_id` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `source_system` VARCHAR(60) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `source_event_id` VARCHAR(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `source_idempotency_key` VARCHAR(160) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinicgrower_clinic_id` VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinicgrower_call_id` VARCHAR(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `provider_call_sid` VARCHAR(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `missed_call_state` ENUM('no_answer','busy','failed','canceled','voicemail') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `voicemail_state` VARCHAR(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `caller_number` VARCHAR(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `caller_number_normalized` VARCHAR(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tracking_number` VARCHAR(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `source` VARCHAR(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `owner_user_id` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `owner_label` VARCHAR(160) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Missed Call Recovery queue',
  `recovery_state` ENUM('attempted','contacted','booked','closed_no_response') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'attempted',
  `occurred_at` DATETIME NOT NULL,
  `recovery_sla_target_at` DATETIME NOT NULL,
  `attempted_at` DATETIME DEFAULT NULL,
  `contacted_at` DATETIME DEFAULT NULL,
  `booked_at` DATETIME DEFAULT NULL,
  `closed_no_response_at` DATETIME DEFAULT NULL,
  `completed_within_sla` TINYINT(1) DEFAULT NULL,
  `acknowledgement_status` VARCHAR(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `acknowledgement_sms_id` VARCHAR(160) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_missed_call_recovery_source_event` (`source_system`, `source_event_id`),
  UNIQUE KEY `uk_missed_call_recovery_idempotency` (`source_system`, `source_idempotency_key`),
  UNIQUE KEY `uk_missed_call_recovery_provider_call` (`clinic_id`, `provider_call_sid`),
  KEY `idx_missed_call_recovery_queue` (`clinic_id`, `recovery_state`, `recovery_sla_target_at`),
  KEY `idx_missed_call_recovery_client` (`clinic_id`, `client_account_profile_id`, `recovery_state`),
  KEY `idx_missed_call_recovery_owner` (`clinic_id`, `owner_user_id`, `recovery_state`),
  KEY `idx_missed_call_recovery_contact` (`clinic_id`, `contact_id`),
  KEY `idx_missed_call_recovery_task` (`task_id`),
  KEY `fk_missed_call_recovery_mapping` (`mapping_id`),
  CONSTRAINT `fk_missed_call_recovery_workspace` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_missed_call_recovery_profile` FOREIGN KEY (`client_account_profile_id`) REFERENCES `client_account_profile` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_missed_call_recovery_mapping` FOREIGN KEY (`mapping_id`) REFERENCES `clinicgrower_client_mapping` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_missed_call_recovery_contact` FOREIGN KEY (`contact_id`) REFERENCES `contact` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_missed_call_recovery_task` FOREIGN KEY (`task_id`) REFERENCES `task` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_missed_call_recovery_owner` FOREIGN KEY (`owner_user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @schema_name = DATABASE();

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'clinicgrower_missed_call_event' AND CONSTRAINT_NAME = 'fk_cg_missed_call_event_recovery') = 0,
  'ALTER TABLE `clinicgrower_missed_call_event`
     ADD CONSTRAINT `fk_cg_missed_call_event_recovery`
     FOREIGN KEY (`recovery_id`) REFERENCES `missed_call_recovery` (`id`) ON DELETE SET NULL',
  'SELECT ''fk_cg_missed_call_event_recovery already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Production migration for marketing connector state, imported metrics, and raw payloads.
-- Additive and idempotent: safe to run more than once against the legacy CRM schema.

SET @schema_name = DATABASE();

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'integration' AND COLUMN_NAME = 'setup_status') = 0,
  'ALTER TABLE `integration` ADD COLUMN `setup_status` VARCHAR(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT ''not_configured'' AFTER `is_active`',
  'SELECT ''integration.setup_status already exists'' AS message'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'integration' AND COLUMN_NAME = 'health_status') = 0,
  'ALTER TABLE `integration` ADD COLUMN `health_status` VARCHAR(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT ''unknown'' AFTER `setup_status`',
  'SELECT ''integration.health_status already exists'' AS message'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'integration' AND COLUMN_NAME = 'last_sync_status') = 0,
  'ALTER TABLE `integration` ADD COLUMN `last_sync_status` VARCHAR(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT ''never'' AFTER `last_sync`',
  'SELECT ''integration.last_sync_status already exists'' AS message'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'integration' AND COLUMN_NAME = 'last_sync_error') = 0,
  'ALTER TABLE `integration` ADD COLUMN `last_sync_error` VARCHAR(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `last_sync_status`',
  'SELECT ''integration.last_sync_error already exists'' AS message'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'integration' AND COLUMN_NAME = 'last_sync_started_at') = 0,
  'ALTER TABLE `integration` ADD COLUMN `last_sync_started_at` TIMESTAMP NULL DEFAULT NULL AFTER `last_sync_error`',
  'SELECT ''integration.last_sync_started_at already exists'' AS message'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'integration' AND COLUMN_NAME = 'last_sync_completed_at') = 0,
  'ALTER TABLE `integration` ADD COLUMN `last_sync_completed_at` TIMESTAMP NULL DEFAULT NULL AFTER `last_sync_started_at`',
  'SELECT ''integration.last_sync_completed_at already exists'' AS message'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'integration' AND COLUMN_NAME = 'missing_permissions') = 0,
  'ALTER TABLE `integration` ADD COLUMN `missing_permissions` JSON DEFAULT NULL AFTER `last_sync_completed_at`',
  'SELECT ''integration.missing_permissions already exists'' AS message'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'integration' AND COLUMN_NAME = 'oauth_authorize_url') = 0,
  'ALTER TABLE `integration` ADD COLUMN `oauth_authorize_url` TEXT COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `missing_permissions`',
  'SELECT ''integration.oauth_authorize_url already exists'' AS message'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'integration' AND INDEX_NAME = 'idx_integration_clinic_type') = 0,
  'ALTER TABLE `integration` ADD KEY `idx_integration_clinic_type` (`clinic_id`, `type`, `deleted_at`)',
  'SELECT ''idx_integration_clinic_type already exists'' AS message'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS `manual_platform_metric` (
  `id` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `platform` VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `metric_date` DATE NOT NULL,
  `campaign` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `location_label` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `metric_name` VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `metric_value` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `unit` VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `attribution_label` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `raw_payload` JSON DEFAULT NULL,
  `notes` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_by` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_manual_metric_clinic_platform_date` (`clinic_id`, `platform`, `metric_date`),
  KEY `idx_manual_metric_clinic_name_date` (`clinic_id`, `metric_name`, `metric_date`),
  KEY `idx_manual_metric_created_by` (`created_by`),
  CONSTRAINT `fk_manual_metric_clinic` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_manual_metric_created_by` FOREIGN KEY (`created_by`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `integration_raw_payload` (
  `id` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `source` VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `source_event_id` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `linked_entity_type` VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `linked_entity_id` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payload` JSON NOT NULL,
  `status` VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'received',
  `processed_at` TIMESTAMP NULL DEFAULT NULL,
  `error_message` VARCHAR(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_by` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_raw_payload_event` (`clinic_id`, `source`, `source_event_id`),
  KEY `idx_raw_payload_linked_entity` (`clinic_id`, `linked_entity_type`, `linked_entity_id`),
  KEY `idx_raw_payload_status_created` (`clinic_id`, `status`, `created_at`),
  KEY `idx_raw_payload_created_by` (`created_by`),
  CONSTRAINT `fk_raw_payload_clinic` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_raw_payload_created_by` FOREIGN KEY (`created_by`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

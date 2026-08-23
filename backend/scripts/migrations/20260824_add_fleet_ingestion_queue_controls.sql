ALTER TABLE `fleet_ingestion_event`
  MODIFY `processing_status` ENUM('queued','processing','processed','duplicate','quarantined','retrying','dead_letter','failed','ignored') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'queued';

SET @schema_name = DATABASE();

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'fleet_ingestion_event' AND COLUMN_NAME = 'retry_count') = 0,
  'ALTER TABLE `fleet_ingestion_event` ADD COLUMN `retry_count` INT UNSIGNED NOT NULL DEFAULT 0 AFTER `processing_status`',
  'SELECT ''fleet_ingestion_event.retry_count already exists'' AS message'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'fleet_ingestion_event' AND COLUMN_NAME = 'next_retry_at') = 0,
  'ALTER TABLE `fleet_ingestion_event` ADD COLUMN `next_retry_at` DATETIME NULL AFTER `retry_count`',
  'SELECT ''fleet_ingestion_event.next_retry_at already exists'' AS message'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'fleet_ingestion_event' AND COLUMN_NAME = 'error_class') = 0,
  'ALTER TABLE `fleet_ingestion_event` ADD COLUMN `error_class` VARCHAR(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL AFTER `next_retry_at`',
  'SELECT ''fleet_ingestion_event.error_class already exists'' AS message'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'fleet_ingestion_event' AND COLUMN_NAME = 'last_attempt_at') = 0,
  'ALTER TABLE `fleet_ingestion_event` ADD COLUMN `last_attempt_at` DATETIME NULL AFTER `error_message`',
  'SELECT ''fleet_ingestion_event.last_attempt_at already exists'' AS message'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'fleet_ingestion_event' AND INDEX_NAME = 'idx_fleet_ingestion_event_retry') = 0,
  'ALTER TABLE `fleet_ingestion_event` ADD INDEX `idx_fleet_ingestion_event_retry` (`processing_status`, `next_retry_at`, `received_at`)',
  'SELECT ''idx_fleet_ingestion_event_retry already exists'' AS message'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS `fleet_ingestion_checkpoint` (
  `id` CHAR(36) NOT NULL,
  `clinic_id` CHAR(36) NOT NULL,
  `source_id` CHAR(36) NOT NULL,
  `source_system` VARCHAR(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `source_key` VARCHAR(160) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `sync_status` ENUM('healthy','delayed','retrying','dead_letter','paused','reconciliation_needed') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'healthy',
  `checkpoint` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
  `last_event_at` DATETIME NULL,
  `last_processed_event_at` DATETIME NULL,
  `last_error` VARCHAR(1000) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
  `retrying_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `dead_letter_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_fleet_ingestion_checkpoint_source` (`clinic_id`, `source_id`),
  KEY `idx_fleet_ingestion_checkpoint_status` (`clinic_id`, `sync_status`, `updated_at`),
  CONSTRAINT `fk_fleet_ingestion_checkpoint_clinic` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_fleet_ingestion_checkpoint_source` FOREIGN KEY (`source_id`) REFERENCES `fleet_ingestion_source` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

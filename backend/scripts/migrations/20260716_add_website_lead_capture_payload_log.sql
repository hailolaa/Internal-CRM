CREATE TABLE IF NOT EXISTS `integration_raw_payload` (
  `id` VARCHAR(36) NOT NULL,
  `clinic_id` VARCHAR(36) NOT NULL,
  `source` VARCHAR(100) NOT NULL,
  `source_event_id` VARCHAR(255) DEFAULT NULL,
  `linked_entity_type` VARCHAR(100) DEFAULT NULL,
  `linked_entity_id` VARCHAR(36) DEFAULT NULL,
  `payload` JSON NOT NULL,
  `status` ENUM('received','processed','failed') NOT NULL DEFAULT 'received',
  `processed_at` TIMESTAMP NULL DEFAULT NULL,
  `created_by` VARCHAR(36) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_integration_raw_payload_clinic_source` (`clinic_id`, `source`, `created_at`),
  KEY `idx_integration_raw_payload_linked_entity` (`clinic_id`, `linked_entity_type`, `linked_entity_id`),
  UNIQUE KEY `uniq_integration_raw_payload_event` (`clinic_id`, `source`, `source_event_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @schema_name = DATABASE();

SET @add_source_index = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'integration_raw_payload' AND INDEX_NAME = 'idx_integration_raw_payload_clinic_source') = 0,
  'ALTER TABLE `integration_raw_payload` ADD INDEX `idx_integration_raw_payload_clinic_source` (`clinic_id`, `source`, `created_at`)',
  'SELECT ''idx_integration_raw_payload_clinic_source already exists'' AS message'
);
PREPARE stmt FROM @add_source_index;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_linked_index = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'integration_raw_payload' AND INDEX_NAME = 'idx_integration_raw_payload_linked_entity') = 0,
  'ALTER TABLE `integration_raw_payload` ADD INDEX `idx_integration_raw_payload_linked_entity` (`clinic_id`, `linked_entity_type`, `linked_entity_id`)',
  'SELECT ''idx_integration_raw_payload_linked_entity already exists'' AS message'
);
PREPARE stmt FROM @add_linked_index;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_event_unique = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'integration_raw_payload' AND INDEX_NAME = 'uniq_integration_raw_payload_event') = 0,
  'ALTER TABLE `integration_raw_payload` ADD UNIQUE KEY `uniq_integration_raw_payload_event` (`clinic_id`, `source`, `source_event_id`)',
  'SELECT ''uniq_integration_raw_payload_event already exists'' AS message'
);
PREPARE stmt FROM @add_event_unique;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

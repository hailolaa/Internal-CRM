-- MC-079: source-specific server-to-server lead intake API keys.
-- This is additive and keeps existing API keys working.

SET @schema_name = CONVERT(DATABASE() USING utf8mb3) COLLATE utf8mb3_general_ci;

SET @add_api_key_purpose = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA COLLATE utf8mb3_general_ci = @schema_name AND TABLE_NAME = 'api_key' AND COLUMN_NAME = 'purpose') = 0,
  'ALTER TABLE `api_key` ADD COLUMN `purpose` VARCHAR(80) NOT NULL DEFAULT ''general'' AFTER `key_hash`',
  'SELECT ''api_key.purpose already exists'' AS message'
);
PREPARE stmt FROM @add_api_key_purpose;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_api_key_source_key = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA COLLATE utf8mb3_general_ci = @schema_name AND TABLE_NAME = 'api_key' AND COLUMN_NAME = 'source_key') = 0,
  'ALTER TABLE `api_key` ADD COLUMN `source_key` VARCHAR(120) NULL AFTER `purpose`',
  'SELECT ''api_key.source_key already exists'' AS message'
);
PREPARE stmt FROM @add_api_key_source_key;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_api_key_source_label = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA COLLATE utf8mb3_general_ci = @schema_name AND TABLE_NAME = 'api_key' AND COLUMN_NAME = 'source_label') = 0,
  'ALTER TABLE `api_key` ADD COLUMN `source_label` VARCHAR(180) NULL AFTER `source_key`',
  'SELECT ''api_key.source_label already exists'' AS message'
);
PREPARE stmt FROM @add_api_key_source_label;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_api_key_default_source = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA COLLATE utf8mb3_general_ci = @schema_name AND TABLE_NAME = 'api_key' AND COLUMN_NAME = 'default_source') = 0,
  'ALTER TABLE `api_key` ADD COLUMN `default_source` VARCHAR(120) NULL AFTER `source_label`',
  'SELECT ''api_key.default_source already exists'' AS message'
);
PREPARE stmt FROM @add_api_key_default_source;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_api_key_initial_stage = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA COLLATE utf8mb3_general_ci = @schema_name AND TABLE_NAME = 'api_key' AND COLUMN_NAME = 'initial_stage_name') = 0,
  'ALTER TABLE `api_key` ADD COLUMN `initial_stage_name` VARCHAR(120) NULL AFTER `default_source`',
  'SELECT ''api_key.initial_stage_name already exists'' AS message'
);
PREPARE stmt FROM @add_api_key_initial_stage;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_api_key_owner = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA COLLATE utf8mb3_general_ci = @schema_name AND TABLE_NAME = 'api_key' AND COLUMN_NAME = 'owner_user_id') = 0,
  'ALTER TABLE `api_key` ADD COLUMN `owner_user_id` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL AFTER `initial_stage_name`',
  'SELECT ''api_key.owner_user_id already exists'' AS message'
);
PREPARE stmt FROM @add_api_key_owner;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_api_key_follow_up = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA COLLATE utf8mb3_general_ci = @schema_name AND TABLE_NAME = 'api_key' AND COLUMN_NAME = 'follow_up_enabled') = 0,
  'ALTER TABLE `api_key` ADD COLUMN `follow_up_enabled` TINYINT(1) NOT NULL DEFAULT 1 AFTER `owner_user_id`',
  'SELECT ''api_key.follow_up_enabled already exists'' AS message'
);
PREPARE stmt FROM @add_api_key_follow_up;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_api_key_rotated = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA COLLATE utf8mb3_general_ci = @schema_name AND TABLE_NAME = 'api_key' AND COLUMN_NAME = 'rotated_at') = 0,
  'ALTER TABLE `api_key` ADD COLUMN `rotated_at` TIMESTAMP NULL DEFAULT NULL AFTER `revoked_at`',
  'SELECT ''api_key.rotated_at already exists'' AS message'
);
PREPARE stmt FROM @add_api_key_rotated;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_api_key_source_index = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA COLLATE utf8mb3_general_ci = @schema_name AND TABLE_NAME = 'api_key' AND INDEX_NAME = 'idx_api_key_purpose_source') = 0,
  'ALTER TABLE `api_key` ADD INDEX `idx_api_key_purpose_source` (`clinic_id`, `purpose`, `source_key`, `revoked_at`)',
  'SELECT ''idx_api_key_purpose_source already exists'' AS message'
);
PREPARE stmt FROM @add_api_key_source_index;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_api_key_owner_index = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA COLLATE utf8mb3_general_ci = @schema_name AND TABLE_NAME = 'api_key' AND INDEX_NAME = 'idx_api_key_owner_user') = 0,
  'ALTER TABLE `api_key` ADD INDEX `idx_api_key_owner_user` (`owner_user_id`)',
  'SELECT ''idx_api_key_owner_user already exists'' AS message'
);
PREPARE stmt FROM @add_api_key_owner_index;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_api_key_owner_fk = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA COLLATE utf8mb3_general_ci = @schema_name AND CONSTRAINT_NAME = 'fk_api_key_owner_user') = 0,
  'ALTER TABLE `api_key` ADD CONSTRAINT `fk_api_key_owner_user` FOREIGN KEY (`owner_user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL',
  'SELECT ''fk_api_key_owner_user already exists'' AS message'
);
PREPARE stmt FROM @add_api_key_owner_fk;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- MC-041: Link won deals to converted client accounts without changing deal stage history.
SET @schema_name = DATABASE();

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'deal' AND COLUMN_NAME = 'client_account_profile_id') = 0,
  'ALTER TABLE `deal` ADD COLUMN `client_account_profile_id` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `contact_id`',
  'SELECT ''deal.client_account_profile_id already exists'' AS message'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'deal' AND COLUMN_NAME = 'client_converted_at') = 0,
  'ALTER TABLE `deal` ADD COLUMN `client_converted_at` DATETIME DEFAULT NULL AFTER `client_account_profile_id`',
  'SELECT ''deal.client_converted_at already exists'' AS message'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'deal' AND INDEX_NAME = 'idx_deal_client_account_profile') = 0,
  'ALTER TABLE `deal` ADD INDEX `idx_deal_client_account_profile` (`clinic_id`, `client_account_profile_id`, `client_converted_at`)',
  'SELECT ''idx_deal_client_account_profile already exists'' AS message'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'deal' AND CONSTRAINT_NAME = 'fk_deal_client_account_profile') = 0,
  'ALTER TABLE `deal` ADD CONSTRAINT `fk_deal_client_account_profile` FOREIGN KEY (`client_account_profile_id`) REFERENCES `client_account_profile` (`id`) ON DELETE SET NULL',
  'SELECT ''fk_deal_client_account_profile already exists'' AS message'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

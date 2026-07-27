-- MC-047: Client retention recency fields.
SET @schema_name = DATABASE();

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'client_account_profile' AND COLUMN_NAME = 'last_contact_at') = 0,
  'ALTER TABLE `client_account_profile` ADD COLUMN `last_contact_at` DATETIME DEFAULT NULL AFTER `churn_risk`',
  'SELECT ''client_account_profile.last_contact_at already exists'' AS message'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'client_account_profile' AND COLUMN_NAME = 'last_report_at') = 0,
  'ALTER TABLE `client_account_profile` ADD COLUMN `last_report_at` DATETIME DEFAULT NULL AFTER `last_contact_at`',
  'SELECT ''client_account_profile.last_report_at already exists'' AS message'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'client_account_profile' AND COLUMN_NAME = 'last_loom_at') = 0,
  'ALTER TABLE `client_account_profile` ADD COLUMN `last_loom_at` DATETIME DEFAULT NULL AFTER `last_report_at`',
  'SELECT ''client_account_profile.last_loom_at already exists'' AS message'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'client_account_profile' AND INDEX_NAME = 'idx_client_account_recency') = 0,
  'ALTER TABLE `client_account_profile` ADD INDEX `idx_client_account_recency` (`clinic_id`, `last_contact_at`, `last_report_at`, `last_loom_at`)',
  'SELECT ''idx_client_account_recency already exists'' AS message'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

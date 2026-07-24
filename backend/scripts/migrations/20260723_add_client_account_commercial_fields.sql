-- MC-042: Client account commercial and manual payment fields.
SET @schema_name = DATABASE();

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'client_account_profile' AND COLUMN_NAME = 'monthly_price') = 0,
  'ALTER TABLE `client_account_profile` ADD COLUMN `monthly_price` DECIMAL(12,2) DEFAULT NULL AFTER `current_package`',
  'SELECT ''client_account_profile.monthly_price already exists'' AS message'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'client_account_profile' AND COLUMN_NAME = 'setup_fee') = 0,
  'ALTER TABLE `client_account_profile` ADD COLUMN `setup_fee` DECIMAL(12,2) DEFAULT NULL AFTER `monthly_price`',
  'SELECT ''client_account_profile.setup_fee already exists'' AS message'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'client_account_profile' AND COLUMN_NAME = 'currency') = 0,
  'ALTER TABLE `client_account_profile` ADD COLUMN `currency` CHAR(3) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT ''GBP'' AFTER `setup_fee`',
  'SELECT ''client_account_profile.currency already exists'' AS message'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'client_account_profile' AND COLUMN_NAME = 'contract_start_date') = 0,
  'ALTER TABLE `client_account_profile` ADD COLUMN `contract_start_date` DATE DEFAULT NULL AFTER `contract_status`',
  'SELECT ''client_account_profile.contract_start_date already exists'' AS message'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'client_account_profile' AND COLUMN_NAME = 'notice_date') = 0,
  'ALTER TABLE `client_account_profile` ADD COLUMN `notice_date` DATE DEFAULT NULL AFTER `contract_start_date`',
  'SELECT ''client_account_profile.notice_date already exists'' AS message'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'client_account_profile' AND COLUMN_NAME = 'payment_status') = 0,
  'ALTER TABLE `client_account_profile` ADD COLUMN `payment_status` ENUM(''not_started'',''pending'',''paid'',''overdue'',''failed'',''cancelled'') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT ''not_started'' AFTER `notice_date`',
  'SELECT ''client_account_profile.payment_status already exists'' AS message'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'client_account_profile' AND COLUMN_NAME = 'invoice_status') = 0,
  'ALTER TABLE `client_account_profile` ADD COLUMN `invoice_status` ENUM(''not_required'',''not_sent'',''sent'',''paid'',''overdue'',''disputed'',''void'') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT ''not_sent'' AFTER `payment_status`',
  'SELECT ''client_account_profile.invoice_status already exists'' AS message'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'client_account_profile' AND COLUMN_NAME = 'payment_notes') = 0,
  'ALTER TABLE `client_account_profile` ADD COLUMN `payment_notes` TEXT DEFAULT NULL AFTER `invoice_status`',
  'SELECT ''client_account_profile.payment_notes already exists'' AS message'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'client_account_profile' AND INDEX_NAME = 'idx_client_account_commercial_status') = 0,
  'ALTER TABLE `client_account_profile` ADD INDEX `idx_client_account_commercial_status` (`clinic_id`, `client_status`, `contract_status`, `payment_status`, `invoice_status`)',
  'SELECT ''idx_client_account_commercial_status already exists'' AS message'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @schema_name = DATABASE();

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contact' AND COLUMN_NAME = 'account_name') = 0,
  'ALTER TABLE `contact` ADD COLUMN `account_name` VARCHAR(255) NULL AFTER `clinic_id`',
  'SELECT ''contact.account_name already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contact' AND COLUMN_NAME = 'website') = 0,
  'ALTER TABLE `contact` ADD COLUMN `website` VARCHAR(255) NULL AFTER `phone`',
  'SELECT ''contact.website already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contact' AND INDEX_NAME = 'idx_contact_account_name') = 0,
  'ALTER TABLE `contact` ADD INDEX `idx_contact_account_name` (`clinic_id`, `account_name`)',
  'SELECT ''idx_contact_account_name already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contact' AND INDEX_NAME = 'idx_contact_website') = 0,
  'ALTER TABLE `contact` ADD INDEX `idx_contact_website` (`clinic_id`, `website`)',
  'SELECT ''idx_contact_website already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

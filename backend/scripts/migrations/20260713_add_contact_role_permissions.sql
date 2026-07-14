SET @schema_name = DATABASE();

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contact' AND COLUMN_NAME = 'contact_role') = 0,
  'ALTER TABLE `contact` ADD COLUMN `contact_role` VARCHAR(100) NULL AFTER `account_name`',
  'SELECT ''contact.contact_role already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contact' AND COLUMN_NAME = 'communication_permissions') = 0,
  'ALTER TABLE `contact` ADD COLUMN `communication_permissions` JSON NULL AFTER `contact_role`',
  'SELECT ''contact.communication_permissions already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contact' AND COLUMN_NAME = 'role_title') = 0,
  'ALTER TABLE `contact` ADD COLUMN `role_title` VARCHAR(120) NULL AFTER `phone`',
  'SELECT ''contact.role_title already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contact' AND COLUMN_NAME = 'email_permission') = 0,
  'ALTER TABLE `contact` ADD COLUMN `email_permission` TINYINT(1) DEFAULT 1 AFTER `role_title`',
  'SELECT ''contact.email_permission already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contact' AND COLUMN_NAME = 'phone_permission') = 0,
  'ALTER TABLE `contact` ADD COLUMN `phone_permission` TINYINT(1) DEFAULT 1 AFTER `email_permission`',
  'SELECT ''contact.phone_permission already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contact' AND COLUMN_NAME = 'sms_permission') = 0,
  'ALTER TABLE `contact` ADD COLUMN `sms_permission` TINYINT(1) DEFAULT 0 AFTER `phone_permission`',
  'SELECT ''contact.sms_permission already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contact' AND COLUMN_NAME = 'whatsapp_permission') = 0,
  'ALTER TABLE `contact` ADD COLUMN `whatsapp_permission` TINYINT(1) DEFAULT 0 AFTER `sms_permission`',
  'SELECT ''contact.whatsapp_permission already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

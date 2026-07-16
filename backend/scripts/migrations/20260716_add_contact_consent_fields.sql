SET @schema_name = DATABASE();

SET @add_unsubscribed = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contact' AND COLUMN_NAME = 'unsubscribed') = 0,
  'ALTER TABLE `contact` ADD COLUMN `unsubscribed` TINYINT(1) NOT NULL DEFAULT 0 AFTER `whatsapp_permission`',
  'SELECT ''contact.unsubscribed already exists'' AS message'
);
PREPARE stmt FROM @add_unsubscribed;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_do_not_contact = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contact' AND COLUMN_NAME = 'do_not_contact') = 0,
  'ALTER TABLE `contact` ADD COLUMN `do_not_contact` TINYINT(1) NOT NULL DEFAULT 0 AFTER `unsubscribed`',
  'SELECT ''contact.do_not_contact already exists'' AS message'
);
PREPARE stmt FROM @add_do_not_contact;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_permission_source = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contact' AND COLUMN_NAME = 'permission_source') = 0,
  'ALTER TABLE `contact` ADD COLUMN `permission_source` VARCHAR(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `do_not_contact`',
  'SELECT ''contact.permission_source already exists'' AS message'
);
PREPARE stmt FROM @add_permission_source;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_opt_in_at = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contact' AND COLUMN_NAME = 'opt_in_at') = 0,
  'ALTER TABLE `contact` ADD COLUMN `opt_in_at` DATETIME DEFAULT NULL AFTER `permission_source`',
  'SELECT ''contact.opt_in_at already exists'' AS message'
);
PREPARE stmt FROM @add_opt_in_at;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_opt_out_at = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contact' AND COLUMN_NAME = 'opt_out_at') = 0,
  'ALTER TABLE `contact` ADD COLUMN `opt_out_at` DATETIME DEFAULT NULL AFTER `opt_in_at`',
  'SELECT ''contact.opt_out_at already exists'' AS message'
);
PREPARE stmt FROM @add_opt_out_at;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_consent_updated_at = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contact' AND COLUMN_NAME = 'consent_updated_at') = 0,
  'ALTER TABLE `contact` ADD COLUMN `consent_updated_at` DATETIME DEFAULT NULL AFTER `opt_out_at`',
  'SELECT ''contact.consent_updated_at already exists'' AS message'
);
PREPARE stmt FROM @add_consent_updated_at;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_contact_permission_status_index = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contact' AND INDEX_NAME = 'idx_contact_permission_status') = 0,
  'ALTER TABLE `contact` ADD INDEX `idx_contact_permission_status` (`clinic_id`, `do_not_contact`, `unsubscribed`)',
  'SELECT ''idx_contact_permission_status already exists'' AS message'
);
PREPARE stmt FROM @add_contact_permission_status_index;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_contact_permission_source_index = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contact' AND INDEX_NAME = 'idx_contact_permission_source') = 0,
  'ALTER TABLE `contact` ADD INDEX `idx_contact_permission_source` (`clinic_id`, `permission_source`)',
  'SELECT ''idx_contact_permission_source already exists'' AS message'
);
PREPARE stmt FROM @add_contact_permission_source_index;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

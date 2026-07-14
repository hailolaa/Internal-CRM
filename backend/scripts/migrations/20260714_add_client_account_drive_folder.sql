SET @schema_name = DATABASE();

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'client_account_profile' AND COLUMN_NAME = 'google_drive_folder_id') = 0,
  'ALTER TABLE `client_account_profile` ADD COLUMN `google_drive_folder_id` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `key_notes`',
  'SELECT ''client_account_profile.google_drive_folder_id already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'client_account_profile' AND COLUMN_NAME = 'google_drive_folder_url') = 0,
  'ALTER TABLE `client_account_profile` ADD COLUMN `google_drive_folder_url` VARCHAR(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `google_drive_folder_id`',
  'SELECT ''client_account_profile.google_drive_folder_url already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'client_account_profile' AND COLUMN_NAME = 'google_drive_folder_name') = 0,
  'ALTER TABLE `client_account_profile` ADD COLUMN `google_drive_folder_name` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `google_drive_folder_url`',
  'SELECT ''client_account_profile.google_drive_folder_name already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'client_account_profile' AND COLUMN_NAME = 'google_drive_folder_access_status') = 0,
  'ALTER TABLE `client_account_profile` ADD COLUMN `google_drive_folder_access_status` ENUM(''not_checked'',''accessible'',''inaccessible'') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT ''not_checked'' AFTER `google_drive_folder_name`',
  'SELECT ''client_account_profile.google_drive_folder_access_status already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'client_account_profile' AND COLUMN_NAME = 'google_drive_folder_error') = 0,
  'ALTER TABLE `client_account_profile` ADD COLUMN `google_drive_folder_error` VARCHAR(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `google_drive_folder_access_status`',
  'SELECT ''client_account_profile.google_drive_folder_error already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'client_account_profile' AND COLUMN_NAME = 'google_drive_folder_checked_at') = 0,
  'ALTER TABLE `client_account_profile` ADD COLUMN `google_drive_folder_checked_at` DATETIME DEFAULT NULL AFTER `google_drive_folder_error`',
  'SELECT ''client_account_profile.google_drive_folder_checked_at already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'client_account_profile' AND INDEX_NAME = 'idx_client_account_profile_drive_folder') = 0,
  'ALTER TABLE `client_account_profile` ADD INDEX `idx_client_account_profile_drive_folder` (`clinic_id`, `google_drive_folder_id`)',
  'SELECT ''idx_client_account_profile_drive_folder already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

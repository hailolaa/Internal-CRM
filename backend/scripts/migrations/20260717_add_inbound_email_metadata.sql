SET @schema_name = DATABASE();

SET @add_email_provider_message_id = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'email' AND COLUMN_NAME = 'provider_message_id') = 0,
  'ALTER TABLE `email` ADD COLUMN `provider_message_id` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `id`',
  'SELECT ''email.provider_message_id already exists'' AS message'
);
PREPARE stmt FROM @add_email_provider_message_id;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_email_from_email = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'email' AND COLUMN_NAME = 'from_email') = 0,
  'ALTER TABLE `email` ADD COLUMN `from_email` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `user_id`',
  'SELECT ''email.from_email already exists'' AS message'
);
PREPARE stmt FROM @add_email_from_email;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_email_to_email = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'email' AND COLUMN_NAME = 'to_email') = 0,
  'ALTER TABLE `email` ADD COLUMN `to_email` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `from_email`',
  'SELECT ''email.to_email already exists'' AS message'
);
PREPARE stmt FROM @add_email_to_email;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_email_received_at = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'email' AND COLUMN_NAME = 'received_at') = 0,
  'ALTER TABLE `email` ADD COLUMN `received_at` DATETIME DEFAULT NULL AFTER `status`',
  'SELECT ''email.received_at already exists'' AS message'
);
PREPARE stmt FROM @add_email_received_at;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_email_provider_message_index = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'email' AND INDEX_NAME = 'idx_email_provider_message') = 0,
  'ALTER TABLE `email` ADD UNIQUE INDEX `idx_email_provider_message` (`clinic_id`, `provider_message_id`)',
  'SELECT ''idx_email_provider_message already exists'' AS message'
);
PREPARE stmt FROM @add_email_provider_message_index;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_email_from_index = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'email' AND INDEX_NAME = 'idx_email_from') = 0,
  'ALTER TABLE `email` ADD INDEX `idx_email_from` (`clinic_id`, `from_email`)',
  'SELECT ''idx_email_from already exists'' AS message'
);
PREPARE stmt FROM @add_email_from_index;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_email_to_index = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'email' AND INDEX_NAME = 'idx_email_to') = 0,
  'ALTER TABLE `email` ADD INDEX `idx_email_to` (`clinic_id`, `to_email`)',
  'SELECT ''idx_email_to already exists'' AS message'
);
PREPARE stmt FROM @add_email_to_index;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

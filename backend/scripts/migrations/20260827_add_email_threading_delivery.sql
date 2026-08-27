SET @schema_name = DATABASE();

SET @add_email_thread_id = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'email' AND COLUMN_NAME = 'thread_id') = 0,
  'ALTER TABLE `email` ADD COLUMN `thread_id` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `provider_message_id`',
  'SELECT ''email.thread_id already exists'' AS message'
);
PREPARE stmt FROM @add_email_thread_id;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_email_in_reply_to = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'email' AND COLUMN_NAME = 'in_reply_to') = 0,
  'ALTER TABLE `email` ADD COLUMN `in_reply_to` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `thread_id`',
  'SELECT ''email.in_reply_to already exists'' AS message'
);
PREPARE stmt FROM @add_email_in_reply_to;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_email_reference_ids = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'email' AND COLUMN_NAME = 'reference_ids') = 0,
  'ALTER TABLE `email` ADD COLUMN `reference_ids` JSON DEFAULT NULL AFTER `in_reply_to`',
  'SELECT ''email.reference_ids already exists'' AS message'
);
PREPARE stmt FROM @add_email_reference_ids;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_email_bounced_at = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'email' AND COLUMN_NAME = 'bounced_at') = 0,
  'ALTER TABLE `email` ADD COLUMN `bounced_at` DATETIME DEFAULT NULL AFTER `received_at`',
  'SELECT ''email.bounced_at already exists'' AS message'
);
PREPARE stmt FROM @add_email_bounced_at;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_email_bounce_reason = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'email' AND COLUMN_NAME = 'bounce_reason') = 0,
  'ALTER TABLE `email` ADD COLUMN `bounce_reason` VARCHAR(1000) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `bounced_at`',
  'SELECT ''email.bounce_reason already exists'' AS message'
);
PREPARE stmt FROM @add_email_bounce_reason;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_email_thread_index = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'email' AND INDEX_NAME = 'idx_email_thread') = 0,
  'ALTER TABLE `email` ADD INDEX `idx_email_thread` (`clinic_id`, `thread_id`, `created_at`)',
  'SELECT ''idx_email_thread already exists'' AS message'
);
PREPARE stmt FROM @add_email_thread_index;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE email SET thread_id = id WHERE thread_id IS NULL;

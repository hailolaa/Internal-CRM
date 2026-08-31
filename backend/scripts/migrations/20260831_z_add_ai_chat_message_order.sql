SET @schema_name = DATABASE();

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'ai_chat_message' AND COLUMN_NAME = 'message_index') = 0,
  'ALTER TABLE `ai_chat_message` ADD COLUMN `message_index` INT NOT NULL DEFAULT 0 AFTER `citations`',
  'SELECT ''ai_chat_message.message_index already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'ai_chat_message' AND INDEX_NAME = 'uk_ai_chat_message_session_index') = 0,
  'ALTER TABLE `ai_chat_message` ADD UNIQUE KEY `uk_ai_chat_message_session_index` (`session_id`, `message_index`)',
  'SELECT ''uk_ai_chat_message_session_index already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

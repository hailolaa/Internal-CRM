-- CG-138: Support ticket intake channel, SLA, escalation and resolution evidence.
SET @schema_name := DATABASE();

SET @sql := IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'client_account_issue' AND COLUMN_NAME = 'source_channel') = 0,
  'ALTER TABLE `client_account_issue` ADD COLUMN `source_channel` ENUM(''manual'',''email'',''phone'',''whatsapp'',''meeting'',''client_portal'',''other'') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT ''manual'' AFTER `status`',
  'SELECT ''client_account_issue.source_channel already exists'' AS migration_note'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'client_account_issue' AND COLUMN_NAME = 'sla_due_at') = 0,
  'ALTER TABLE `client_account_issue` ADD COLUMN `sla_due_at` DATETIME DEFAULT NULL AFTER `due_date`',
  'SELECT ''client_account_issue.sla_due_at already exists'' AS migration_note'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'client_account_issue' AND COLUMN_NAME = 'escalated_at') = 0,
  'ALTER TABLE `client_account_issue` ADD COLUMN `escalated_at` DATETIME DEFAULT NULL AFTER `sla_due_at`',
  'SELECT ''client_account_issue.escalated_at already exists'' AS migration_note'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'client_account_issue' AND COLUMN_NAME = 'resolved_at') = 0,
  'ALTER TABLE `client_account_issue` ADD COLUMN `resolved_at` DATETIME DEFAULT NULL AFTER `escalated_at`',
  'SELECT ''client_account_issue.resolved_at already exists'' AS migration_note'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'client_account_issue' AND INDEX_NAME = 'idx_client_issue_sla') = 0,
  'ALTER TABLE `client_account_issue` ADD INDEX `idx_client_issue_sla` (`clinic_id`, `status`, `sla_due_at`, `escalated_at`)',
  'SELECT ''client_account_issue.idx_client_issue_sla already exists'' AS migration_note'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

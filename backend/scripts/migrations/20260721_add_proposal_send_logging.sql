-- MC-037: Proposal send/logging workflow.
-- Append-only production migration. Do not edit earlier migration history.

SET @schema_name = DATABASE();

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'proposal' AND COLUMN_NAME = 'sent_to_email') = 0,
  'ALTER TABLE `proposal` ADD COLUMN `sent_to_email` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `sent_at`',
  'SELECT ''proposal.sent_to_email already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'proposal' AND COLUMN_NAME = 'sent_to_name') = 0,
  'ALTER TABLE `proposal` ADD COLUMN `sent_to_name` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `sent_to_email`',
  'SELECT ''proposal.sent_to_name already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'proposal' AND COLUMN_NAME = 'send_method') = 0,
  'ALTER TABLE `proposal` ADD COLUMN `send_method` VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `sent_to_name`',
  'SELECT ''proposal.send_method already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'proposal' AND COLUMN_NAME = 'send_note') = 0,
  'ALTER TABLE `proposal` ADD COLUMN `send_note` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `send_method`',
  'SELECT ''proposal.send_note already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'proposal' AND COLUMN_NAME = 'sent_by') = 0,
  'ALTER TABLE `proposal` ADD COLUMN `sent_by` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `send_note`',
  'SELECT ''proposal.sent_by already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'proposal' AND INDEX_NAME = 'idx_proposal_sent_at') = 0,
  'ALTER TABLE `proposal` ADD INDEX `idx_proposal_sent_at` (`clinic_id`, `sent_at`, `status`)',
  'SELECT ''idx_proposal_sent_at already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'proposal' AND INDEX_NAME = 'fk_proposal_sent_by') = 0,
  'ALTER TABLE `proposal` ADD INDEX `fk_proposal_sent_by` (`sent_by`)',
  'SELECT ''fk_proposal_sent_by index already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'proposal' AND CONSTRAINT_NAME = 'fk_proposal_sent_by') = 0,
  'ALTER TABLE `proposal` ADD CONSTRAINT `fk_proposal_sent_by` FOREIGN KEY (`sent_by`) REFERENCES `user` (`id`) ON DELETE SET NULL',
  'SELECT ''fk_proposal_sent_by already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

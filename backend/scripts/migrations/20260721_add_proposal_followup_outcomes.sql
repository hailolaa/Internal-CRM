-- MC-038: Proposal follow-up and outcome tracking.
-- Append-only production migration. Do not edit earlier migration history.

SET @schema_name = DATABASE();

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'proposal' AND COLUMN_NAME = 'accepted_reason') = 0,
  'ALTER TABLE `proposal` ADD COLUMN `accepted_reason` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `accepted_at`',
  'SELECT ''proposal.accepted_reason already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'proposal' AND COLUMN_NAME = 'won_reason') = 0,
  'ALTER TABLE `proposal` ADD COLUMN `won_reason` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `won_at`',
  'SELECT ''proposal.won_reason already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'proposal' AND COLUMN_NAME = 'lost_reason') = 0,
  'ALTER TABLE `proposal` ADD COLUMN `lost_reason` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `lost_at`',
  'SELECT ''proposal.lost_reason already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'proposal' AND INDEX_NAME = 'idx_proposal_outcome_reporting') = 0,
  'ALTER TABLE `proposal` ADD INDEX `idx_proposal_outcome_reporting` (`clinic_id`, `status`, `accepted_at`, `won_at`, `lost_at`)',
  'SELECT ''idx_proposal_outcome_reporting already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

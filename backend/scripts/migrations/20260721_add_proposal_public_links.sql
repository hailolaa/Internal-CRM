-- MC-036: Unique public proposal links.
-- Append-only production migration. Do not edit earlier migration history.

SET @schema_name = DATABASE();

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'proposal' AND COLUMN_NAME = 'public_token_hash') = 0,
  'ALTER TABLE `proposal` ADD COLUMN `public_token_hash` CHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `proposal_url`',
  'SELECT ''proposal.public_token_hash already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'proposal' AND COLUMN_NAME = 'public_link_created_at') = 0,
  'ALTER TABLE `proposal` ADD COLUMN `public_link_created_at` DATETIME DEFAULT NULL AFTER `public_token_hash`',
  'SELECT ''proposal.public_link_created_at already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'proposal' AND COLUMN_NAME = 'public_last_accessed_at') = 0,
  'ALTER TABLE `proposal` ADD COLUMN `public_last_accessed_at` DATETIME DEFAULT NULL AFTER `public_link_created_at`',
  'SELECT ''proposal.public_last_accessed_at already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'proposal' AND INDEX_NAME = 'idx_proposal_public_token_hash') = 0,
  'ALTER TABLE `proposal` ADD UNIQUE INDEX `idx_proposal_public_token_hash` (`public_token_hash`)',
  'SELECT ''idx_proposal_public_token_hash already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

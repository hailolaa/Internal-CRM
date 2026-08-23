SET @schema_name = DATABASE();

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'proposal_scope_item' AND COLUMN_NAME = 'deliverables') = 0,
  'ALTER TABLE `proposal_scope_item` ADD COLUMN `deliverables` JSON DEFAULT NULL AFTER `client_description`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'proposal_scope_item' AND COLUMN_NAME = 'status') = 0,
  'ALTER TABLE `proposal_scope_item` ADD COLUMN `status` VARCHAR(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT ''active'' AFTER `is_active`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'proposal_scope_item' AND COLUMN_NAME = 'version') = 0,
  'ALTER TABLE `proposal_scope_item` ADD COLUMN `version` INT NOT NULL DEFAULT 1 AFTER `status`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'proposal_scope_item' AND COLUMN_NAME = 'created_by') = 0,
  'ALTER TABLE `proposal_scope_item` ADD COLUMN `created_by` CHAR(36) DEFAULT NULL AFTER `version`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'proposal_scope_item' AND COLUMN_NAME = 'updated_by') = 0,
  'ALTER TABLE `proposal_scope_item` ADD COLUMN `updated_by` CHAR(36) DEFAULT NULL AFTER `created_by`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'proposal_scope_item' AND COLUMN_NAME = 'archived_at') = 0,
  'ALTER TABLE `proposal_scope_item` ADD COLUMN `archived_at` DATETIME DEFAULT NULL AFTER `updated_by`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE `proposal_scope_item`
SET `status` = CASE WHEN `is_active` = 1 THEN 'active' ELSE 'archived' END
WHERE `status` NOT IN ('active', 'archived');

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'proposal_scope_item' AND INDEX_NAME = 'idx_proposal_scope_item_status_search') = 0,
  'ALTER TABLE `proposal_scope_item` ADD INDEX `idx_proposal_scope_item_status_search` (`clinic_id`, `status`, `category`, `title`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- MC-033: Proposal create/edit workflow fields.
-- Append-only production migration. Do not edit earlier migration history.

SET @schema_name = DATABASE();

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'proposal' AND COLUMN_NAME = 'template_key') = 0,
  'ALTER TABLE `proposal` ADD COLUMN `template_key` VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT ''clinicgrower_standard'' AFTER `proposal_name`',
  'SELECT ''proposal.template_key already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'proposal' AND COLUMN_NAME = 'recommended_package_id') = 0,
  'ALTER TABLE `proposal` ADD COLUMN `recommended_package_id` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `package_name`',
  'SELECT ''proposal.recommended_package_id already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'proposal' AND COLUMN_NAME = 'section_content') = 0,
  'ALTER TABLE `proposal` ADD COLUMN `section_content` JSON DEFAULT NULL AFTER `notes`',
  'SELECT ''proposal.section_content already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'proposal' AND COLUMN_NAME = 'draft_saved_at') = 0,
  'ALTER TABLE `proposal` ADD COLUMN `draft_saved_at` DATETIME DEFAULT NULL AFTER `section_content`',
  'SELECT ''proposal.draft_saved_at already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'proposal' AND INDEX_NAME = 'idx_proposal_template') = 0,
  'ALTER TABLE `proposal` ADD INDEX `idx_proposal_template` (`clinic_id`, `template_key`)',
  'SELECT ''idx_proposal_template already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'proposal' AND INDEX_NAME = 'idx_proposal_recommended_package') = 0,
  'ALTER TABLE `proposal` ADD INDEX `idx_proposal_recommended_package` (`clinic_id`, `recommended_package_id`)',
  'SELECT ''idx_proposal_recommended_package already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'proposal' AND CONSTRAINT_NAME = 'fk_proposal_recommended_package') = 0,
  'ALTER TABLE `proposal` ADD CONSTRAINT `fk_proposal_recommended_package` FOREIGN KEY (`recommended_package_id`) REFERENCES `growth_package` (`id`) ON DELETE SET NULL',
  'SELECT ''fk_proposal_recommended_package already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

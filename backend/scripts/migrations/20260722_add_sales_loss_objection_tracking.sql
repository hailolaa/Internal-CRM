-- MC-040: Structured lost reason and objection tracking for sales data.
SET @schema_name = DATABASE();

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'deal' AND COLUMN_NAME = 'objection_type') = 0,
  'ALTER TABLE `deal` ADD COLUMN `objection_type` VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `lost_reason`',
  'SELECT ''deal.objection_type already exists'' AS message'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contact' AND COLUMN_NAME = 'lost_reason') = 0,
  'ALTER TABLE `contact` ADD COLUMN `lost_reason` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `lead_status`',
  'SELECT ''contact.lost_reason already exists'' AS message'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contact' AND COLUMN_NAME = 'objection_type') = 0,
  'ALTER TABLE `contact` ADD COLUMN `objection_type` VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `lost_reason`',
  'SELECT ''contact.objection_type already exists'' AS message'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'proposal' AND COLUMN_NAME = 'objection_type') = 0,
  'ALTER TABLE `proposal` ADD COLUMN `objection_type` VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `lost_reason`',
  'SELECT ''proposal.objection_type already exists'' AS message'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'deal' AND INDEX_NAME = 'idx_deal_loss_reporting') = 0,
  'ALTER TABLE `deal` ADD INDEX `idx_deal_loss_reporting` (`clinic_id`, `status`, `lost_reason`, `objection_type`, `lost_at`)',
  'SELECT ''idx_deal_loss_reporting already exists'' AS message'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contact' AND INDEX_NAME = 'idx_contact_loss_reporting') = 0,
  'ALTER TABLE `contact` ADD INDEX `idx_contact_loss_reporting` (`clinic_id`, `lead_status`, `lost_reason`, `objection_type`)',
  'SELECT ''idx_contact_loss_reporting already exists'' AS message'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'proposal' AND INDEX_NAME = 'idx_proposal_loss_reporting') = 0,
  'ALTER TABLE `proposal` ADD INDEX `idx_proposal_loss_reporting` (`clinic_id`, `status`, `lost_reason`, `objection_type`, `lost_at`)',
  'SELECT ''idx_proposal_loss_reporting already exists'' AS message'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @schema_name = DATABASE();

SET @add_contact_audit_status = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contact' AND COLUMN_NAME = 'audit_status') = 0,
  'ALTER TABLE `contact` ADD COLUMN `audit_status` VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `growth_score_updated_at`',
  'SELECT ''contact.audit_status already exists'' AS message'
);
PREPARE stmt FROM @add_contact_audit_status;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_contact_audit_assigned_to = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contact' AND COLUMN_NAME = 'audit_assigned_to') = 0,
  'ALTER TABLE `contact` ADD COLUMN `audit_assigned_to` VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `audit_status`',
  'SELECT ''contact.audit_assigned_to already exists'' AS message'
);
PREPARE stmt FROM @add_contact_audit_assigned_to;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_contact_audit_follow_up_due_at = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contact' AND COLUMN_NAME = 'audit_follow_up_due_at') = 0,
  'ALTER TABLE `contact` ADD COLUMN `audit_follow_up_due_at` DATETIME DEFAULT NULL AFTER `audit_assigned_to`',
  'SELECT ''contact.audit_follow_up_due_at already exists'' AS message'
);
PREPARE stmt FROM @add_contact_audit_follow_up_due_at;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_contact_audit_status_updated_at = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contact' AND COLUMN_NAME = 'audit_status_updated_at') = 0,
  'ALTER TABLE `contact` ADD COLUMN `audit_status_updated_at` DATETIME DEFAULT NULL AFTER `audit_follow_up_due_at`',
  'SELECT ''contact.audit_status_updated_at already exists'' AS message'
);
PREPARE stmt FROM @add_contact_audit_status_updated_at;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_contact_audit_status_index = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contact' AND INDEX_NAME = 'idx_contact_audit_status') = 0,
  'ALTER TABLE `contact` ADD INDEX `idx_contact_audit_status` (`clinic_id`, `audit_status`)',
  'SELECT ''idx_contact_audit_status already exists'' AS message'
);
PREPARE stmt FROM @add_contact_audit_status_index;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_contact_audit_due_index = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contact' AND INDEX_NAME = 'idx_contact_audit_due') = 0,
  'ALTER TABLE `contact` ADD INDEX `idx_contact_audit_due` (`clinic_id`, `audit_follow_up_due_at`)',
  'SELECT ''idx_contact_audit_due already exists'' AS message'
);
PREPARE stmt FROM @add_contact_audit_due_index;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_deal_audit_status = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'deal' AND COLUMN_NAME = 'audit_status') = 0,
  'ALTER TABLE `deal` ADD COLUMN `audit_status` VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `lost_reason`',
  'SELECT ''deal.audit_status already exists'' AS message'
);
PREPARE stmt FROM @add_deal_audit_status;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_deal_audit_assigned_to = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'deal' AND COLUMN_NAME = 'audit_assigned_to') = 0,
  'ALTER TABLE `deal` ADD COLUMN `audit_assigned_to` VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `audit_status`',
  'SELECT ''deal.audit_assigned_to already exists'' AS message'
);
PREPARE stmt FROM @add_deal_audit_assigned_to;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_deal_audit_follow_up_due_at = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'deal' AND COLUMN_NAME = 'audit_follow_up_due_at') = 0,
  'ALTER TABLE `deal` ADD COLUMN `audit_follow_up_due_at` DATETIME DEFAULT NULL AFTER `audit_assigned_to`',
  'SELECT ''deal.audit_follow_up_due_at already exists'' AS message'
);
PREPARE stmt FROM @add_deal_audit_follow_up_due_at;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_deal_audit_status_updated_at = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'deal' AND COLUMN_NAME = 'audit_status_updated_at') = 0,
  'ALTER TABLE `deal` ADD COLUMN `audit_status_updated_at` DATETIME DEFAULT NULL AFTER `audit_follow_up_due_at`',
  'SELECT ''deal.audit_status_updated_at already exists'' AS message'
);
PREPARE stmt FROM @add_deal_audit_status_updated_at;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_deal_audit_status_index = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'deal' AND INDEX_NAME = 'idx_deal_audit_status') = 0,
  'ALTER TABLE `deal` ADD INDEX `idx_deal_audit_status` (`clinic_id`, `audit_status`)',
  'SELECT ''idx_deal_audit_status already exists'' AS message'
);
PREPARE stmt FROM @add_deal_audit_status_index;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_deal_audit_due_index = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'deal' AND INDEX_NAME = 'idx_deal_audit_due') = 0,
  'ALTER TABLE `deal` ADD INDEX `idx_deal_audit_due` (`clinic_id`, `audit_follow_up_due_at`)',
  'SELECT ''idx_deal_audit_due already exists'' AS message'
);
PREPARE stmt FROM @add_deal_audit_due_index;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

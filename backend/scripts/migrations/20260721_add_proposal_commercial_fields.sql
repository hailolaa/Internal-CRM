-- MC-035: Structured proposal pricing and commercial fields.
-- Append-only production migration. Do not edit earlier migration history.

SET @schema_name = DATABASE();

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'proposal' AND COLUMN_NAME = 'monthly_fee_cents') = 0,
  'ALTER TABLE `proposal` ADD COLUMN `monthly_fee_cents` INT DEFAULT NULL AFTER `value`',
  'SELECT ''proposal.monthly_fee_cents already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'proposal' AND COLUMN_NAME = 'setup_fee_cents') = 0,
  'ALTER TABLE `proposal` ADD COLUMN `setup_fee_cents` INT DEFAULT NULL AFTER `monthly_fee_cents`',
  'SELECT ''proposal.setup_fee_cents already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'proposal' AND COLUMN_NAME = 'ad_spend_note') = 0,
  'ALTER TABLE `proposal` ADD COLUMN `ad_spend_note` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `setup_fee_cents`',
  'SELECT ''proposal.ad_spend_note already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'proposal' AND COLUMN_NAME = 'vat_status') = 0,
  'ALTER TABLE `proposal` ADD COLUMN `vat_status` VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `ad_spend_note`',
  'SELECT ''proposal.vat_status already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'proposal' AND COLUMN_NAME = 'minimum_term_months') = 0,
  'ALTER TABLE `proposal` ADD COLUMN `minimum_term_months` INT DEFAULT NULL AFTER `vat_status`',
  'SELECT ''proposal.minimum_term_months already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'proposal' AND COLUMN_NAME = 'notice_period_days') = 0,
  'ALTER TABLE `proposal` ADD COLUMN `notice_period_days` INT DEFAULT NULL AFTER `minimum_term_months`',
  'SELECT ''proposal.notice_period_days already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'proposal' AND COLUMN_NAME = 'start_date') = 0,
  'ALTER TABLE `proposal` ADD COLUMN `start_date` DATE DEFAULT NULL AFTER `notice_period_days`',
  'SELECT ''proposal.start_date already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'proposal' AND COLUMN_NAME = 'add_ons') = 0,
  'ALTER TABLE `proposal` ADD COLUMN `add_ons` JSON DEFAULT NULL AFTER `start_date`',
  'SELECT ''proposal.add_ons already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'proposal' AND COLUMN_NAME = 'discounts') = 0,
  'ALTER TABLE `proposal` ADD COLUMN `discounts` JSON DEFAULT NULL AFTER `add_ons`',
  'SELECT ''proposal.discounts already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'proposal' AND COLUMN_NAME = 'internal_margin_note') = 0,
  'ALTER TABLE `proposal` ADD COLUMN `internal_margin_note` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `discounts`',
  'SELECT ''proposal.internal_margin_note already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'proposal' AND INDEX_NAME = 'idx_proposal_commercial_reporting') = 0,
  'ALTER TABLE `proposal` ADD INDEX `idx_proposal_commercial_reporting` (`clinic_id`, `status`, `monthly_fee_cents`, `start_date`, `expires_at`)',
  'SELECT ''idx_proposal_commercial_reporting already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

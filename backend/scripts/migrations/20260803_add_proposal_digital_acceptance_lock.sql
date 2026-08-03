-- MC-068: Digital proposal acceptance evidence and locked accepted version fields.
SET @schema_name = DATABASE();

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'proposal_acceptance_record' AND COLUMN_NAME = 'legal_company_name') = 0,
  'ALTER TABLE `proposal_acceptance_record` ADD COLUMN `legal_company_name` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `accepted_by_email`',
  'SELECT ''proposal_acceptance_record.legal_company_name already exists'' AS message'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'proposal_acceptance_record' AND COLUMN_NAME = 'billing_email') = 0,
  'ALTER TABLE `proposal_acceptance_record` ADD COLUMN `billing_email` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `legal_company_name`',
  'SELECT ''proposal_acceptance_record.billing_email already exists'' AS message'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'proposal_acceptance_record' AND COLUMN_NAME = 'preferred_start_date') = 0,
  'ALTER TABLE `proposal_acceptance_record` ADD COLUMN `preferred_start_date` DATE DEFAULT NULL AFTER `billing_email`',
  'SELECT ''proposal_acceptance_record.preferred_start_date already exists'' AS message'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'proposal_acceptance_record' AND COLUMN_NAME = 'agreement_accepted') = 0,
  'ALTER TABLE `proposal_acceptance_record` ADD COLUMN `agreement_accepted` TINYINT(1) NOT NULL DEFAULT 0 AFTER `preferred_start_date`',
  'SELECT ''proposal_acceptance_record.agreement_accepted already exists'' AS message'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'proposal_acceptance_record' AND COLUMN_NAME = 'confirmation_text') = 0,
  'ALTER TABLE `proposal_acceptance_record` ADD COLUMN `confirmation_text` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `agreement_accepted`',
  'SELECT ''proposal_acceptance_record.confirmation_text already exists'' AS message'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'proposal_acceptance_record' AND COLUMN_NAME = 'acceptance_source') = 0,
  'ALTER TABLE `proposal_acceptance_record` ADD COLUMN `acceptance_source` VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `confirmation_text`',
  'SELECT ''proposal_acceptance_record.acceptance_source already exists'' AS message'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'proposal_acceptance_record' AND COLUMN_NAME = 'accepted_ip_address') = 0,
  'ALTER TABLE `proposal_acceptance_record` ADD COLUMN `accepted_ip_address` VARCHAR(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `acceptance_source`',
  'SELECT ''proposal_acceptance_record.accepted_ip_address already exists'' AS message'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'proposal_acceptance_record' AND COLUMN_NAME = 'accepted_user_agent') = 0,
  'ALTER TABLE `proposal_acceptance_record` ADD COLUMN `accepted_user_agent` VARCHAR(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `accepted_ip_address`',
  'SELECT ''proposal_acceptance_record.accepted_user_agent already exists'' AS message'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'proposal_acceptance_record' AND COLUMN_NAME = 'evidence_sha256') = 0,
  'ALTER TABLE `proposal_acceptance_record` ADD COLUMN `evidence_sha256` CHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `accepted_user_agent`',
  'SELECT ''proposal_acceptance_record.evidence_sha256 already exists'' AS message'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'proposal_acceptance_record' AND COLUMN_NAME = 'locked_at') = 0,
  'ALTER TABLE `proposal_acceptance_record` ADD COLUMN `locked_at` DATETIME DEFAULT NULL AFTER `evidence_sha256`',
  'SELECT ''proposal_acceptance_record.locked_at already exists'' AS message'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'proposal_acceptance_record' AND INDEX_NAME = 'idx_proposal_acceptance_evidence') = 0,
  'ALTER TABLE `proposal_acceptance_record` ADD INDEX `idx_proposal_acceptance_evidence` (`clinic_id`, `locked_at`, `acceptance_source`)',
  'SELECT ''idx_proposal_acceptance_evidence already exists'' AS message'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

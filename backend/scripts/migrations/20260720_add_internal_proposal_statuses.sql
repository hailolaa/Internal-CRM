-- MC-031: Internal proposal data model and statuses.
-- Append-only production migration. Do not edit earlier migration history.
-- Safe to run when the older proposal table already exists.

SET @schema_name = DATABASE();

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'proposal') = 0,
  'CREATE TABLE `proposal` (
    `id` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    `clinic_id` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    `contact_id` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    `deal_id` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    `client_account_profile_id` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    `proposal_name` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    `package_name` VARCHAR(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    `owner_id` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    `status` ENUM(''draft'',''ready'',''sent'',''viewed'',''follow_up_due'',''accepted'',''won'',''lost'',''expired'',''archived'') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT ''draft'',
    `value` DECIMAL(12,2) DEFAULT NULL,
    `currency` CHAR(3) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT ''GBP'',
    `follow_up_at` DATETIME DEFAULT NULL,
    `ready_at` DATETIME DEFAULT NULL,
    `sent_at` DATETIME DEFAULT NULL,
    `viewed_at` DATETIME DEFAULT NULL,
    `accepted_at` DATETIME DEFAULT NULL,
    `won_at` DATETIME DEFAULT NULL,
    `lost_at` DATETIME DEFAULT NULL,
    `expires_at` DATETIME DEFAULT NULL,
    `proposal_url` VARCHAR(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    `notes` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
    `created_by` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    `updated_by` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at` DATETIME DEFAULT NULL,
    PRIMARY KEY (`id`),
    KEY `idx_proposal_clinic_status` (`clinic_id`, `status`, `deleted_at`),
    KEY `idx_proposal_contact` (`contact_id`),
    KEY `idx_proposal_deal` (`deal_id`),
    KEY `idx_proposal_client_account` (`client_account_profile_id`),
    KEY `idx_proposal_owner_follow_up` (`clinic_id`, `owner_id`, `follow_up_at`),
    KEY `idx_proposal_follow_up` (`clinic_id`, `follow_up_at`, `status`),
    CONSTRAINT `fk_proposal_clinic` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_proposal_contact` FOREIGN KEY (`contact_id`) REFERENCES `contact` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_proposal_deal` FOREIGN KEY (`deal_id`) REFERENCES `deal` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_proposal_client_account` FOREIGN KEY (`client_account_profile_id`) REFERENCES `client_account_profile` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_proposal_owner` FOREIGN KEY (`owner_id`) REFERENCES `user` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_proposal_created_by` FOREIGN KEY (`created_by`) REFERENCES `user` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_proposal_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `user` (`id`) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
  'SELECT ''proposal table already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE `proposal`
SET `status` = 'lost'
WHERE `status` = 'declined';

ALTER TABLE `proposal`
  MODIFY COLUMN `status` ENUM('draft','ready','sent','viewed','follow_up_due','accepted','won','lost','expired','archived') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft';

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'proposal' AND COLUMN_NAME = 'owner_id') = 0,
  'ALTER TABLE `proposal` ADD COLUMN `owner_id` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `package_name`',
  'SELECT ''proposal.owner_id already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'proposal' AND COLUMN_NAME = 'follow_up_at') = 0,
  'ALTER TABLE `proposal` ADD COLUMN `follow_up_at` DATETIME DEFAULT NULL AFTER `currency`',
  'SELECT ''proposal.follow_up_at already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'proposal' AND COLUMN_NAME = 'ready_at') = 0,
  'ALTER TABLE `proposal` ADD COLUMN `ready_at` DATETIME DEFAULT NULL AFTER `follow_up_at`',
  'SELECT ''proposal.ready_at already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'proposal' AND COLUMN_NAME = 'viewed_at') = 0,
  'ALTER TABLE `proposal` ADD COLUMN `viewed_at` DATETIME DEFAULT NULL AFTER `sent_at`',
  'SELECT ''proposal.viewed_at already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'proposal' AND COLUMN_NAME = 'won_at') = 0,
  'ALTER TABLE `proposal` ADD COLUMN `won_at` DATETIME DEFAULT NULL AFTER `accepted_at`',
  'SELECT ''proposal.won_at already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'proposal' AND COLUMN_NAME = 'lost_at') = 0,
  'ALTER TABLE `proposal` ADD COLUMN `lost_at` DATETIME DEFAULT NULL AFTER `won_at`',
  'SELECT ''proposal.lost_at already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'proposal' AND INDEX_NAME = 'idx_proposal_owner_follow_up') = 0,
  'ALTER TABLE `proposal` ADD INDEX `idx_proposal_owner_follow_up` (`clinic_id`, `owner_id`, `follow_up_at`)',
  'SELECT ''idx_proposal_owner_follow_up already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'proposal' AND INDEX_NAME = 'idx_proposal_follow_up') = 0,
  'ALTER TABLE `proposal` ADD INDEX `idx_proposal_follow_up` (`clinic_id`, `follow_up_at`, `status`)',
  'SELECT ''idx_proposal_follow_up already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'proposal' AND INDEX_NAME = 'fk_proposal_owner') = 0,
  'ALTER TABLE `proposal` ADD INDEX `fk_proposal_owner` (`owner_id`)',
  'SELECT ''fk_proposal_owner index already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'proposal' AND CONSTRAINT_NAME = 'fk_proposal_owner') = 0,
  'ALTER TABLE `proposal` ADD CONSTRAINT `fk_proposal_owner` FOREIGN KEY (`owner_id`) REFERENCES `user` (`id`) ON DELETE SET NULL',
  'SELECT ''fk_proposal_owner already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

INSERT IGNORE INTO `permission` (`id`, `key_name`, `description`)
VALUES
  ('perm-proposals-read', 'proposals:read', 'Read internal proposals'),
  ('perm-proposals-write', 'proposals:write', 'Create and update internal proposals');

INSERT IGNORE INTO `role_permission` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `role` r
JOIN `permission` p ON p.key_name IN ('proposals:read', 'proposals:write')
WHERE r.name IN ('SUPER_ADMIN', 'ADMIN', 'CLINIC_ADMIN', 'MANAGER', 'SALES');

INSERT IGNORE INTO `role_permission` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `role` r
JOIN `permission` p ON p.key_name = 'proposals:read'
WHERE r.name IN ('DELIVERY', 'FINANCE', 'READ_ONLY', 'INTERNAL_VIEWER');

-- Week 3 internal operations foundation.
-- Reconstructed as an idempotent migration because the original schema changes
-- were retained in db.sql but the incremental migration was not.

CREATE TABLE IF NOT EXISTS `client_account_profile` (
  `id` CHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` CHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `account_manager_id` CHAR(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `active_services` JSON DEFAULT NULL,
  `onboarding_status` ENUM('not_started','in_progress','completed','paused') NOT NULL DEFAULT 'not_started',
  `health_status` ENUM('healthy','attention_needed','at_risk','critical') NOT NULL DEFAULT 'attention_needed',
  `client_status` ENUM('prospect','onboarding','active','paused','at_risk','churned','inactive') NOT NULL DEFAULT 'prospect',
  `current_package` VARCHAR(150) DEFAULT NULL,
  `churn_risk` ENUM('low','medium','high','critical') NOT NULL DEFAULT 'low',
  `renewal_date` DATE DEFAULT NULL,
  `contract_status` ENUM('active','trial','pending','paused','cancelled','expired') NOT NULL DEFAULT 'pending',
  `key_notes` TEXT,
  `created_by` CHAR(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `updated_by` CHAR(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_client_account_profile_clinic` (`clinic_id`),
  KEY `idx_client_account_profile_manager` (`account_manager_id`),
  CONSTRAINT `fk_client_account_profile_clinic` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_client_account_profile_manager` FOREIGN KEY (`account_manager_id`) REFERENCES `user` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_client_account_profile_created_by` FOREIGN KEY (`created_by`) REFERENCES `user` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_client_account_profile_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `client_account_service` (
  `id` CHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` CHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `client_account_profile_id` CHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `service_type` ENUM('ppc','seo','gbp','website','landing_pages','cro','strategy','other') NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `status` ENUM('onboarding','active','paused','ended','archived') NOT NULL DEFAULT 'onboarding',
  `start_date` DATE DEFAULT NULL,
  `renewal_date` DATE DEFAULT NULL,
  `end_date` DATE DEFAULT NULL,
  `owner_id` CHAR(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `recurring_value` DECIMAL(12,2) DEFAULT NULL,
  `currency` CHAR(3) NOT NULL DEFAULT 'USD',
  `contract_status` ENUM('active','trial','pending','paused','cancelled','expired') NOT NULL DEFAULT 'pending',
  `notes` TEXT,
  `archived_at` DATETIME DEFAULT NULL,
  `created_by` CHAR(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `updated_by` CHAR(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_client_account_service_profile` (`client_account_profile_id`),
  KEY `idx_client_account_service_clinic_status` (`clinic_id`,`status`,`archived_at`),
  KEY `idx_client_account_service_renewal` (`clinic_id`,`renewal_date`,`contract_status`),
  CONSTRAINT `fk_client_account_service_clinic` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_client_account_service_profile` FOREIGN KEY (`client_account_profile_id`) REFERENCES `client_account_profile` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_client_account_service_owner` FOREIGN KEY (`owner_id`) REFERENCES `user` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_client_account_service_created_by` FOREIGN KEY (`created_by`) REFERENCES `user` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_client_account_service_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sop` (
  `id` CHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` CHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `category` VARCHAR(100) NOT NULL DEFAULT 'General',
  `content` LONGTEXT,
  `owner` VARCHAR(255) DEFAULT NULL,
  `status` ENUM('draft','published','archived') NOT NULL DEFAULT 'draft',
  `created_by` CHAR(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_sop_search` (`clinic_id`,`status`,`category`,`deleted_at`),
  CONSTRAINT `fk_sop_clinic` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_sop_user` FOREIGN KEY (`created_by`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `strategy_log` (
  `id` CHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` CHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `client_account_profile_id` CHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `log_month` DATE NOT NULL,
  `log_type` ENUM('strategy','meeting') NOT NULL DEFAULT 'strategy',
  `meeting_notes` TEXT,
  `seo_plan` TEXT,
  `ppc_plan` TEXT,
  `landing_page_plan` TEXT,
  `kpi_notes` TEXT,
  `decisions` TEXT,
  `next_actions` TEXT,
  `owner_id` CHAR(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_by` CHAR(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `updated_by` CHAR(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `archived_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_strategy_log_filter` (`clinic_id`,`client_account_profile_id`,`log_month`,`owner_id`,`log_type`,`archived_at`),
  CONSTRAINT `fk_strategy_log_clinic` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_strategy_log_profile` FOREIGN KEY (`client_account_profile_id`) REFERENCES `client_account_profile` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_strategy_log_owner` FOREIGN KEY (`owner_id`) REFERENCES `user` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_strategy_log_created_by` FOREIGN KEY (`created_by`) REFERENCES `user` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_strategy_log_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @schema_name = DATABASE();

SET @sql = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='task' AND COLUMN_NAME='is_internal')=0, 'ALTER TABLE `task` ADD COLUMN `is_internal` TINYINT(1) NOT NULL DEFAULT 0 AFTER `clinic_id`', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='task' AND COLUMN_NAME='category')=0, 'ALTER TABLE `task` ADD COLUMN `category` VARCHAR(100) DEFAULT NULL AFTER `status`', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='task' AND COLUMN_NAME='board_key')=0, 'ALTER TABLE `task` ADD COLUMN `board_key` VARCHAR(100) DEFAULT NULL AFTER `category`', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='task' AND COLUMN_NAME='service_type')=0, 'ALTER TABLE `task` ADD COLUMN `service_type` ENUM(''ppc'',''seo'',''gbp'',''website'',''landing_pages'',''cro'',''strategy'',''other'') DEFAULT NULL AFTER `board_key`', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='task' AND COLUMN_NAME='client_account_profile_id')=0, 'ALTER TABLE `task` ADD COLUMN `client_account_profile_id` CHAR(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `service_type`', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='task' AND COLUMN_NAME='client_account_service_id')=0, 'ALTER TABLE `task` ADD COLUMN `client_account_service_id` CHAR(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `client_account_profile_id`', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='task' AND COLUMN_NAME='assigned_user_id')=0, 'ALTER TABLE `task` ADD COLUMN `assigned_user_id` CHAR(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `assigned_to`', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='task' AND COLUMN_NAME='proof_reference')=0, 'ALTER TABLE `task` ADD COLUMN `proof_reference` VARCHAR(500) DEFAULT NULL AFTER `assigned_user_id`', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='task' AND COLUMN_NAME='workflow_month')=0, 'ALTER TABLE `task` ADD COLUMN `workflow_month` DATE DEFAULT NULL AFTER `proof_reference`', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='task' AND COLUMN_NAME='template_key')=0, 'ALTER TABLE `task` ADD COLUMN `template_key` VARCHAR(150) DEFAULT NULL AFTER `workflow_month`', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='task' AND COLUMN_NAME='recurrence_rule')=0, 'ALTER TABLE `task` ADD COLUMN `recurrence_rule` JSON DEFAULT NULL AFTER `template_key`', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='task' AND COLUMN_NAME='archived_at')=0, 'ALTER TABLE `task` ADD COLUMN `archived_at` TIMESTAMP NULL DEFAULT NULL AFTER `completed_at`', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='task' AND COLUMN_NAME='needs_qa')=0, 'ALTER TABLE `task` ADD COLUMN `needs_qa` TINYINT(1) NOT NULL DEFAULT 0 AFTER `archived_at`', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='task' AND COLUMN_NAME='qa_checklist')=0, 'ALTER TABLE `task` ADD COLUMN `qa_checklist` JSON DEFAULT NULL AFTER `needs_qa`', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='task' AND COLUMN_NAME='approval_status')=0, 'ALTER TABLE `task` ADD COLUMN `approval_status` ENUM(''not_required'',''pending'',''approved'',''rejected'',''needs_changes'') NOT NULL DEFAULT ''not_required'' AFTER `qa_checklist`', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='task' AND COLUMN_NAME='reviewer_user_id')=0, 'ALTER TABLE `task` ADD COLUMN `reviewer_user_id` CHAR(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `approval_status`', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='task' AND COLUMN_NAME='completion_proof_reference')=0, 'ALTER TABLE `task` ADD COLUMN `completion_proof_reference` VARCHAR(500) DEFAULT NULL AFTER `reviewer_user_id`', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='task' AND COLUMN_NAME='missed_task')=0, 'ALTER TABLE `task` ADD COLUMN `missed_task` TINYINT(1) NOT NULL DEFAULT 0 AFTER `completion_proof_reference`', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='task' AND COLUMN_NAME='escalation_flag')=0, 'ALTER TABLE `task` ADD COLUMN `escalation_flag` TINYINT(1) NOT NULL DEFAULT 0 AFTER `missed_task`', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='task' AND COLUMN_NAME='freelancer_team_score')=0, 'ALTER TABLE `task` ADD COLUMN `freelancer_team_score` DECIMAL(5,2) DEFAULT NULL AFTER `escalation_flag`', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='task' AND COLUMN_NAME='qa_updated_at')=0, 'ALTER TABLE `task` ADD COLUMN `qa_updated_at` TIMESTAMP NULL DEFAULT NULL AFTER `freelancer_team_score`', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

INSERT INTO `permission` (`id`,`key_name`,`description`,`created_at`,`updated_at`)
VALUES
  ('perm-client-accounts-read','client_accounts:read','Read internal client account profiles',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('perm-client-accounts-write','client_accounts:write','Update internal client account profiles',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('perm-internal-tasks-read','internal_tasks:read','Read Clinic Grower internal delivery tasks',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('perm-internal-tasks-write','internal_tasks:write','Create and update Clinic Grower internal delivery tasks',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('perm-sops-read','sops:read','Read internal SOPs',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('perm-sops-write','sops:write','Create and update internal SOPs',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('perm-strategy-logs-read','strategy_logs:read','Read internal client strategy logs',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('perm-strategy-logs-write','strategy_logs:write','Create and update internal client strategy logs',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
ON DUPLICATE KEY UPDATE `description`=VALUES(`description`), `updated_at`=CURRENT_TIMESTAMP;

INSERT IGNORE INTO `role_permission` (`role_id`,`permission_id`)
SELECT r.id, p.id
FROM `role` r
JOIN `permission` p ON p.key_name IN (
  'client_accounts:read','client_accounts:write','internal_tasks:read','internal_tasks:write',
  'sops:read','sops:write','strategy_logs:read','strategy_logs:write'
)
WHERE r.name IN ('SUPER_ADMIN','ADMIN');

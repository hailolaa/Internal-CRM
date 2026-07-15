-- Production immutable migration for WhatsApp AI replies and contact permissions.
-- Append-only migration: do not edit earlier migration history.
-- Safe to run after older partial contact migrations or on a fresh internal CRM schema.

SET @schema_name = DATABASE();

-- ---------------------------------------------------------------------------
-- Contact lead/account identity fields used by manual leads, contacts, and
-- WhatsApp lead matching.
-- ---------------------------------------------------------------------------

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contact' AND COLUMN_NAME = 'account_name') = 0,
  'ALTER TABLE `contact` ADD COLUMN `account_name` VARCHAR(255) NULL AFTER `clinic_id`',
  'SELECT ''contact.account_name already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contact' AND COLUMN_NAME = 'website') = 0,
  'ALTER TABLE `contact` ADD COLUMN `website` VARCHAR(255) NULL AFTER `phone`',
  'SELECT ''contact.website already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contact' AND INDEX_NAME = 'idx_contact_account_name') = 0,
  'ALTER TABLE `contact` ADD INDEX `idx_contact_account_name` (`clinic_id`, `account_name`)',
  'SELECT ''idx_contact_account_name already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contact' AND INDEX_NAME = 'idx_contact_website') = 0,
  'ALTER TABLE `contact` ADD INDEX `idx_contact_website` (`clinic_id`, `website`)',
  'SELECT ''idx_contact_website already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------------------
-- Contact role and communication permission fields used by internal contact
-- records and WhatsApp opt-in/opt-out handling.
-- ---------------------------------------------------------------------------

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contact' AND COLUMN_NAME = 'contact_role') = 0,
  'ALTER TABLE `contact` ADD COLUMN `contact_role` VARCHAR(100) NULL AFTER `account_name`',
  'SELECT ''contact.contact_role already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contact' AND COLUMN_NAME = 'communication_permissions') = 0,
  'ALTER TABLE `contact` ADD COLUMN `communication_permissions` JSON NULL AFTER `contact_role`',
  'SELECT ''contact.communication_permissions already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contact' AND COLUMN_NAME = 'role_title') = 0,
  'ALTER TABLE `contact` ADD COLUMN `role_title` VARCHAR(120) NULL AFTER `phone`',
  'SELECT ''contact.role_title already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contact' AND COLUMN_NAME = 'email_permission') = 0,
  'ALTER TABLE `contact` ADD COLUMN `email_permission` TINYINT(1) DEFAULT 1 AFTER `role_title`',
  'SELECT ''contact.email_permission already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contact' AND COLUMN_NAME = 'phone_permission') = 0,
  'ALTER TABLE `contact` ADD COLUMN `phone_permission` TINYINT(1) DEFAULT 1 AFTER `email_permission`',
  'SELECT ''contact.phone_permission already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contact' AND COLUMN_NAME = 'sms_permission') = 0,
  'ALTER TABLE `contact` ADD COLUMN `sms_permission` TINYINT(1) DEFAULT 0 AFTER `phone_permission`',
  'SELECT ''contact.sms_permission already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contact' AND COLUMN_NAME = 'whatsapp_permission') = 0,
  'ALTER TABLE `contact` ADD COLUMN `whatsapp_permission` TINYINT(1) DEFAULT 0 AFTER `sms_permission`',
  'SELECT ''contact.whatsapp_permission already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------------------
-- WhatsApp AI settings.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `whatsapp_ai_setting` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `auto_send_enabled` tinyint(1) NOT NULL DEFAULT '0',
  `business_hours_enabled` tinyint(1) NOT NULL DEFAULT '1',
  `business_hours_start` time NOT NULL DEFAULT '09:00:00',
  `business_hours_end` time NOT NULL DEFAULT '17:30:00',
  `timezone` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Europe/London',
  `approved_tone` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT 'Warm, concise, helpful and professional. No clinical claims or guarantees.',
  `guardrails` json DEFAULT NULL,
  `confidence_threshold` decimal(3,2) NOT NULL DEFAULT '0.72',
  `human_handoff_user_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `max_auto_send_retries` int NOT NULL DEFAULT '2',
  `created_by` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `updated_by` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_whatsapp_ai_setting_clinic` (`clinic_id`),
  KEY `fk_whatsapp_ai_setting_handoff` (`human_handoff_user_id`),
  CONSTRAINT `fk_whatsapp_ai_setting_clinic` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_whatsapp_ai_setting_handoff` FOREIGN KEY (`human_handoff_user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'whatsapp_ai_setting' AND COLUMN_NAME = 'auto_send_enabled') = 0,
  'ALTER TABLE `whatsapp_ai_setting` ADD COLUMN `auto_send_enabled` TINYINT(1) NOT NULL DEFAULT 0 AFTER `clinic_id`',
  'SELECT ''whatsapp_ai_setting.auto_send_enabled already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'whatsapp_ai_setting' AND COLUMN_NAME = 'guardrails') = 0,
  'ALTER TABLE `whatsapp_ai_setting` ADD COLUMN `guardrails` JSON NULL AFTER `approved_tone`',
  'SELECT ''whatsapp_ai_setting.guardrails already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'whatsapp_ai_setting' AND COLUMN_NAME = 'confidence_threshold') = 0,
  'ALTER TABLE `whatsapp_ai_setting` ADD COLUMN `confidence_threshold` DECIMAL(3,2) NOT NULL DEFAULT 0.72 AFTER `guardrails`',
  'SELECT ''whatsapp_ai_setting.confidence_threshold already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'whatsapp_ai_setting' AND COLUMN_NAME = 'human_handoff_user_id') = 0,
  'ALTER TABLE `whatsapp_ai_setting` ADD COLUMN `human_handoff_user_id` CHAR(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `confidence_threshold`',
  'SELECT ''whatsapp_ai_setting.human_handoff_user_id already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'whatsapp_ai_setting' AND COLUMN_NAME = 'max_auto_send_retries') = 0,
  'ALTER TABLE `whatsapp_ai_setting` ADD COLUMN `max_auto_send_retries` INT NOT NULL DEFAULT 2 AFTER `human_handoff_user_id`',
  'SELECT ''whatsapp_ai_setting.max_auto_send_retries already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'whatsapp_ai_setting' AND INDEX_NAME = 'uq_whatsapp_ai_setting_clinic') = 0,
  'ALTER TABLE `whatsapp_ai_setting` ADD UNIQUE KEY `uq_whatsapp_ai_setting_clinic` (`clinic_id`)',
  'SELECT ''uq_whatsapp_ai_setting_clinic already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------------------
-- WhatsApp conversations.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `whatsapp_conversation` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `contact_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `whatsapp_number` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `owner_user_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('open','human_required','closed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'open',
  `last_message_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_whatsapp_conversation_contact` (`clinic_id`,`contact_id`,`whatsapp_number`),
  KEY `idx_whatsapp_conversation_clinic` (`clinic_id`,`status`,`last_message_at`),
  KEY `fk_whatsapp_conversation_owner` (`owner_user_id`),
  CONSTRAINT `fk_whatsapp_conversation_clinic` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_whatsapp_conversation_contact` FOREIGN KEY (`contact_id`) REFERENCES `contact` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_whatsapp_conversation_owner` FOREIGN KEY (`owner_user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'whatsapp_conversation' AND COLUMN_NAME = 'whatsapp_number') = 0,
  'ALTER TABLE `whatsapp_conversation` ADD COLUMN `whatsapp_number` VARCHAR(40) COLLATE utf8mb4_unicode_ci NOT NULL AFTER `contact_id`',
  'SELECT ''whatsapp_conversation.whatsapp_number already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'whatsapp_conversation' AND COLUMN_NAME = 'owner_user_id') = 0,
  'ALTER TABLE `whatsapp_conversation` ADD COLUMN `owner_user_id` CHAR(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `whatsapp_number`',
  'SELECT ''whatsapp_conversation.owner_user_id already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'whatsapp_conversation' AND COLUMN_NAME = 'status') = 0,
  'ALTER TABLE `whatsapp_conversation` ADD COLUMN `status` ENUM(''open'',''human_required'',''closed'') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT ''open'' AFTER `owner_user_id`',
  'SELECT ''whatsapp_conversation.status already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'whatsapp_conversation' AND COLUMN_NAME = 'last_message_at') = 0,
  'ALTER TABLE `whatsapp_conversation` ADD COLUMN `last_message_at` DATETIME DEFAULT NULL AFTER `status`',
  'SELECT ''whatsapp_conversation.last_message_at already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'whatsapp_conversation' AND INDEX_NAME = 'uq_whatsapp_conversation_contact') = 0,
  'ALTER TABLE `whatsapp_conversation` ADD UNIQUE KEY `uq_whatsapp_conversation_contact` (`clinic_id`, `contact_id`, `whatsapp_number`)',
  'SELECT ''uq_whatsapp_conversation_contact already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'whatsapp_conversation' AND INDEX_NAME = 'idx_whatsapp_conversation_clinic') = 0,
  'ALTER TABLE `whatsapp_conversation` ADD INDEX `idx_whatsapp_conversation_clinic` (`clinic_id`, `status`, `last_message_at`)',
  'SELECT ''idx_whatsapp_conversation_clinic already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------------------
-- WhatsApp messages. The idempotency key is critical for preventing duplicate
-- Meta sends when approve/retry/auto-send requests repeat.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `whatsapp_message` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `conversation_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `contact_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `direction` enum('inbound','outbound') COLLATE utf8mb4_unicode_ci NOT NULL,
  `body` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('received','read','queued','sent','failed','human_required') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'received',
  `provider_message_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `idempotency_key` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `failure_reason` text COLLATE utf8mb4_unicode_ci,
  `metadata` json DEFAULT NULL,
  `received_at` datetime DEFAULT NULL,
  `sent_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_whatsapp_provider_message` (`clinic_id`,`provider_message_id`),
  UNIQUE KEY `uq_whatsapp_idempotency` (`clinic_id`,`idempotency_key`),
  KEY `idx_whatsapp_message_conversation` (`conversation_id`,`created_at`),
  KEY `idx_whatsapp_message_contact` (`clinic_id`,`contact_id`,`created_at`),
  CONSTRAINT `fk_whatsapp_message_clinic` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_whatsapp_message_conversation` FOREIGN KEY (`conversation_id`) REFERENCES `whatsapp_conversation` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_whatsapp_message_contact` FOREIGN KEY (`contact_id`) REFERENCES `contact` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_whatsapp_message_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'whatsapp_message' AND COLUMN_NAME = 'status') = 0,
  'ALTER TABLE `whatsapp_message` ADD COLUMN `status` ENUM(''received'',''read'',''queued'',''sent'',''failed'',''human_required'') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT ''received'' AFTER `body`',
  'SELECT ''whatsapp_message.status already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'whatsapp_message' AND COLUMN_NAME = 'provider_message_id') = 0,
  'ALTER TABLE `whatsapp_message` ADD COLUMN `provider_message_id` VARCHAR(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `status`',
  'SELECT ''whatsapp_message.provider_message_id already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'whatsapp_message' AND COLUMN_NAME = 'idempotency_key') = 0,
  'ALTER TABLE `whatsapp_message` ADD COLUMN `idempotency_key` VARCHAR(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `provider_message_id`',
  'SELECT ''whatsapp_message.idempotency_key already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'whatsapp_message' AND COLUMN_NAME = 'failure_reason') = 0,
  'ALTER TABLE `whatsapp_message` ADD COLUMN `failure_reason` TEXT COLLATE utf8mb4_unicode_ci NULL AFTER `idempotency_key`',
  'SELECT ''whatsapp_message.failure_reason already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'whatsapp_message' AND COLUMN_NAME = 'metadata') = 0,
  'ALTER TABLE `whatsapp_message` ADD COLUMN `metadata` JSON NULL AFTER `failure_reason`',
  'SELECT ''whatsapp_message.metadata already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'whatsapp_message' AND COLUMN_NAME = 'received_at') = 0,
  'ALTER TABLE `whatsapp_message` ADD COLUMN `received_at` DATETIME DEFAULT NULL AFTER `metadata`',
  'SELECT ''whatsapp_message.received_at already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'whatsapp_message' AND COLUMN_NAME = 'sent_at') = 0,
  'ALTER TABLE `whatsapp_message` ADD COLUMN `sent_at` DATETIME DEFAULT NULL AFTER `received_at`',
  'SELECT ''whatsapp_message.sent_at already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

ALTER TABLE `whatsapp_message`
  MODIFY COLUMN `status` enum('received','read','queued','sent','failed','human_required') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'received';

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'whatsapp_message' AND INDEX_NAME = 'uq_whatsapp_provider_message') = 0,
  'ALTER TABLE `whatsapp_message` ADD UNIQUE KEY `uq_whatsapp_provider_message` (`clinic_id`, `provider_message_id`)',
  'SELECT ''uq_whatsapp_provider_message already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'whatsapp_message' AND INDEX_NAME = 'uq_whatsapp_idempotency') = 0,
  'ALTER TABLE `whatsapp_message` ADD UNIQUE KEY `uq_whatsapp_idempotency` (`clinic_id`, `idempotency_key`)',
  'SELECT ''uq_whatsapp_idempotency already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'whatsapp_message' AND INDEX_NAME = 'idx_whatsapp_message_conversation') = 0,
  'ALTER TABLE `whatsapp_message` ADD INDEX `idx_whatsapp_message_conversation` (`conversation_id`, `created_at`)',
  'SELECT ''idx_whatsapp_message_conversation already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'whatsapp_message' AND INDEX_NAME = 'idx_whatsapp_message_contact') = 0,
  'ALTER TABLE `whatsapp_message` ADD INDEX `idx_whatsapp_message_contact` (`clinic_id`, `contact_id`, `created_at`)',
  'SELECT ''idx_whatsapp_message_contact already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------------------
-- WhatsApp AI replies and approval/audit state.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `whatsapp_ai_reply` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `conversation_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `contact_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `inbound_message_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `responsible_user_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `drafted_by_user_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `approved_by_user_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `outbound_message_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `draft_body` text COLLATE utf8mb4_unicode_ci,
  `final_body` text COLLATE utf8mb4_unicode_ci,
  `ai_output` json DEFAULT NULL,
  `confidence` decimal(3,2) NOT NULL DEFAULT '0.00',
  `provider` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'deterministic',
  `model` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('drafted','needs_approval','auto_sent','sent','human_required','failed','discarded') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'drafted',
  `guardrail_reason` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `auto_send_allowed` tinyint(1) NOT NULL DEFAULT '0',
  `auto_send_attempted` tinyint(1) NOT NULL DEFAULT '0',
  `send_attempts` int NOT NULL DEFAULT '0',
  `failure_reason` text COLLATE utf8mb4_unicode_ci,
  `approved_at` datetime DEFAULT NULL,
  `sent_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_whatsapp_ai_reply_inbound` (`clinic_id`,`inbound_message_id`),
  KEY `idx_whatsapp_ai_reply_status` (`clinic_id`,`status`,`created_at`),
  KEY `fk_whatsapp_ai_reply_responsible` (`responsible_user_id`),
  CONSTRAINT `fk_whatsapp_ai_reply_clinic` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_whatsapp_ai_reply_conversation` FOREIGN KEY (`conversation_id`) REFERENCES `whatsapp_conversation` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_whatsapp_ai_reply_contact` FOREIGN KEY (`contact_id`) REFERENCES `contact` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_whatsapp_ai_reply_inbound` FOREIGN KEY (`inbound_message_id`) REFERENCES `whatsapp_message` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_whatsapp_ai_reply_outbound` FOREIGN KEY (`outbound_message_id`) REFERENCES `whatsapp_message` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_whatsapp_ai_reply_responsible` FOREIGN KEY (`responsible_user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'whatsapp_ai_reply' AND COLUMN_NAME = 'responsible_user_id') = 0,
  'ALTER TABLE `whatsapp_ai_reply` ADD COLUMN `responsible_user_id` CHAR(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `inbound_message_id`',
  'SELECT ''whatsapp_ai_reply.responsible_user_id already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'whatsapp_ai_reply' AND COLUMN_NAME = 'drafted_by_user_id') = 0,
  'ALTER TABLE `whatsapp_ai_reply` ADD COLUMN `drafted_by_user_id` CHAR(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `responsible_user_id`',
  'SELECT ''whatsapp_ai_reply.drafted_by_user_id already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'whatsapp_ai_reply' AND COLUMN_NAME = 'approved_by_user_id') = 0,
  'ALTER TABLE `whatsapp_ai_reply` ADD COLUMN `approved_by_user_id` CHAR(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `drafted_by_user_id`',
  'SELECT ''whatsapp_ai_reply.approved_by_user_id already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'whatsapp_ai_reply' AND COLUMN_NAME = 'outbound_message_id') = 0,
  'ALTER TABLE `whatsapp_ai_reply` ADD COLUMN `outbound_message_id` CHAR(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `approved_by_user_id`',
  'SELECT ''whatsapp_ai_reply.outbound_message_id already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'whatsapp_ai_reply' AND COLUMN_NAME = 'draft_body') = 0,
  'ALTER TABLE `whatsapp_ai_reply` ADD COLUMN `draft_body` TEXT COLLATE utf8mb4_unicode_ci NULL AFTER `outbound_message_id`',
  'SELECT ''whatsapp_ai_reply.draft_body already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'whatsapp_ai_reply' AND COLUMN_NAME = 'final_body') = 0,
  'ALTER TABLE `whatsapp_ai_reply` ADD COLUMN `final_body` TEXT COLLATE utf8mb4_unicode_ci NULL AFTER `draft_body`',
  'SELECT ''whatsapp_ai_reply.final_body already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'whatsapp_ai_reply' AND COLUMN_NAME = 'ai_output') = 0,
  'ALTER TABLE `whatsapp_ai_reply` ADD COLUMN `ai_output` JSON NULL AFTER `final_body`',
  'SELECT ''whatsapp_ai_reply.ai_output already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'whatsapp_ai_reply' AND COLUMN_NAME = 'confidence') = 0,
  'ALTER TABLE `whatsapp_ai_reply` ADD COLUMN `confidence` DECIMAL(3,2) NOT NULL DEFAULT 0.00 AFTER `ai_output`',
  'SELECT ''whatsapp_ai_reply.confidence already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'whatsapp_ai_reply' AND COLUMN_NAME = 'provider') = 0,
  'ALTER TABLE `whatsapp_ai_reply` ADD COLUMN `provider` VARCHAR(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT ''deterministic'' AFTER `confidence`',
  'SELECT ''whatsapp_ai_reply.provider already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'whatsapp_ai_reply' AND COLUMN_NAME = 'model') = 0,
  'ALTER TABLE `whatsapp_ai_reply` ADD COLUMN `model` VARCHAR(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `provider`',
  'SELECT ''whatsapp_ai_reply.model already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'whatsapp_ai_reply' AND COLUMN_NAME = 'status') = 0,
  'ALTER TABLE `whatsapp_ai_reply` ADD COLUMN `status` ENUM(''drafted'',''needs_approval'',''auto_sent'',''sent'',''human_required'',''failed'',''discarded'') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT ''drafted'' AFTER `model`',
  'SELECT ''whatsapp_ai_reply.status already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'whatsapp_ai_reply' AND COLUMN_NAME = 'guardrail_reason') = 0,
  'ALTER TABLE `whatsapp_ai_reply` ADD COLUMN `guardrail_reason` VARCHAR(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `status`',
  'SELECT ''whatsapp_ai_reply.guardrail_reason already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'whatsapp_ai_reply' AND COLUMN_NAME = 'auto_send_allowed') = 0,
  'ALTER TABLE `whatsapp_ai_reply` ADD COLUMN `auto_send_allowed` TINYINT(1) NOT NULL DEFAULT 0 AFTER `guardrail_reason`',
  'SELECT ''whatsapp_ai_reply.auto_send_allowed already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'whatsapp_ai_reply' AND COLUMN_NAME = 'auto_send_attempted') = 0,
  'ALTER TABLE `whatsapp_ai_reply` ADD COLUMN `auto_send_attempted` TINYINT(1) NOT NULL DEFAULT 0 AFTER `auto_send_allowed`',
  'SELECT ''whatsapp_ai_reply.auto_send_attempted already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'whatsapp_ai_reply' AND COLUMN_NAME = 'send_attempts') = 0,
  'ALTER TABLE `whatsapp_ai_reply` ADD COLUMN `send_attempts` INT NOT NULL DEFAULT 0 AFTER `auto_send_attempted`',
  'SELECT ''whatsapp_ai_reply.send_attempts already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'whatsapp_ai_reply' AND COLUMN_NAME = 'failure_reason') = 0,
  'ALTER TABLE `whatsapp_ai_reply` ADD COLUMN `failure_reason` TEXT COLLATE utf8mb4_unicode_ci NULL AFTER `send_attempts`',
  'SELECT ''whatsapp_ai_reply.failure_reason already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

ALTER TABLE `whatsapp_ai_reply`
  MODIFY COLUMN `status` enum('drafted','needs_approval','auto_sent','sent','human_required','failed','discarded') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'drafted';

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'whatsapp_ai_reply' AND INDEX_NAME = 'uq_whatsapp_ai_reply_inbound') = 0,
  'ALTER TABLE `whatsapp_ai_reply` ADD UNIQUE KEY `uq_whatsapp_ai_reply_inbound` (`clinic_id`, `inbound_message_id`)',
  'SELECT ''uq_whatsapp_ai_reply_inbound already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'whatsapp_ai_reply' AND INDEX_NAME = 'idx_whatsapp_ai_reply_status') = 0,
  'ALTER TABLE `whatsapp_ai_reply` ADD INDEX `idx_whatsapp_ai_reply_status` (`clinic_id`, `status`, `created_at`)',
  'SELECT ''idx_whatsapp_ai_reply_status already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

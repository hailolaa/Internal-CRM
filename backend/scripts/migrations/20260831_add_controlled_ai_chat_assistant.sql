INSERT IGNORE INTO `permission` (`id`, `key_name`, `description`, `created_at`, `updated_at`)
VALUES
  ('perm-ai-assistant-use', 'ai_assistant:use', 'Use the controlled Mission Control chat assistant', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT IGNORE INTO `role_permission` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `role` r
JOIN `permission` p ON p.key_name = 'ai_assistant:use'
WHERE r.name IN ('SUPER_ADMIN', 'ADMIN', 'DELIVERY');

CREATE TABLE IF NOT EXISTS `ai_chat_session` (
  `id` CHAR(36) NOT NULL,
  `clinic_id` CHAR(36) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `status` ENUM('open','archived') NOT NULL DEFAULT 'open',
  `created_by` CHAR(36) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ai_chat_session_clinic` (`clinic_id`, `status`, `updated_at`),
  CONSTRAINT `fk_ai_chat_session_clinic`
    FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`)
    ON DELETE CASCADE,
  CONSTRAINT `fk_ai_chat_session_created_by`
    FOREIGN KEY (`created_by`) REFERENCES `user` (`id`)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ai_chat_message` (
  `id` CHAR(36) NOT NULL,
  `clinic_id` CHAR(36) NOT NULL,
  `session_id` CHAR(36) NOT NULL,
  `role` ENUM('user','assistant') NOT NULL,
  `body` TEXT NOT NULL,
  `guardrail_status` ENUM('answered','escalated','refused') DEFAULT NULL,
  `citations` JSON DEFAULT NULL,
  `created_by` CHAR(36) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ai_chat_message_session` (`session_id`, `created_at`),
  KEY `idx_ai_chat_message_clinic` (`clinic_id`, `created_at`),
  CONSTRAINT `fk_ai_chat_message_clinic`
    FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`)
    ON DELETE CASCADE,
  CONSTRAINT `fk_ai_chat_message_session`
    FOREIGN KEY (`session_id`) REFERENCES `ai_chat_session` (`id`)
    ON DELETE CASCADE,
  CONSTRAINT `fk_ai_chat_message_created_by`
    FOREIGN KEY (`created_by`) REFERENCES `user` (`id`)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

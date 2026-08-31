INSERT IGNORE INTO `permission` (`id`, `key_name`, `description`, `created_at`, `updated_at`)
VALUES
  ('perm-ai-actions-review', 'ai_actions:review', 'Review, approve, reject and commit AI-proposed actions', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT IGNORE INTO `role_permission` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `role` r
JOIN `permission` p ON p.key_name = 'ai_actions:review'
WHERE r.name IN ('SUPER_ADMIN', 'ADMIN');

CREATE TABLE IF NOT EXISTS `ai_action_approval` (
  `id` CHAR(36) NOT NULL,
  `clinic_id` CHAR(36) NOT NULL,
  `source_type` VARCHAR(80) NOT NULL,
  `source_record_id` VARCHAR(160) DEFAULT NULL,
  `action_type` VARCHAR(80) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `summary` TEXT DEFAULT NULL,
  `proposed_payload` JSON NOT NULL,
  `reviewed_payload` JSON DEFAULT NULL,
  `status` ENUM('pending','approved','rejected','committed') NOT NULL DEFAULT 'pending',
  `idempotency_key` VARCHAR(160) NOT NULL,
  `content_hash` CHAR(64) NOT NULL,
  `committed_payload_hash` CHAR(64) DEFAULT NULL,
  `review_note` TEXT DEFAULT NULL,
  `rejection_reason` TEXT DEFAULT NULL,
  `created_by` CHAR(36) DEFAULT NULL,
  `reviewed_by` CHAR(36) DEFAULT NULL,
  `committed_by` CHAR(36) DEFAULT NULL,
  `reviewed_at` TIMESTAMP NULL DEFAULT NULL,
  `committed_at` TIMESTAMP NULL DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ai_action_approval_idempotency` (`clinic_id`, `idempotency_key`),
  KEY `idx_ai_action_approval_clinic_status` (`clinic_id`, `status`, `created_at`),
  KEY `idx_ai_action_approval_source` (`clinic_id`, `source_type`, `source_record_id`),
  CONSTRAINT `fk_ai_action_approval_clinic`
    FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`)
    ON DELETE CASCADE,
  CONSTRAINT `fk_ai_action_approval_created_by`
    FOREIGN KEY (`created_by`) REFERENCES `user` (`id`)
    ON DELETE SET NULL,
  CONSTRAINT `fk_ai_action_approval_reviewed_by`
    FOREIGN KEY (`reviewed_by`) REFERENCES `user` (`id`)
    ON DELETE SET NULL,
  CONSTRAINT `fk_ai_action_approval_committed_by`
    FOREIGN KEY (`committed_by`) REFERENCES `user` (`id`)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ai_action_approval_event` (
  `id` CHAR(36) NOT NULL,
  `clinic_id` CHAR(36) NOT NULL,
  `approval_id` CHAR(36) NOT NULL,
  `event_type` ENUM('queued','edited','approved','rejected','committed') NOT NULL,
  `actor_user_id` CHAR(36) DEFAULT NULL,
  `before_status` VARCHAR(40) DEFAULT NULL,
  `after_status` VARCHAR(40) NOT NULL,
  `changes` JSON DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ai_action_approval_event_approval` (`approval_id`, `created_at`),
  KEY `idx_ai_action_approval_event_clinic` (`clinic_id`, `created_at`),
  CONSTRAINT `fk_ai_action_approval_event_clinic`
    FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`)
    ON DELETE CASCADE,
  CONSTRAINT `fk_ai_action_approval_event_approval`
    FOREIGN KEY (`approval_id`) REFERENCES `ai_action_approval` (`id`)
    ON DELETE CASCADE,
  CONSTRAINT `fk_ai_action_approval_event_actor`
    FOREIGN KEY (`actor_user_id`) REFERENCES `user` (`id`)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

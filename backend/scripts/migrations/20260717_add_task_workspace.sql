CREATE TABLE IF NOT EXISTS `task_comment` (
  `id` char(36) NOT NULL,
  `clinic_id` char(36) NOT NULL,
  `task_id` char(36) NOT NULL,
  `author_user_id` char(36) DEFAULT NULL,
  `body` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_task_comment_thread` (`clinic_id`,`task_id`,`created_at`),
  CONSTRAINT `fk_task_comment_clinic` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_task_comment_task` FOREIGN KEY (`task_id`) REFERENCES `task` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_task_comment_author` FOREIGN KEY (`author_user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `task_comment_mention` (
  `comment_id` char(36) NOT NULL,
  `mentioned_user_id` char(36) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`comment_id`,`mentioned_user_id`),
  KEY `idx_task_mention_user` (`mentioned_user_id`,`created_at`),
  CONSTRAINT `fk_task_mention_comment` FOREIGN KEY (`comment_id`) REFERENCES `task_comment` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_task_mention_user` FOREIGN KEY (`mentioned_user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `task_attachment` (
  `id` char(36) NOT NULL,
  `clinic_id` char(36) NOT NULL,
  `task_id` char(36) NOT NULL,
  `uploaded_by_user_id` char(36) DEFAULT NULL,
  `storage_provider` varchar(30) NOT NULL DEFAULT 'local',
  `storage_key` varchar(255) NOT NULL,
  `original_name` varchar(255) NOT NULL,
  `mime_type` varchar(150) NOT NULL,
  `size_bytes` bigint unsigned NOT NULL,
  `sha256` char(64) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_task_attachment_storage_key` (`storage_key`),
  KEY `idx_task_attachment_list` (`clinic_id`,`task_id`,`created_at`),
  CONSTRAINT `fk_task_attachment_clinic` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_task_attachment_task` FOREIGN KEY (`task_id`) REFERENCES `task` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_task_attachment_user` FOREIGN KEY (`uploaded_by_user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

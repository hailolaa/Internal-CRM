CREATE TABLE IF NOT EXISTS `calendar_meeting` (
  `id` CHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` CHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `provider` VARCHAR(40) NOT NULL DEFAULT 'google_calendar',
  `provider_event_id` VARCHAR(255) NOT NULL,
  `calendar_id` VARCHAR(255) DEFAULT NULL,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `location` VARCHAR(500) DEFAULT NULL,
  `meeting_url` VARCHAR(1000) DEFAULT NULL,
  `html_link` VARCHAR(1000) DEFAULT NULL,
  `status` VARCHAR(40) NOT NULL DEFAULT 'confirmed',
  `starts_at` DATETIME NOT NULL,
  `ends_at` DATETIME DEFAULT NULL,
  `timezone` VARCHAR(100) DEFAULT NULL,
  `organizer_email` VARCHAR(255) DEFAULT NULL,
  `attendee_emails` JSON DEFAULT NULL,
  `contact_id` CHAR(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `client_account_profile_id` CHAR(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `task_id` CHAR(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `last_synced_at` DATETIME DEFAULT NULL,
  `created_by` CHAR(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `updated_by` CHAR(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_calendar_meeting_event` (`clinic_id`, `provider`, `provider_event_id`),
  KEY `idx_calendar_meeting_upcoming` (`clinic_id`, `starts_at`, `status`, `deleted_at`),
  KEY `idx_calendar_meeting_contact` (`clinic_id`, `contact_id`, `starts_at`),
  KEY `idx_calendar_meeting_client` (`clinic_id`, `client_account_profile_id`, `starts_at`),
  KEY `idx_calendar_meeting_task` (`clinic_id`, `task_id`, `starts_at`),
  CONSTRAINT `fk_calendar_meeting_clinic` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_calendar_meeting_contact` FOREIGN KEY (`contact_id`) REFERENCES `contact` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_calendar_meeting_client_profile` FOREIGN KEY (`client_account_profile_id`) REFERENCES `client_account_profile` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_calendar_meeting_task` FOREIGN KEY (`task_id`) REFERENCES `task` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_calendar_meeting_created_by` FOREIGN KEY (`created_by`) REFERENCES `user` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_calendar_meeting_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @schema_name = DATABASE();

SET @add_calendar_index = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'calendar_meeting' AND INDEX_NAME = 'idx_calendar_meeting_upcoming') = 0,
  'ALTER TABLE `calendar_meeting` ADD INDEX `idx_calendar_meeting_upcoming` (`clinic_id`, `starts_at`, `status`, `deleted_at`)',
  'SELECT ''idx_calendar_meeting_upcoming already exists'' AS message'
);
PREPARE stmt FROM @add_calendar_index;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

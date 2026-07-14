ALTER TABLE `client_account_profile`
  ADD COLUMN `google_drive_folder_id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `key_notes`,
  ADD COLUMN `google_drive_folder_url` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `google_drive_folder_id`,
  ADD COLUMN `google_drive_folder_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `google_drive_folder_url`,
  ADD COLUMN `google_drive_folder_access_status` enum('not_checked','accessible','inaccessible') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'not_checked' AFTER `google_drive_folder_name`,
  ADD COLUMN `google_drive_folder_error` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `google_drive_folder_access_status`,
  ADD COLUMN `google_drive_folder_checked_at` datetime DEFAULT NULL AFTER `google_drive_folder_error`,
  ADD KEY `idx_client_account_profile_drive_folder` (`clinic_id`,`google_drive_folder_id`);

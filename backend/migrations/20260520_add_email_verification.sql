ALTER TABLE `user`
  ADD COLUMN `email_verified_at` timestamp NULL DEFAULT NULL
  AFTER `two_factor_backup_codes`;

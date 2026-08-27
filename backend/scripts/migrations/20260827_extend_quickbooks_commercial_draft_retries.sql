-- CG-058: Durable retry controls for automatic QuickBooks draft processing.
ALTER TABLE `quickbooks_commercial_draft`
  ADD COLUMN `attempt_count` INT UNSIGNED NOT NULL DEFAULT 0 AFTER `status`,
  ADD COLUMN `next_attempt_at` DATETIME DEFAULT NULL AFTER `attempt_count`,
  ADD COLUMN `last_attempt_at` DATETIME DEFAULT NULL AFTER `next_attempt_at`,
  ADD KEY `idx_quickbooks_commercial_draft_retry` (`status`, `next_attempt_at`, `attempt_count`);

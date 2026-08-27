-- CG-069: bounded retries and stale-claim recovery for ClickUp delivery provisioning.
ALTER TABLE `clickup_delivery_provision`
  ADD COLUMN `attempt_count` INT UNSIGNED NOT NULL DEFAULT 0 AFTER `status`,
  ADD COLUMN `max_attempts` INT UNSIGNED NOT NULL DEFAULT 5 AFTER `attempt_count`,
  ADD COLUMN `next_attempt_at` DATETIME DEFAULT NULL AFTER `max_attempts`,
  ADD COLUMN `last_attempt_at` DATETIME DEFAULT NULL AFTER `next_attempt_at`,
  ADD KEY `idx_clickup_delivery_provision_retry` (`status`, `next_attempt_at`, `attempt_count`);

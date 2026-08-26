-- CG-079: Per-client sync health exception administration.
-- Additive/forward-only hardening for exception lifecycle evidence and
-- explicit unknown/blocked sync states.

ALTER TABLE `fleet_ingestion_checkpoint`
  MODIFY `sync_status` ENUM('healthy','delayed','retrying','dead_letter','paused','reconciliation_needed','unknown','blocked') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'unknown';

ALTER TABLE `analytics_freshness_alert`
  MODIFY `status` ENUM('open','acknowledged','resolved','dismissed') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'open';

ALTER TABLE `analytics_reconciliation_issue`
  MODIFY `status` ENUM('open','acknowledged','resolved','dismissed') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'open';

CREATE TABLE IF NOT EXISTS `fleet_sync_exception_action_log` (
  `id` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `source_id` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `exception_type` ENUM('dead_letter','freshness','reconciliation','source_status') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `exception_id` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `action` ENUM('acknowledged','resolved','dismissed','replayed','reopened') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `previous_status` VARCHAR(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `next_status` VARCHAR(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reason` VARCHAR(1000) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `correlation_id` VARCHAR(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `metadata` JSON DEFAULT NULL,
  `actor_user_id` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_fleet_sync_exception_log_exception` (`clinic_id`, `exception_type`, `exception_id`, `created_at`),
  KEY `idx_fleet_sync_exception_log_source` (`clinic_id`, `source_id`, `created_at`),
  KEY `idx_fleet_sync_exception_log_actor` (`actor_user_id`, `created_at`),
  CONSTRAINT `fk_fleet_sync_exception_log_clinic` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_fleet_sync_exception_log_source` FOREIGN KEY (`source_id`) REFERENCES `fleet_ingestion_source` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_fleet_sync_exception_log_actor` FOREIGN KEY (`actor_user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

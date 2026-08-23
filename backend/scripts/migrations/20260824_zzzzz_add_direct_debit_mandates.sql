CREATE TABLE IF NOT EXISTS `direct_debit_mandate` (
  `id` CHAR(36) NOT NULL,
  `clinic_id` CHAR(36) NOT NULL,
  `client_account_profile_id` CHAR(36) NULL,
  `provider` ENUM('gocardless','stripe','manual') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'gocardless',
  `provider_customer_id` VARCHAR(160) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
  `provider_mandate_id` VARCHAR(160) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
  `status` ENUM('setup_required','pending_customer_authorisation','submitted','active','failed','cancelled','expired') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'setup_required',
  `setup_reference` VARCHAR(160) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `setup_url` VARCHAR(1000) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
  `failure_reason` VARCHAR(1000) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
  `metadata` JSON NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_direct_debit_setup_reference` (`clinic_id`, `setup_reference`),
  UNIQUE KEY `uk_direct_debit_provider_mandate` (`provider`, `provider_mandate_id`),
  KEY `idx_direct_debit_mandate_status` (`clinic_id`, `status`, `updated_at`),
  KEY `idx_direct_debit_mandate_client` (`clinic_id`, `client_account_profile_id`),
  CONSTRAINT `fk_direct_debit_mandate_clinic` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_direct_debit_mandate_client` FOREIGN KEY (`client_account_profile_id`) REFERENCES `client_account_profile` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `direct_debit_mandate_event` (
  `id` CHAR(36) NOT NULL,
  `clinic_id` CHAR(36) NOT NULL,
  `mandate_id` CHAR(36) NOT NULL,
  `provider` ENUM('gocardless','stripe','manual') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `provider_event_id` VARCHAR(160) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `event_type` VARCHAR(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `event_status` VARCHAR(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload_hash` CHAR(64) NOT NULL,
  `received_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_direct_debit_event_provider` (`provider`, `provider_event_id`),
  KEY `idx_direct_debit_event_mandate` (`clinic_id`, `mandate_id`, `received_at`),
  CONSTRAINT `fk_direct_debit_event_clinic` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_direct_debit_event_mandate` FOREIGN KEY (`mandate_id`) REFERENCES `direct_debit_mandate` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `direct_debit_alert` (
  `id` CHAR(36) NOT NULL,
  `clinic_id` CHAR(36) NOT NULL,
  `mandate_id` CHAR(36) NOT NULL,
  `alert_type` ENUM('mandate_failed','payment_failed','reconciliation_mismatch') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` ENUM('open','resolved') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'open',
  `message` VARCHAR(1000) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `resolved_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  KEY `idx_direct_debit_alert_open` (`clinic_id`, `status`, `alert_type`, `created_at`),
  CONSTRAINT `fk_direct_debit_alert_clinic` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_direct_debit_alert_mandate` FOREIGN KEY (`mandate_id`) REFERENCES `direct_debit_mandate` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `direct_debit_reconciliation_run` (
  `id` CHAR(36) NOT NULL,
  `clinic_id` CHAR(36) NOT NULL,
  `provider` ENUM('gocardless','stripe','manual') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `checked_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `mismatch_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `result` ENUM('passed','mismatch','failed') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `details` JSON NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_direct_debit_reconciliation_clinic` (`clinic_id`, `provider`, `created_at`),
  CONSTRAINT `fk_direct_debit_reconciliation_clinic` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

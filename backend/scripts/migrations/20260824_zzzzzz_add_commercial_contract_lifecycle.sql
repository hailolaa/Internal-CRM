CREATE TABLE IF NOT EXISTS `commercial_contract` (
  `id` CHAR(36) NOT NULL,
  `clinic_id` CHAR(36) NOT NULL,
  `client_account_profile_id` CHAR(36) NULL,
  `contract_key` VARCHAR(160) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` ENUM('draft','sent','active','notice_given','renewal_pending','renewed','ended','cancelled') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft',
  `current_version` INT UNSIGNED NOT NULL DEFAULT 1,
  `start_date` DATE NULL,
  `end_date` DATE NULL,
  `renewal_date` DATE NULL,
  `notice_period_days` INT UNSIGNED NOT NULL DEFAULT 30,
  `terms` JSON NOT NULL,
  `created_by` VARCHAR(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_commercial_contract_key` (`clinic_id`, `contract_key`),
  KEY `idx_commercial_contract_status` (`clinic_id`, `status`, `renewal_date`),
  KEY `idx_commercial_contract_client` (`clinic_id`, `client_account_profile_id`),
  CONSTRAINT `fk_commercial_contract_clinic` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_commercial_contract_client` FOREIGN KEY (`client_account_profile_id`) REFERENCES `client_account_profile` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `commercial_contract_version` (
  `id` CHAR(36) NOT NULL,
  `clinic_id` CHAR(36) NOT NULL,
  `contract_id` CHAR(36) NOT NULL,
  `version` INT UNSIGNED NOT NULL,
  `change_type` ENUM('initial','change_order','renewal') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` ENUM('draft','approved','superseded') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'approved',
  `effective_date` DATE NULL,
  `summary` VARCHAR(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `terms` JSON NOT NULL,
  `created_by` VARCHAR(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_commercial_contract_version` (`contract_id`, `version`),
  KEY `idx_commercial_contract_version_clinic` (`clinic_id`, `change_type`, `created_at`),
  CONSTRAINT `fk_commercial_contract_version_clinic` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_commercial_contract_version_contract` FOREIGN KEY (`contract_id`) REFERENCES `commercial_contract` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `commercial_contract_alert` (
  `id` CHAR(36) NOT NULL,
  `clinic_id` CHAR(36) NOT NULL,
  `contract_id` CHAR(36) NOT NULL,
  `alert_type` ENUM('notice_due','renewal_due','state_blocked') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` ENUM('open','resolved') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'open',
  `due_date` DATE NULL,
  `message` VARCHAR(1000) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `resolved_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_commercial_contract_alert_open` (`contract_id`, `alert_type`, `status`),
  KEY `idx_commercial_contract_alert_due` (`clinic_id`, `status`, `due_date`),
  CONSTRAINT `fk_commercial_contract_alert_clinic` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_commercial_contract_alert_contract` FOREIGN KEY (`contract_id`) REFERENCES `commercial_contract` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

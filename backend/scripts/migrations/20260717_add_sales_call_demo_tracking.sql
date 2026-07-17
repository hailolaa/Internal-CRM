SET @schema_name = DATABASE();

CREATE TABLE IF NOT EXISTS `sales_call_demo` (
  `id` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `contact_id` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `booked` TINYINT(1) NOT NULL DEFAULT 1,
  `scheduled_at` DATETIME DEFAULT NULL,
  `type` VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'discovery_call',
  `package_interest` VARCHAR(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `attended` TINYINT(1) NOT NULL DEFAULT 0,
  `no_show` TINYINT(1) NOT NULL DEFAULT 0,
  `rescheduled` TINYINT(1) NOT NULL DEFAULT 0,
  `outcome` VARCHAR(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `next_step` VARCHAR(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` TEXT DEFAULT NULL,
  `created_by` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `updated_by` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_sales_call_demo_contact` (`clinic_id`, `contact_id`, `scheduled_at`),
  KEY `idx_sales_call_demo_no_show` (`clinic_id`, `no_show`, `scheduled_at`),
  KEY `idx_sales_call_demo_status` (`clinic_id`, `attended`, `rescheduled`, `scheduled_at`),
  KEY `idx_sales_call_demo_created_by` (`created_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

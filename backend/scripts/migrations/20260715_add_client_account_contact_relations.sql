-- Production immutable migration for stable client-account/contact relations.
-- Append-only migration: do not edit earlier migration history.
-- Safe to run after MC-061 code changes or on a fresh internal CRM schema.

SET @schema_name = DATABASE();

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'client_account_contact') = 0,
  'CREATE TABLE `client_account_contact` (
    `id` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    `clinic_id` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    `client_account_profile_id` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    `contact_id` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    `created_by` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_client_account_contact` (`clinic_id`, `client_account_profile_id`, `contact_id`),
    KEY `idx_client_account_contact_profile` (`client_account_profile_id`, `clinic_id`),
    KEY `idx_client_account_contact_contact` (`contact_id`, `clinic_id`),
    KEY `idx_client_account_contact_created_by` (`created_by`),
    CONSTRAINT `fk_client_account_contact_workspace` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_client_account_contact_profile` FOREIGN KEY (`client_account_profile_id`) REFERENCES `client_account_profile` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_client_account_contact_contact` FOREIGN KEY (`contact_id`) REFERENCES `contact` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_client_account_contact_created_by` FOREIGN KEY (`created_by`) REFERENCES `user` (`id`) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
  'SELECT ''client_account_contact already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Backfill only unambiguous legacy contact.account_name links. If multiple client
-- accounts have the same display name, skip them so duplicate names cannot misroute.
INSERT IGNORE INTO `client_account_contact` (
  `id`,
  `clinic_id`,
  `client_account_profile_id`,
  `contact_id`,
  `created_by`,
  `created_at`
)
SELECT
  UUID(),
  contact_rows.clinic_id,
  profile_rows.profile_id,
  contact_rows.id,
  NULL,
  CURRENT_TIMESTAMP
FROM `contact` contact_rows
JOIN (
  SELECT
    LOWER(client_clinic.name) as normalized_name,
    MIN(cap.id) as profile_id,
    COUNT(*) as match_count
  FROM `client_account_profile` cap
  JOIN `clinic` client_clinic
    ON client_clinic.id = cap.clinic_id
   AND client_clinic.deleted_at IS NULL
  GROUP BY LOWER(client_clinic.name)
) profile_rows
  ON profile_rows.normalized_name = LOWER(contact_rows.account_name)
 AND profile_rows.match_count = 1
WHERE contact_rows.deleted_at IS NULL
  AND contact_rows.account_name IS NOT NULL
  AND TRIM(contact_rows.account_name) <> '';

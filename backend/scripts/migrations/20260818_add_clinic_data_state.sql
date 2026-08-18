-- CG-015: authoritative workspace data state for live/demo/preview labelling.
SET @schema_name = DATABASE();

SET @sql = (
  SELECT CASE
    WHEN COUNT(*) = 0 THEN 'ALTER TABLE `clinic` ADD COLUMN `data_state` ENUM(''live'',''live-read-only'',''partial'',''provider-dependent'',''preview'',''roadmap'',''demo'') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT ''live'' AFTER `subscription_status`'
    ELSE 'SELECT 1'
  END
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'clinic'
    AND COLUMN_NAME = 'data_state'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT CASE
    WHEN COUNT(*) = 0 THEN 'ALTER TABLE `clinic` ADD COLUMN `data_state_label` VARCHAR(160) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `data_state`'
    ELSE 'SELECT 1'
  END
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'clinic'
    AND COLUMN_NAME = 'data_state_label'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT CASE
    WHEN COUNT(*) = 0 THEN 'ALTER TABLE `clinic` ADD COLUMN `is_demo` TINYINT(1) NOT NULL DEFAULT 0 AFTER `data_state_label`'
    ELSE 'SELECT 1'
  END
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'clinic'
    AND COLUMN_NAME = 'is_demo'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT CASE
    WHEN COUNT(*) = 0 THEN 'ALTER TABLE `clinic` ADD COLUMN `demo_seed_key` VARCHAR(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `is_demo`'
    ELSE 'SELECT 1'
  END
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'clinic'
    AND COLUMN_NAME = 'demo_seed_key'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT CASE
    WHEN COUNT(*) = 0 THEN 'ALTER TABLE `clinic` ADD INDEX `idx_clinic_data_state` (`data_state`, `deleted_at`)'
    ELSE 'SELECT 1'
  END
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'clinic'
    AND INDEX_NAME = 'idx_clinic_data_state'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT CASE
    WHEN COUNT(*) = 0 THEN 'ALTER TABLE `clinic` ADD INDEX `idx_clinic_demo_seed` (`is_demo`, `demo_seed_key`, `deleted_at`)'
    ELSE 'SELECT 1'
  END
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'clinic'
    AND INDEX_NAME = 'idx_clinic_demo_seed'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE `clinic`
SET
  `data_state` = 'live',
  `data_state_label` = COALESCE(`data_state_label`, 'Live workspace data'),
  `is_demo` = 0,
  `demo_seed_key` = NULL
WHERE `is_demo` = 0
  AND (`data_state` IS NULL
    OR `data_state` = ''
    OR `data_state` = 'live'
    OR `data_state_label` IS NULL);

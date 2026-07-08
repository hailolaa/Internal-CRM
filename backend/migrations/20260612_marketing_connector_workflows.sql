SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'integration'
    AND COLUMN_NAME = 'setup_status'
);
SET @sql := IF(@col_exists = 0,
  "ALTER TABLE integration ADD COLUMN setup_status ENUM('not_configured','needs_oauth','missing_permissions','ready') NOT NULL DEFAULT 'not_configured' AFTER is_active",
  "SELECT 1"
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'integration'
    AND COLUMN_NAME = 'health_status'
);
SET @sql := IF(@col_exists = 0,
  "ALTER TABLE integration ADD COLUMN health_status ENUM('unknown','healthy','warning','error') NOT NULL DEFAULT 'unknown' AFTER setup_status",
  "SELECT 1"
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'integration'
    AND COLUMN_NAME = 'last_sync_status'
);
SET @sql := IF(@col_exists = 0,
  "ALTER TABLE integration ADD COLUMN last_sync_status ENUM('never','running','success','failed') NOT NULL DEFAULT 'never' AFTER last_sync",
  "SELECT 1"
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'integration'
    AND COLUMN_NAME = 'last_sync_error'
);
SET @sql := IF(@col_exists = 0,
  "ALTER TABLE integration ADD COLUMN last_sync_error VARCHAR(500) NULL AFTER last_sync_status",
  "SELECT 1"
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'integration'
    AND COLUMN_NAME = 'last_sync_started_at'
);
SET @sql := IF(@col_exists = 0,
  "ALTER TABLE integration ADD COLUMN last_sync_started_at TIMESTAMP NULL AFTER last_sync_error",
  "SELECT 1"
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'integration'
    AND COLUMN_NAME = 'last_sync_completed_at'
);
SET @sql := IF(@col_exists = 0,
  "ALTER TABLE integration ADD COLUMN last_sync_completed_at TIMESTAMP NULL AFTER last_sync_started_at",
  "SELECT 1"
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'integration'
    AND COLUMN_NAME = 'missing_permissions'
);
SET @sql := IF(@col_exists = 0,
  "ALTER TABLE integration ADD COLUMN missing_permissions JSON NULL AFTER last_sync_completed_at",
  "SELECT 1"
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'integration'
    AND COLUMN_NAME = 'oauth_authorize_url'
);
SET @sql := IF(@col_exists = 0,
  "ALTER TABLE integration ADD COLUMN oauth_authorize_url VARCHAR(1000) NULL AFTER missing_permissions",
  "SELECT 1"
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'integration'
    AND INDEX_NAME = 'idx_integration_connector_health'
);
SET @sql := IF(@idx_exists = 0,
  "ALTER TABLE integration ADD KEY idx_integration_connector_health (clinic_id, type, setup_status, health_status, deleted_at)",
  "SELECT 1"
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @schema_name = DATABASE();

SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'treatment_catalog'
    AND COLUMN_NAME = 'category'
);
SET @statement = IF(
  @column_exists = 0,
  'ALTER TABLE treatment_catalog ADD COLUMN category VARCHAR(50) NOT NULL DEFAULT ''Other'' AFTER description',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'treatment_catalog'
    AND COLUMN_NAME = 'average_value_cents'
);
SET @statement = IF(
  @column_exists = 0,
  'ALTER TABLE treatment_catalog ADD COLUMN average_value_cents INT NULL AFTER price_cents',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'treatment_catalog'
    AND COLUMN_NAME = 'margin_percent'
);
SET @statement = IF(
  @column_exists = 0,
  'ALTER TABLE treatment_catalog ADD COLUMN margin_percent DECIMAL(5, 2) NULL AFTER average_value_cents',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'treatment_catalog'
    AND COLUMN_NAME = 'priority'
);
SET @statement = IF(
  @column_exists = 0,
  'ALTER TABLE treatment_catalog ADD COLUMN priority INT NOT NULL DEFAULT 0 AFTER margin_percent',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'treatment_catalog'
    AND COLUMN_NAME = 'is_high_ticket'
);
SET @statement = IF(
  @column_exists = 0,
  'ALTER TABLE treatment_catalog ADD COLUMN is_high_ticket TINYINT(1) NOT NULL DEFAULT 0 AFTER priority',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists = (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'treatment_catalog'
    AND INDEX_NAME = 'idx_treatment_catalog_category'
);
SET @statement = IF(
  @index_exists = 0,
  'ALTER TABLE treatment_catalog ADD INDEX idx_treatment_catalog_category (clinic_id, category)',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists = (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'treatment_catalog'
    AND INDEX_NAME = 'idx_treatment_catalog_priority'
);
SET @statement = IF(
  @index_exists = 0,
  'ALTER TABLE treatment_catalog ADD INDEX idx_treatment_catalog_priority (clinic_id, priority)',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

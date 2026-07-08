SET @schema_name = DATABASE();

SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'contact'
    AND COLUMN_NAME = 'value'
);
SET @statement = IF(
  @column_exists = 0,
  'ALTER TABLE contact ADD COLUMN value DECIMAL(12, 2) NOT NULL DEFAULT 0 AFTER source',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'contact'
    AND COLUMN_NAME = 'treatment_interests'
);
SET @statement = IF(
  @column_exists = 0,
  'ALTER TABLE contact ADD COLUMN treatment_interests JSON NULL AFTER value',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'contact'
    AND COLUMN_NAME = 'last_contact_at'
);
SET @statement = IF(
  @column_exists = 0,
  'ALTER TABLE contact ADD COLUMN last_contact_at DATETIME NULL AFTER notes',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists = (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'contact'
    AND INDEX_NAME = 'idx_contact_status'
);
SET @statement = IF(
  @index_exists = 0,
  'ALTER TABLE contact ADD INDEX idx_contact_status (clinic_id, status)',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists = (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'contact'
    AND INDEX_NAME = 'idx_contact_source'
);
SET @statement = IF(
  @index_exists = 0,
  'ALTER TABLE contact ADD INDEX idx_contact_source (clinic_id, source)',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists = (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'contact'
    AND INDEX_NAME = 'idx_contact_last_contact'
);
SET @statement = IF(
  @index_exists = 0,
  'ALTER TABLE contact ADD INDEX idx_contact_last_contact (clinic_id, last_contact_at)',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

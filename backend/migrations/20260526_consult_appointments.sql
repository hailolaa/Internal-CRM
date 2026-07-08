SET @schema_name = DATABASE();

SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'appointment'
    AND COLUMN_NAME = 'appointment_type'
);
SET @statement = IF(
  @column_exists = 0,
  'ALTER TABLE appointment ADD COLUMN appointment_type VARCHAR(50) NOT NULL DEFAULT ''consult'' AFTER status',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'appointment'
    AND COLUMN_NAME = 'treatment'
);
SET @statement = IF(
  @column_exists = 0,
  'ALTER TABLE appointment ADD COLUMN treatment VARCHAR(255) NULL AFTER appointment_type',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'appointment'
    AND COLUMN_NAME = 'value'
);
SET @statement = IF(
  @column_exists = 0,
  'ALTER TABLE appointment ADD COLUMN value DECIMAL(12, 2) NOT NULL DEFAULT 0 AFTER treatment',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'appointment'
    AND COLUMN_NAME = 'duration_minutes'
);
SET @statement = IF(
  @column_exists = 0,
  'ALTER TABLE appointment ADD COLUMN duration_minutes INT NOT NULL DEFAULT 30 AFTER value',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'appointment'
    AND COLUMN_NAME = 'created_by'
);
SET @statement = IF(
  @column_exists = 0,
  'ALTER TABLE appointment ADD COLUMN created_by CHAR(36) NULL AFTER follow_up_appointment_id',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists = (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'appointment'
    AND INDEX_NAME = 'idx_appointment_clinic_range'
);
SET @statement = IF(
  @index_exists = 0,
  'ALTER TABLE appointment ADD INDEX idx_appointment_clinic_range (clinic_id, date_time, status)',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @constraint_exists = (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = @schema_name
    AND TABLE_NAME = 'appointment'
    AND CONSTRAINT_NAME = 'fk_appointment_created_by'
);
SET @statement = IF(
  @constraint_exists = 0,
  'ALTER TABLE appointment ADD CONSTRAINT fk_appointment_created_by FOREIGN KEY (created_by) REFERENCES user (id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

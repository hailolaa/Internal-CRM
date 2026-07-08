-- Add missed call follow-up fields to sms
SET @schema_name = DATABASE();

SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'sms'
    AND COLUMN_NAME = 'call_id'
);
SET @statement = IF(
  @column_exists = 0,
  'ALTER TABLE sms ADD COLUMN call_id char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'sms'
    AND COLUMN_NAME = 'call_followup'
);
SET @statement = IF(
  @column_exists = 0,
  'ALTER TABLE sms ADD COLUMN call_followup tinyint(1) NOT NULL DEFAULT 0',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'sms'
    AND COLUMN_NAME = 'provider_message_id'
);
SET @statement = IF(
  @column_exists = 0,
  'ALTER TABLE sms ADD COLUMN provider_message_id varchar(255) DEFAULT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'sms'
    AND COLUMN_NAME = 'provider_response'
);
SET @statement = IF(
  @column_exists = 0,
  'ALTER TABLE sms ADD COLUMN provider_response longtext DEFAULT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'sms'
    AND COLUMN_NAME = 'provider_error'
);
SET @statement = IF(
  @column_exists = 0,
  'ALTER TABLE sms ADD COLUMN provider_error longtext DEFAULT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists = (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'sms'
    AND INDEX_NAME = 'idx_sms_call_id'
);
SET @statement = IF(
  @index_exists = 0,
  'ALTER TABLE sms ADD KEY idx_sms_call_id (call_id)',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Backfill: no-op

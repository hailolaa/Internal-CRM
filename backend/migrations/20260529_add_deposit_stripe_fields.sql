-- Migration: add Stripe fields and payment tracking for deposit_record
SET @schema_name = DATABASE();

SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'deposit_record'
    AND COLUMN_NAME = 'stripe_session_id'
);
SET @statement = IF(
  @column_exists = 0,
  'ALTER TABLE deposit_record ADD COLUMN stripe_session_id varchar(255) DEFAULT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'deposit_record'
    AND COLUMN_NAME = 'stripe_payment_intent_id'
);
SET @statement = IF(
  @column_exists = 0,
  'ALTER TABLE deposit_record ADD COLUMN stripe_payment_intent_id varchar(255) DEFAULT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'deposit_record'
    AND COLUMN_NAME = 'stripe_payment_link_id'
);
SET @statement = IF(
  @column_exists = 0,
  'ALTER TABLE deposit_record ADD COLUMN stripe_payment_link_id varchar(255) DEFAULT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'deposit_record'
    AND COLUMN_NAME = 'payment_status'
);
SET @statement = IF(
  @column_exists = 0,
  'ALTER TABLE deposit_record ADD COLUMN payment_status enum(''requested'',''paid'',''failed'',''refunded'',''waived'',''unpaid'') NOT NULL DEFAULT ''unpaid''',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'deposit_record'
    AND COLUMN_NAME = 'provider_response'
);
SET @statement = IF(
  @column_exists = 0,
  'ALTER TABLE deposit_record ADD COLUMN provider_response json DEFAULT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'deposit_record'
    AND COLUMN_NAME = 'provider_error'
);
SET @statement = IF(
  @column_exists = 0,
  'ALTER TABLE deposit_record ADD COLUMN provider_error text DEFAULT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'deposit_record'
    AND COLUMN_NAME = 'payment_attempted_at'
);
SET @statement = IF(
  @column_exists = 0,
  'ALTER TABLE deposit_record ADD COLUMN payment_attempted_at datetime DEFAULT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'deposit_record'
    AND COLUMN_NAME = 'paid_at'
);
SET @statement = IF(
  @column_exists = 0,
  'ALTER TABLE deposit_record ADD COLUMN paid_at datetime DEFAULT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'deposit_record'
    AND COLUMN_NAME = 'refunded_at'
);
SET @statement = IF(
  @column_exists = 0,
  'ALTER TABLE deposit_record ADD COLUMN refunded_at datetime DEFAULT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists = (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'deposit_record'
    AND INDEX_NAME = 'idx_deposit_stripe_session'
);
SET @statement = IF(
  @index_exists = 0,
  'CREATE INDEX idx_deposit_stripe_session ON deposit_record (stripe_session_id)',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists = (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'deposit_record'
    AND INDEX_NAME = 'idx_deposit_payment_intent'
);
SET @statement = IF(
  @index_exists = 0,
  'CREATE INDEX idx_deposit_payment_intent ON deposit_record (stripe_payment_intent_id)',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists = (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'deposit_record'
    AND INDEX_NAME = 'idx_deposit_clinic_payment_status'
);
SET @statement = IF(
  @index_exists = 0,
  'CREATE INDEX idx_deposit_clinic_payment_status ON deposit_record (clinic_id, payment_status)',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

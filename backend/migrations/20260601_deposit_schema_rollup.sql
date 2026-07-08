-- Forward-only safety migration for the current deposit_record contract.
-- Keeps existing databases aligned even if earlier edited migrations were already applied.
SET @schema_name = DATABASE();

SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'deposit_record'
    AND COLUMN_NAME = 'contact_id'
);
SET @statement = IF(
  @column_exists = 0,
  'ALTER TABLE deposit_record ADD COLUMN contact_id CHAR(36) COLLATE utf8mb4_unicode_ci NULL AFTER clinic_id',
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
    AND COLUMN_NAME = 'appointment_id'
);
SET @statement = IF(
  @column_exists = 0,
  'ALTER TABLE deposit_record ADD COLUMN appointment_id CHAR(36) COLLATE utf8mb4_unicode_ci NULL AFTER contact_id',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

ALTER TABLE deposit_record
  MODIFY COLUMN status ENUM('requested', 'paid', 'failed', 'unpaid', 'waived', 'refunded') NOT NULL DEFAULT 'unpaid';

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
    AND INDEX_NAME = 'idx_deposit_record_contact'
);
SET @statement = IF(
  @index_exists = 0,
  'ALTER TABLE deposit_record ADD INDEX idx_deposit_record_contact (clinic_id, contact_id)',
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
    AND INDEX_NAME = 'idx_deposit_record_appointment'
);
SET @statement = IF(
  @index_exists = 0,
  'ALTER TABLE deposit_record ADD INDEX idx_deposit_record_appointment (clinic_id, appointment_id)',
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

SET @constraint_exists = (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = @schema_name
    AND TABLE_NAME = 'deposit_record'
    AND CONSTRAINT_NAME = 'fk_deposit_record_contact'
);
SET @statement = IF(
  @constraint_exists = 0,
  'ALTER TABLE deposit_record ADD CONSTRAINT fk_deposit_record_contact FOREIGN KEY (contact_id) REFERENCES contact(id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @constraint_exists = (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = @schema_name
    AND TABLE_NAME = 'deposit_record'
    AND CONSTRAINT_NAME = 'fk_deposit_record_appointment'
);
SET @statement = IF(
  @constraint_exists = 0,
  'ALTER TABLE deposit_record ADD CONSTRAINT fk_deposit_record_appointment FOREIGN KEY (appointment_id) REFERENCES appointment(id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

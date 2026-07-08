SET @schema_name = DATABASE();

CREATE TABLE IF NOT EXISTS manual_consult_entry (
  id CHAR(36) COLLATE utf8mb4_unicode_ci PRIMARY KEY,
  clinic_id CHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  contact_id CHAR(36) COLLATE utf8mb4_unicode_ci NULL,
  appointment_id CHAR(36) COLLATE utf8mb4_unicode_ci NULL,
  patient_name VARCHAR(255) NOT NULL,
  treatment VARCHAR(255) NOT NULL,
  practitioner VARCHAR(255) NOT NULL,
  practitioner_id CHAR(36) COLLATE utf8mb4_unicode_ci NULL,
  outcome VARCHAR(100) NOT NULL,
  revenue DECIMAL(12, 2) NOT NULL DEFAULT 0,
  consult_date DATE NULL,
  notes TEXT NULL,
  deposit_status VARCHAR(50) NOT NULL DEFAULT 'not_required',
  lost_reason VARCHAR(255) NULL,
  created_by CHAR(36) COLLATE utf8mb4_unicode_ci NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  KEY idx_mce_clinic (clinic_id),
  KEY idx_mce_contact (clinic_id, contact_id),
  KEY idx_mce_outcome (clinic_id, outcome),
  CONSTRAINT fk_mce_clinic FOREIGN KEY (clinic_id) REFERENCES clinic(id) ON DELETE RESTRICT,
  CONSTRAINT fk_mce_contact FOREIGN KEY (contact_id) REFERENCES contact(id) ON DELETE SET NULL,
  CONSTRAINT fk_mce_appointment FOREIGN KEY (appointment_id) REFERENCES appointment(id) ON DELETE SET NULL,
  CONSTRAINT fk_mce_practitioner FOREIGN KEY (practitioner_id) REFERENCES user(id) ON DELETE SET NULL,
  CONSTRAINT fk_mce_user FOREIGN KEY (created_by) REFERENCES user(id) ON DELETE SET NULL
);

SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'manual_consult_entry'
    AND COLUMN_NAME = 'contact_id'
);
SET @statement = IF(
  @column_exists = 0,
  'ALTER TABLE manual_consult_entry ADD COLUMN contact_id CHAR(36) COLLATE utf8mb4_unicode_ci NULL AFTER clinic_id',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'manual_consult_entry'
    AND COLUMN_NAME = 'appointment_id'
);
SET @statement = IF(
  @column_exists = 0,
  'ALTER TABLE manual_consult_entry ADD COLUMN appointment_id CHAR(36) COLLATE utf8mb4_unicode_ci NULL AFTER contact_id',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'manual_consult_entry'
    AND COLUMN_NAME = 'practitioner_id'
);
SET @statement = IF(
  @column_exists = 0,
  'ALTER TABLE manual_consult_entry ADD COLUMN practitioner_id CHAR(36) COLLATE utf8mb4_unicode_ci NULL AFTER practitioner',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'manual_consult_entry'
    AND COLUMN_NAME = 'deposit_status'
);
SET @statement = IF(
  @column_exists = 0,
  'ALTER TABLE manual_consult_entry ADD COLUMN deposit_status VARCHAR(50) NOT NULL DEFAULT ''not_required'' AFTER notes',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'manual_consult_entry'
    AND COLUMN_NAME = 'lost_reason'
);
SET @statement = IF(
  @column_exists = 0,
  'ALTER TABLE manual_consult_entry ADD COLUMN lost_reason VARCHAR(255) NULL AFTER deposit_status',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists = (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'manual_consult_entry'
    AND INDEX_NAME = 'idx_mce_contact'
);
SET @statement = IF(
  @index_exists = 0,
  'ALTER TABLE manual_consult_entry ADD INDEX idx_mce_contact (clinic_id, contact_id)',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists = (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'manual_consult_entry'
    AND INDEX_NAME = 'idx_mce_outcome'
);
SET @statement = IF(
  @index_exists = 0,
  'ALTER TABLE manual_consult_entry ADD INDEX idx_mce_outcome (clinic_id, outcome)',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @constraint_exists = (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = @schema_name
    AND TABLE_NAME = 'manual_consult_entry'
    AND CONSTRAINT_NAME = 'fk_mce_contact'
);
SET @statement = IF(
  @constraint_exists = 0,
  'ALTER TABLE manual_consult_entry ADD CONSTRAINT fk_mce_contact FOREIGN KEY (contact_id) REFERENCES contact (id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @constraint_exists = (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = @schema_name
    AND TABLE_NAME = 'manual_consult_entry'
    AND CONSTRAINT_NAME = 'fk_mce_appointment'
);
SET @statement = IF(
  @constraint_exists = 0,
  'ALTER TABLE manual_consult_entry ADD CONSTRAINT fk_mce_appointment FOREIGN KEY (appointment_id) REFERENCES appointment (id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @constraint_exists = (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = @schema_name
    AND TABLE_NAME = 'manual_consult_entry'
    AND CONSTRAINT_NAME = 'fk_mce_practitioner'
);
SET @statement = IF(
  @constraint_exists = 0,
  'ALTER TABLE manual_consult_entry ADD CONSTRAINT fk_mce_practitioner FOREIGN KEY (practitioner_id) REFERENCES user (id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

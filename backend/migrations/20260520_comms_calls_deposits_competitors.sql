CREATE TABLE IF NOT EXISTS deposit_record (
  id CHAR(36) PRIMARY KEY,
  clinic_id CHAR(36) NOT NULL,
  contact_id CHAR(36) NULL,
  appointment_id CHAR(36) NULL,
  contact_name VARCHAR(255) NOT NULL,
  treatment VARCHAR(255) NOT NULL,
  appointment_date DATE NULL,
  deposit_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  deposit_paid TINYINT(1) NOT NULL DEFAULT 0,
  paid_date DATE NULL,
  method VARCHAR(100) NULL,
  showed_up TINYINT(1) NULL,
  practitioner VARCHAR(255) NULL,
  status ENUM('requested', 'paid', 'failed', 'unpaid', 'waived', 'refunded') NOT NULL DEFAULT 'unpaid',
  reminder_sent TINYINT(1) NOT NULL DEFAULT 0,
  deposit_requested TINYINT(1) NOT NULL DEFAULT 0,
  created_by CHAR(36) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  KEY idx_deposit_record_clinic (clinic_id),
  KEY idx_deposit_record_contact (clinic_id, contact_id),
  KEY idx_deposit_record_appointment (clinic_id, appointment_id),
  CONSTRAINT fk_deposit_record_clinic FOREIGN KEY (clinic_id) REFERENCES clinic(id) ON DELETE RESTRICT,
  CONSTRAINT fk_deposit_record_contact FOREIGN KEY (contact_id) REFERENCES contact(id) ON DELETE SET NULL,
  CONSTRAINT fk_deposit_record_appointment FOREIGN KEY (appointment_id) REFERENCES appointment(id) ON DELETE SET NULL,
  CONSTRAINT fk_deposit_record_user FOREIGN KEY (created_by) REFERENCES user(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

CREATE TABLE IF NOT EXISTS competitor (
  id CHAR(36) PRIMARY KEY,
  clinic_id CHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  url VARCHAR(500) NOT NULL,
  key_treatments JSON NOT NULL,
  price_position ENUM('Budget', 'Mid-range', 'Premium') NOT NULL DEFAULT 'Mid-range',
  offer TEXT NULL,
  messaging_angle TEXT NULL,
  ad_presence JSON NOT NULL,
  seo_strength ENUM('Strong', 'Medium', 'Weak') NOT NULL DEFAULT 'Weak',
  rating DECIMAL(3, 1) NOT NULL DEFAULT 0,
  reviews INT NOT NULL DEFAULT 0,
  created_by CHAR(36) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  KEY idx_competitor_clinic (clinic_id),
  CONSTRAINT fk_competitor_clinic FOREIGN KEY (clinic_id) REFERENCES clinic(id) ON DELETE RESTRICT,
  CONSTRAINT fk_competitor_user FOREIGN KEY (created_by) REFERENCES user(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

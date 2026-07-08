SET @schema_name = DATABASE();

SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'compliance_document'
    AND COLUMN_NAME = 'file_name'
);
SET @statement = IF(
  @column_exists = 0,
  'ALTER TABLE compliance_document ADD COLUMN file_name VARCHAR(255) NULL AFTER due_date',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'compliance_document'
    AND COLUMN_NAME = 'mime_type'
);
SET @statement = IF(
  @column_exists = 0,
  'ALTER TABLE compliance_document ADD COLUMN mime_type VARCHAR(100) NULL AFTER file_name',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'compliance_document'
    AND COLUMN_NAME = 'size_bytes'
);
SET @statement = IF(
  @column_exists = 0,
  'ALTER TABLE compliance_document ADD COLUMN size_bytes INT UNSIGNED NULL AFTER mime_type',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'compliance_document'
    AND COLUMN_NAME = 'asset_data'
);
SET @statement = IF(
  @column_exists = 0,
  'ALTER TABLE compliance_document ADD COLUMN asset_data LONGBLOB NULL AFTER size_bytes',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS compliance_data_access_request (
  id CHAR(36) NOT NULL,
  clinic_id CHAR(36) NOT NULL,
  requester_name VARCHAR(255) NOT NULL,
  requester_email VARCHAR(255) NULL,
  requester_phone VARCHAR(50) NULL,
  request_type ENUM('access', 'erasure', 'rectification', 'portability', 'restriction') NOT NULL DEFAULT 'access',
  status ENUM('received', 'verifying_identity', 'in_progress', 'completed', 'rejected', 'cancelled') NOT NULL DEFAULT 'received',
  due_date DATE NULL,
  completed_at DATETIME NULL,
  notes TEXT NULL,
  created_by CHAR(36) NULL,
  updated_by CHAR(36) NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_compliance_dar_clinic_status (clinic_id, status, due_date, deleted_at),
  KEY idx_compliance_dar_requester (clinic_id, requester_email, deleted_at),
  CONSTRAINT fk_compliance_dar_clinic FOREIGN KEY (clinic_id) REFERENCES clinic (id) ON DELETE RESTRICT,
  CONSTRAINT fk_compliance_dar_created_by FOREIGN KEY (created_by) REFERENCES user (id) ON DELETE SET NULL,
  CONSTRAINT fk_compliance_dar_updated_by FOREIGN KEY (updated_by) REFERENCES user (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

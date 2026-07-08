SET @schema_name = DATABASE();

SET @column_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = @schema_name
    AND table_name = ' call '
    AND column_name = 'consent_captured'
);
SET @sql := IF(
  @column_exists = 0,
  "ALTER TABLE ` call ` ADD COLUMN consent_captured TINYINT(1) NOT NULL DEFAULT 0 AFTER recording_source",
  "SELECT 'call.consent_captured already exists'"
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = @schema_name
    AND table_name = ' call '
    AND column_name = 'consent_method'
);
SET @sql := IF(
  @column_exists = 0,
  "ALTER TABLE ` call ` ADD COLUMN consent_method VARCHAR(30) NULL AFTER consent_captured",
  "SELECT 'call.consent_method already exists'"
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = @schema_name
    AND table_name = ' call '
    AND column_name = 'consent_timestamp'
);
SET @sql := IF(
  @column_exists = 0,
  "ALTER TABLE ` call ` ADD COLUMN consent_timestamp DATETIME NULL AFTER consent_method",
  "SELECT 'call.consent_timestamp already exists'"
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = @schema_name
    AND table_name = ' call '
    AND column_name = 'retention_deadline'
);
SET @sql := IF(
  @column_exists = 0,
  "ALTER TABLE ` call ` ADD COLUMN retention_deadline DATE NULL AFTER consent_timestamp",
  "SELECT 'call.retention_deadline already exists'"
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS call_recording_deletion_request (
  id CHAR(36) NOT NULL,
  clinic_id CHAR(36) NOT NULL,
  call_id CHAR(36) NOT NULL,
  status ENUM('requested', 'approved', 'completed', 'rejected', 'cancelled') NOT NULL DEFAULT 'requested',
  reason TEXT NULL,
  requested_by CHAR(36) NULL,
  requested_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_by CHAR(36) NULL,
  resolved_at DATETIME NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_call_recording_deletion_clinic_call (clinic_id, call_id, deleted_at),
  KEY idx_call_recording_deletion_status (clinic_id, status, deleted_at),
  CONSTRAINT fk_call_recording_deletion_clinic FOREIGN KEY (clinic_id) REFERENCES clinic (id) ON DELETE RESTRICT,
  CONSTRAINT fk_call_recording_deletion_call FOREIGN KEY (call_id) REFERENCES ` call ` (id) ON DELETE CASCADE,
  CONSTRAINT fk_call_recording_deletion_requested_by FOREIGN KEY (requested_by) REFERENCES user (id) ON DELETE SET NULL,
  CONSTRAINT fk_call_recording_deletion_resolved_by FOREIGN KEY (resolved_by) REFERENCES user (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

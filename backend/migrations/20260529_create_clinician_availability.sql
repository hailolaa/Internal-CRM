-- Create clinician availability table for weekly recurring availability
CREATE TABLE IF NOT EXISTS clinician_availability (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  clinic_id VARCHAR(36) NOT NULL,
  clinician_id VARCHAR(36) NOT NULL,
  day_of_week TINYINT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  slot_interval_minutes INT DEFAULT 30,
  is_active TINYINT DEFAULT 1,
  created_by VARCHAR(36) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  INDEX idx_clinic_clinician (clinic_id, clinician_id),
  INDEX idx_clinic_day (clinic_id, day_of_week)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @schema_name = DATABASE();

SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'clinician_availability'
    AND COLUMN_NAME = 'created_by'
);
SET @statement = IF(
  @column_exists = 0,
  'ALTER TABLE clinician_availability ADD COLUMN created_by VARCHAR(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER is_active',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

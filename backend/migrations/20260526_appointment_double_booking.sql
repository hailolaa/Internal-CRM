SET @schema_name = DATABASE();

SET @index_exists = (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'appointment'
    AND INDEX_NAME = 'idx_appointment_clinician_slot'
);
SET @statement = IF(
  @index_exists = 0,
  'ALTER TABLE appointment ADD INDEX idx_appointment_clinician_slot (clinic_id, clinician_id, date_time, status, deleted_at)',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

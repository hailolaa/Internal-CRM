SET @appointment_has_recurrence_rule := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'appointment'
    AND COLUMN_NAME = 'recurrence_rule'
);
SET @appointment_recurrence_rule_sql := IF(
  @appointment_has_recurrence_rule = 0,
  'ALTER TABLE appointment ADD COLUMN recurrence_rule JSON NULL AFTER consult_notes',
  'SELECT 1'
);
PREPARE appointment_recurrence_rule_stmt FROM @appointment_recurrence_rule_sql;
EXECUTE appointment_recurrence_rule_stmt;
DEALLOCATE PREPARE appointment_recurrence_rule_stmt;

SET @appointment_has_recurrence_series_id := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'appointment'
    AND COLUMN_NAME = 'recurrence_series_id'
);
SET @appointment_recurrence_series_sql := IF(
  @appointment_has_recurrence_series_id = 0,
  'ALTER TABLE appointment ADD COLUMN recurrence_series_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL AFTER recurrence_rule',
  'SELECT 1'
);
PREPARE appointment_recurrence_series_stmt FROM @appointment_recurrence_series_sql;
EXECUTE appointment_recurrence_series_stmt;
DEALLOCATE PREPARE appointment_recurrence_series_stmt;

SET @appointment_has_recurrence_position := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'appointment'
    AND COLUMN_NAME = 'recurrence_position'
);
SET @appointment_recurrence_position_sql := IF(
  @appointment_has_recurrence_position = 0,
  'ALTER TABLE appointment ADD COLUMN recurrence_position INT NULL AFTER recurrence_series_id',
  'SELECT 1'
);
PREPARE appointment_recurrence_position_stmt FROM @appointment_recurrence_position_sql;
EXECUTE appointment_recurrence_position_stmt;
DEALLOCATE PREPARE appointment_recurrence_position_stmt;

SET @appointment_has_recurrence_idx := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'appointment'
    AND INDEX_NAME = 'idx_appointment_recurrence_series'
);
SET @appointment_recurrence_idx_sql := IF(
  @appointment_has_recurrence_idx = 0,
  'ALTER TABLE appointment ADD INDEX idx_appointment_recurrence_series (clinic_id, recurrence_series_id, recurrence_position)',
  'SELECT 1'
);
PREPARE appointment_recurrence_idx_stmt FROM @appointment_recurrence_idx_sql;
EXECUTE appointment_recurrence_idx_stmt;
DEALLOCATE PREPARE appointment_recurrence_idx_stmt;

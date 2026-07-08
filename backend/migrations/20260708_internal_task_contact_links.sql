SET @schema_name = DATABASE();

SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'task'
    AND COLUMN_NAME = 'contact_id'
);
SET @statement = IF(
  @column_exists = 0,
  'ALTER TABLE task ADD COLUMN contact_id CHAR(36) NULL AFTER client_account_service_id',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists = (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'task'
    AND INDEX_NAME = 'idx_task_contact'
);
SET @statement = IF(
  @index_exists = 0,
  'ALTER TABLE task ADD INDEX idx_task_contact (clinic_id, contact_id)',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @constraint_exists = (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = @schema_name
    AND TABLE_NAME = 'task'
    AND CONSTRAINT_NAME = 'fk_task_contact'
);
SET @statement = IF(
  @constraint_exists = 0,
  'ALTER TABLE task ADD CONSTRAINT fk_task_contact FOREIGN KEY (contact_id) REFERENCES contact(id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

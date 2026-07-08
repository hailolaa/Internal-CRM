SET @schema_name = DATABASE();

SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'insight'
    AND COLUMN_NAME = 'action_task_id'
);

SET @statement = IF(
  @column_exists = 0,
  'ALTER TABLE insight ADD COLUMN action_task_id CHAR(36) COLLATE utf8mb4_unicode_ci NULL AFTER source_contact_id',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists = (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'insight'
    AND INDEX_NAME = 'idx_insight_action_task'
);

SET @statement = IF(
  @index_exists = 0,
  'ALTER TABLE insight ADD INDEX idx_insight_action_task (action_task_id)',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @constraint_exists = (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = @schema_name
    AND TABLE_NAME = 'insight'
    AND CONSTRAINT_NAME = 'fk_insight_action_task'
);

SET @statement = IF(
  @constraint_exists = 0,
  'ALTER TABLE insight ADD CONSTRAINT fk_insight_action_task FOREIGN KEY (action_task_id) REFERENCES task(id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

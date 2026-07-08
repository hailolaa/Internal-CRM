SET @schema_name = DATABASE();

SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'form_submission'
    AND COLUMN_NAME = 'contact_id'
);
SET @statement = IF(
  @column_exists = 0,
  'ALTER TABLE form_submission ADD COLUMN contact_id CHAR(36) NULL AFTER form_id',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'form_submission'
    AND COLUMN_NAME = 'pipeline_deal_id'
);
SET @statement = IF(
  @column_exists = 0,
  'ALTER TABLE form_submission ADD COLUMN pipeline_deal_id CHAR(36) NULL AFTER contact_id',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'form_submission'
    AND COLUMN_NAME = 'updated_at'
);
SET @statement = IF(
  @column_exists = 0,
  'ALTER TABLE form_submission ADD COLUMN updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER submitted_at',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'form_submission'
    AND COLUMN_NAME = 'archived_at'
);
SET @statement = IF(
  @column_exists = 0,
  'ALTER TABLE form_submission ADD COLUMN archived_at TIMESTAMP NULL AFTER updated_at',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists = (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'form_submission'
    AND INDEX_NAME = 'idx_fs_contact'
);
SET @statement = IF(
  @index_exists = 0,
  'ALTER TABLE form_submission ADD INDEX idx_fs_contact (clinic_id, contact_id)',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists = (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'form_submission'
    AND INDEX_NAME = 'idx_fs_pipeline_deal'
);
SET @statement = IF(
  @index_exists = 0,
  'ALTER TABLE form_submission ADD INDEX idx_fs_pipeline_deal (clinic_id, pipeline_deal_id)',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @constraint_exists = (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = @schema_name
    AND TABLE_NAME = 'form_submission'
    AND CONSTRAINT_NAME = 'fk_fs_contact'
);
SET @statement = IF(
  @constraint_exists = 0,
  'ALTER TABLE form_submission ADD CONSTRAINT fk_fs_contact FOREIGN KEY (contact_id) REFERENCES contact (id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @constraint_exists = (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = @schema_name
    AND TABLE_NAME = 'form_submission'
    AND CONSTRAINT_NAME = 'fk_fs_pipeline_deal'
);
SET @statement = IF(
  @constraint_exists = 0,
  'ALTER TABLE form_submission ADD CONSTRAINT fk_fs_pipeline_deal FOREIGN KEY (pipeline_deal_id) REFERENCES deal (id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

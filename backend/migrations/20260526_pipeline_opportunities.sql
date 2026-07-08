SET @schema_name = DATABASE();

SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'deal'
    AND COLUMN_NAME = 'pipeline_stage_id'
);
SET @statement = IF(
  @column_exists = 0,
  'ALTER TABLE deal ADD COLUMN pipeline_stage_id CHAR(36) NULL AFTER pipeline_id',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'deal'
    AND COLUMN_NAME = 'source'
);
SET @statement = IF(
  @column_exists = 0,
  'ALTER TABLE deal ADD COLUMN source VARCHAR(100) NULL AFTER owner_id',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'deal'
    AND COLUMN_NAME = 'treatment'
);
SET @statement = IF(
  @column_exists = 0,
  'ALTER TABLE deal ADD COLUMN treatment VARCHAR(255) NULL AFTER source',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'deal'
    AND COLUMN_NAME = 'status'
);
SET @statement = IF(
  @column_exists = 0,
  'ALTER TABLE deal ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT ''open'' AFTER treatment',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'deal'
    AND COLUMN_NAME = 'stage_changed_at'
);
SET @statement = IF(
  @column_exists = 0,
  'ALTER TABLE deal ADD COLUMN stage_changed_at DATETIME NULL AFTER status',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'deal'
    AND COLUMN_NAME = 'booked_at'
);
SET @statement = IF(
  @column_exists = 0,
  'ALTER TABLE deal ADD COLUMN booked_at DATETIME NULL AFTER stage_changed_at',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'deal'
    AND COLUMN_NAME = 'sold_at'
);
SET @statement = IF(
  @column_exists = 0,
  'ALTER TABLE deal ADD COLUMN sold_at DATETIME NULL AFTER booked_at',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'deal'
    AND COLUMN_NAME = 'lost_at'
);
SET @statement = IF(
  @column_exists = 0,
  'ALTER TABLE deal ADD COLUMN lost_at DATETIME NULL AFTER sold_at',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'deal'
    AND COLUMN_NAME = 'lost_reason'
);
SET @statement = IF(
  @column_exists = 0,
  'ALTER TABLE deal ADD COLUMN lost_reason VARCHAR(255) NULL AFTER lost_at',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'deal'
    AND COLUMN_NAME = 'created_by'
);
SET @statement = IF(
  @column_exists = 0,
  'ALTER TABLE deal ADD COLUMN created_by CHAR(36) NULL AFTER lost_reason',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE deal d
JOIN contact c ON c.id = d.contact_id AND c.clinic_id = d.clinic_id
SET d.source = COALESCE(d.source, c.source),
    d.stage_changed_at = COALESCE(d.stage_changed_at, d.updated_at, d.created_at),
    d.status = COALESCE(d.status, 'open')
WHERE d.deleted_at IS NULL;

SET @index_exists = (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'deal'
    AND INDEX_NAME = 'idx_deal_pipeline_stage'
);
SET @statement = IF(
  @index_exists = 0,
  'ALTER TABLE deal ADD INDEX idx_deal_pipeline_stage (clinic_id, pipeline_stage_id)',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists = (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'deal'
    AND INDEX_NAME = 'idx_deal_stage_status'
);
SET @statement = IF(
  @index_exists = 0,
  'ALTER TABLE deal ADD INDEX idx_deal_stage_status (clinic_id, status, stage)',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists = (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'deal'
    AND INDEX_NAME = 'idx_deal_stage_changed'
);
SET @statement = IF(
  @index_exists = 0,
  'ALTER TABLE deal ADD INDEX idx_deal_stage_changed (clinic_id, stage_changed_at)',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @constraint_exists = (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = @schema_name
    AND TABLE_NAME = 'deal'
    AND CONSTRAINT_NAME = 'fk_deal_pipeline_stage'
);
SET @statement = IF(
  @constraint_exists = 0,
  'ALTER TABLE deal ADD CONSTRAINT fk_deal_pipeline_stage FOREIGN KEY (pipeline_stage_id) REFERENCES pipeline_stage (id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @constraint_exists = (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = @schema_name
    AND TABLE_NAME = 'deal'
    AND CONSTRAINT_NAME = 'fk_deal_created_by'
);
SET @statement = IF(
  @constraint_exists = 0,
  'ALTER TABLE deal ADD CONSTRAINT fk_deal_created_by FOREIGN KEY (created_by) REFERENCES user (id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS pipeline_deal_movement (
  id CHAR(36) NOT NULL,
  clinic_id CHAR(36) NOT NULL,
  deal_id CHAR(36) NOT NULL,
  pipeline_id CHAR(36) NOT NULL,
  from_stage_id CHAR(36) NULL,
  to_stage_id CHAR(36) NOT NULL,
  from_stage VARCHAR(100) NULL,
  to_stage VARCHAR(100) NOT NULL,
  moved_by CHAR(36) NULL,
  moved_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metadata JSON NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_pipeline_deal_movement_clinic (clinic_id, moved_at),
  KEY idx_pipeline_deal_movement_deal (deal_id, moved_at),
  KEY idx_pipeline_deal_movement_pipeline (pipeline_id, moved_at),
  CONSTRAINT fk_pdm_clinic FOREIGN KEY (clinic_id) REFERENCES clinic (id) ON DELETE CASCADE,
  CONSTRAINT fk_pdm_deal FOREIGN KEY (deal_id) REFERENCES deal (id) ON DELETE CASCADE,
  CONSTRAINT fk_pdm_pipeline FOREIGN KEY (pipeline_id) REFERENCES pipeline (id) ON DELETE CASCADE,
  CONSTRAINT fk_pdm_from_stage FOREIGN KEY (from_stage_id) REFERENCES pipeline_stage (id) ON DELETE SET NULL,
  CONSTRAINT fk_pdm_to_stage FOREIGN KEY (to_stage_id) REFERENCES pipeline_stage (id) ON DELETE CASCADE,
  CONSTRAINT fk_pdm_moved_by FOREIGN KEY (moved_by) REFERENCES user (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

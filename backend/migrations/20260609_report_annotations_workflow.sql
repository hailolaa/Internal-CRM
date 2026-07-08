SET @column_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'report'
    AND column_name = 'workflow_status'
);
SET @sql := IF(
  @column_exists = 0,
  "ALTER TABLE report ADD COLUMN workflow_status ENUM('draft','in_review','approved','published') NOT NULL DEFAULT 'draft' AFTER data",
  "SELECT 'report.workflow_status already exists'"
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'report'
    AND column_name = 'internal_notes'
);
SET @sql := IF(
  @column_exists = 0,
  "ALTER TABLE report ADD COLUMN internal_notes TEXT NULL AFTER workflow_status",
  "SELECT 'report.internal_notes already exists'"
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'report'
    AND column_name = 'client_commentary'
);
SET @sql := IF(
  @column_exists = 0,
  "ALTER TABLE report ADD COLUMN client_commentary TEXT NULL AFTER internal_notes",
  "SELECT 'report.client_commentary already exists'"
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'report'
    AND column_name = 'ai_draft_summary'
);
SET @sql := IF(
  @column_exists = 0,
  "ALTER TABLE report ADD COLUMN ai_draft_summary TEXT NULL AFTER client_commentary",
  "SELECT 'report.ai_draft_summary already exists'"
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'report'
    AND column_name = 'approved_by'
);
SET @sql := IF(
  @column_exists = 0,
  "ALTER TABLE report ADD COLUMN approved_by CHAR(36) COLLATE utf8mb4_unicode_ci NULL AFTER ai_draft_summary",
  "SELECT 'report.approved_by already exists'"
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'report'
    AND column_name = 'approved_at'
);
SET @sql := IF(
  @column_exists = 0,
  "ALTER TABLE report ADD COLUMN approved_at TIMESTAMP NULL DEFAULT NULL AFTER approved_by",
  "SELECT 'report.approved_at already exists'"
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'report'
    AND column_name = 'published_at'
);
SET @sql := IF(
  @column_exists = 0,
  "ALTER TABLE report ADD COLUMN published_at TIMESTAMP NULL DEFAULT NULL AFTER approved_at",
  "SELECT 'report.published_at already exists'"
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'report'
    AND index_name = 'idx_report_workflow_status'
);
SET @sql := IF(
  @index_exists = 0,
  "ALTER TABLE report ADD INDEX idx_report_workflow_status (workflow_status)",
  "SELECT 'report.idx_report_workflow_status already exists'"
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

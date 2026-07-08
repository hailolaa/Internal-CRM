SET @column_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = ' call '
    AND column_name = 'ai_summary'
);
SET @sql := IF(
  @column_exists = 0,
  "ALTER TABLE ` call ` ADD COLUMN ai_summary TEXT NULL AFTER transcript",
  "SELECT 'call.ai_summary already exists'"
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = ' call '
    AND column_name = 'sentiment'
);
SET @sql := IF(
  @column_exists = 0,
  "ALTER TABLE ` call ` ADD COLUMN sentiment VARCHAR(20) NULL AFTER ai_summary",
  "SELECT 'call.sentiment already exists'"
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = ' call '
    AND column_name = 'booking_intent'
);
SET @sql := IF(
  @column_exists = 0,
  "ALTER TABLE ` call ` ADD COLUMN booking_intent VARCHAR(20) NULL AFTER sentiment",
  "SELECT 'call.booking_intent already exists'"
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = ' call '
    AND column_name = 'treatment_mentioned'
);
SET @sql := IF(
  @column_exists = 0,
  "ALTER TABLE ` call ` ADD COLUMN treatment_mentioned VARCHAR(255) NULL AFTER booking_intent",
  "SELECT 'call.treatment_mentioned already exists'"
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = ' call '
    AND column_name = 'quality_score'
);
SET @sql := IF(
  @column_exists = 0,
  "ALTER TABLE ` call ` ADD COLUMN quality_score INT NULL AFTER treatment_mentioned",
  "SELECT 'call.quality_score already exists'"
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = ' call '
    AND column_name = 'summary_generated_at'
);
SET @sql := IF(
  @column_exists = 0,
  "ALTER TABLE ` call ` ADD COLUMN summary_generated_at DATETIME NULL AFTER quality_score",
  "SELECT 'call.summary_generated_at already exists'"
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = ' call '
    AND index_name = 'idx_call_intelligence'
);
SET @sql := IF(
  @index_exists = 0,
  "ALTER TABLE ` call ` ADD INDEX idx_call_intelligence (clinic_id, sentiment, booking_intent)",
  "SELECT 'call.idx_call_intelligence already exists'"
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

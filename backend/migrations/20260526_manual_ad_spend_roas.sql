CREATE TABLE IF NOT EXISTS manual_spend_entry (
  id CHAR(36) COLLATE utf8mb4_unicode_ci PRIMARY KEY,
  clinic_id CHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  source VARCHAR(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  channel VARCHAR(100) COLLATE utf8mb4_unicode_ci NULL,
  campaign VARCHAR(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  period VARCHAR(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  start_date DATE NULL,
  end_date DATE NULL,
  attribution_label VARCHAR(255) COLLATE utf8mb4_unicode_ci NULL,
  notes TEXT COLLATE utf8mb4_unicode_ci NULL,
  created_by CHAR(36) COLLATE utf8mb4_unicode_ci NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  KEY idx_mse_clinic (clinic_id),
  KEY idx_mse_channel (clinic_id, channel),
  KEY idx_mse_period_dates (clinic_id, start_date, end_date),
  CONSTRAINT fk_mse_clinic FOREIGN KEY (clinic_id) REFERENCES clinic(id) ON DELETE RESTRICT,
  CONSTRAINT fk_mse_user FOREIGN KEY (created_by) REFERENCES user(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @schema_name = DATABASE();
SET @sql = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE manual_spend_entry ADD COLUMN channel VARCHAR(100) COLLATE utf8mb4_unicode_ci NULL AFTER source', 'SELECT 1') FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'manual_spend_entry' AND COLUMN_NAME = 'channel');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE manual_spend_entry ADD COLUMN start_date DATE NULL AFTER period', 'SELECT 1') FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'manual_spend_entry' AND COLUMN_NAME = 'start_date');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE manual_spend_entry ADD COLUMN end_date DATE NULL AFTER start_date', 'SELECT 1') FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'manual_spend_entry' AND COLUMN_NAME = 'end_date');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE manual_spend_entry ADD COLUMN attribution_label VARCHAR(255) COLLATE utf8mb4_unicode_ci NULL AFTER end_date', 'SELECT 1') FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'manual_spend_entry' AND COLUMN_NAME = 'attribution_label');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE manual_spend_entry
SET channel = COALESCE(channel, source),
    attribution_label = COALESCE(attribution_label, 'manual_or_estimated')
WHERE deleted_at IS NULL;

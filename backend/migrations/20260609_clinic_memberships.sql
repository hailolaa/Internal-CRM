SET @schema_name = DATABASE();

CREATE TABLE IF NOT EXISTS clinic_membership (
  user_id CHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  clinic_id CHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  role VARCHAR(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  status VARCHAR(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  is_primary TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, clinic_id),
  KEY idx_clinic_membership_clinic (clinic_id, status),
  KEY idx_clinic_membership_user_status (user_id, status),
  CONSTRAINT fk_clinic_membership_user FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE,
  CONSTRAINT fk_clinic_membership_clinic FOREIGN KEY (clinic_id) REFERENCES clinic(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO clinic_membership (user_id, clinic_id, role, status, is_primary)
SELECT id, clinic_id, role, 'active', 1
FROM user
WHERE deleted_at IS NULL;

SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'tokens'
    AND COLUMN_NAME = 'active_clinic_id'
);
SET @statement = IF(
  @column_exists = 0,
  'ALTER TABLE tokens ADD COLUMN active_clinic_id CHAR(36) COLLATE utf8mb4_unicode_ci NULL AFTER user_id',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE tokens t
INNER JOIN user u ON u.id = t.user_id
SET t.active_clinic_id = u.clinic_id
WHERE t.active_clinic_id IS NULL
  AND t.token_type = 'refresh';

SET @index_exists = (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'tokens'
    AND INDEX_NAME = 'idx_tokens_active_clinic'
);
SET @statement = IF(
  @index_exists = 0,
  'ALTER TABLE tokens ADD INDEX idx_tokens_active_clinic (active_clinic_id)',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @constraint_exists = (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = @schema_name
    AND TABLE_NAME = 'tokens'
    AND CONSTRAINT_NAME = 'fk_tokens_active_clinic'
);
SET @statement = IF(
  @constraint_exists = 0,
  'ALTER TABLE tokens ADD CONSTRAINT fk_tokens_active_clinic FOREIGN KEY (active_clinic_id) REFERENCES clinic(id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

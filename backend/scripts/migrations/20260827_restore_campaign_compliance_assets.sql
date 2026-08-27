CREATE TABLE IF NOT EXISTS campaign_media (
  id CHAR(36) NOT NULL,
  clinic_id CHAR(36) NOT NULL,
  campaign_id CHAR(36) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  size_bytes INT UNSIGNED NOT NULL,
  asset_data LONGBLOB NOT NULL,
  created_by CHAR(36) NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_campaign_media_campaign (clinic_id, campaign_id, deleted_at),
  KEY fk_campaign_media_campaign (campaign_id),
  KEY fk_campaign_media_user (created_by),
  CONSTRAINT fk_campaign_media_clinic FOREIGN KEY (clinic_id) REFERENCES clinic(id) ON DELETE RESTRICT,
  CONSTRAINT fk_campaign_media_campaign FOREIGN KEY (campaign_id) REFERENCES campaign(id) ON DELETE CASCADE,
  CONSTRAINT fk_campaign_media_user FOREIGN KEY (created_by) REFERENCES user(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @schema_name = DATABASE();

SET @add_compliance_file_name = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'compliance_document' AND COLUMN_NAME = 'file_name') = 0,
  'ALTER TABLE compliance_document ADD COLUMN file_name VARCHAR(255) NULL AFTER due_date',
  'SELECT ''compliance_document.file_name already exists'' AS message'
);
PREPARE stmt FROM @add_compliance_file_name;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_compliance_mime_type = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'compliance_document' AND COLUMN_NAME = 'mime_type') = 0,
  'ALTER TABLE compliance_document ADD COLUMN mime_type VARCHAR(100) NULL AFTER file_name',
  'SELECT ''compliance_document.mime_type already exists'' AS message'
);
PREPARE stmt FROM @add_compliance_mime_type;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_compliance_size_bytes = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'compliance_document' AND COLUMN_NAME = 'size_bytes') = 0,
  'ALTER TABLE compliance_document ADD COLUMN size_bytes INT UNSIGNED NULL AFTER mime_type',
  'SELECT ''compliance_document.size_bytes already exists'' AS message'
);
PREPARE stmt FROM @add_compliance_size_bytes;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_compliance_asset_data = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'compliance_document' AND COLUMN_NAME = 'asset_data') = 0,
  'ALTER TABLE compliance_document ADD COLUMN asset_data LONGBLOB NULL AFTER size_bytes',
  'SELECT ''compliance_document.asset_data already exists'' AS message'
);
PREPARE stmt FROM @add_compliance_asset_data;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS compliance_data_access_request (
  id CHAR(36) NOT NULL,
  clinic_id CHAR(36) NOT NULL,
  requester_name VARCHAR(255) NOT NULL,
  requester_email VARCHAR(255) NULL,
  requester_phone VARCHAR(50) NULL,
  request_type VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'received',
  due_date DATE NULL,
  completed_at TIMESTAMP NULL,
  notes TEXT NULL,
  created_by CHAR(36) NULL,
  updated_by CHAR(36) NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_compliance_request_clinic (clinic_id, status, deleted_at),
  KEY fk_compliance_request_created_by (created_by),
  KEY fk_compliance_request_updated_by (updated_by),
  CONSTRAINT fk_compliance_request_clinic FOREIGN KEY (clinic_id) REFERENCES clinic(id) ON DELETE RESTRICT,
  CONSTRAINT fk_compliance_request_created_by FOREIGN KEY (created_by) REFERENCES user(id) ON DELETE SET NULL,
  CONSTRAINT fk_compliance_request_updated_by FOREIGN KEY (updated_by) REFERENCES user(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @add_report_internal_notes = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'report' AND COLUMN_NAME = 'internal_notes') > 0,
  'SELECT ''report.internal_notes already exists'' AS message',
  IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'report' AND COLUMN_NAME = 'clinical_notes') > 0,
    'ALTER TABLE report CHANGE COLUMN clinical_notes internal_notes TEXT NULL',
    'ALTER TABLE report ADD COLUMN internal_notes TEXT NULL AFTER workflow_status'
  )
);
PREPARE stmt FROM @add_report_internal_notes;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

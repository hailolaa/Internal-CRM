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
  KEY idx_campaign_media_deleted (deleted_at),
  CONSTRAINT fk_campaign_media_clinic FOREIGN KEY (clinic_id) REFERENCES clinic (id) ON DELETE RESTRICT,
  CONSTRAINT fk_campaign_media_campaign FOREIGN KEY (campaign_id) REFERENCES campaign (id) ON DELETE CASCADE,
  CONSTRAINT fk_campaign_media_created_by FOREIGN KEY (created_by) REFERENCES user (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

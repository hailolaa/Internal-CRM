CREATE TABLE IF NOT EXISTS reputation_setting (
  clinic_id CHAR(36) NOT NULL,
  google_review_link VARCHAR(1000) NULL,
  review_request_template TEXT NULL,
  manual_review_received_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (clinic_id),
  CONSTRAINT fk_reputation_setting_clinic FOREIGN KEY (clinic_id) REFERENCES clinic(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS review_request (
  id CHAR(36) NOT NULL,
  clinic_id CHAR(36) NOT NULL,
  contact_id CHAR(36) NULL,
  recipient_name VARCHAR(255) NULL,
  recipient_phone VARCHAR(50) NULL,
  recipient_email VARCHAR(255) NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  message TEXT NULL,
  sent_at TIMESTAMP NULL,
  created_by CHAR(36) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  PRIMARY KEY (id),
  KEY idx_review_request_clinic (clinic_id, status),
  CONSTRAINT fk_review_request_clinic FOREIGN KEY (clinic_id) REFERENCES clinic(id) ON DELETE CASCADE,
  CONSTRAINT fk_review_request_contact FOREIGN KEY (contact_id) REFERENCES contact(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS gbp_checklist_item (
  id CHAR(36) NOT NULL,
  clinic_id CHAR(36) NOT NULL,
  item_key VARCHAR(100) NOT NULL,
  label VARCHAR(255) NOT NULL,
  completed TINYINT(1) NOT NULL DEFAULT 0,
  updated_by CHAR(36) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_gbp_checklist_clinic_key (clinic_id, item_key),
  CONSTRAINT fk_gbp_checklist_clinic FOREIGN KEY (clinic_id) REFERENCES clinic(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

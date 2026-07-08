CREATE TABLE IF NOT EXISTS task (
  id CHAR(36) PRIMARY KEY,
  clinic_id CHAR(36) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  priority ENUM('low', 'medium', 'high') NOT NULL DEFAULT 'medium',
  status ENUM('pending', 'completed') NOT NULL DEFAULT 'pending',
  category VARCHAR(100) NULL,
  contact_name VARCHAR(255) NULL,
  due_label VARCHAR(100) NULL,
  due_date DATE NULL,
  assigned_to VARCHAR(255) NULL,
  created_by CHAR(36) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  KEY idx_task_clinic (clinic_id),
  CONSTRAINT fk_task_clinic FOREIGN KEY (clinic_id) REFERENCES clinic(id) ON DELETE RESTRICT,
  CONSTRAINT fk_task_user FOREIGN KEY (created_by) REFERENCES user(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sop (
  id CHAR(36) PRIMARY KEY,
  clinic_id CHAR(36) NOT NULL,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL DEFAULT 'General',
  content LONGTEXT NULL,
  owner VARCHAR(255) NULL,
  status ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft',
  created_by CHAR(36) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  KEY idx_sop_clinic (clinic_id),
  CONSTRAINT fk_sop_clinic FOREIGN KEY (clinic_id) REFERENCES clinic(id) ON DELETE RESTRICT,
  CONSTRAINT fk_sop_user FOREIGN KEY (created_by) REFERENCES user(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS marketing_offer (
  id CHAR(36) PRIMARY KEY,
  clinic_id CHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  discount VARCHAR(100) NOT NULL,
  treatment VARCHAR(255) NOT NULL,
  valid_until VARCHAR(100) NOT NULL,
  redemptions INT NOT NULL DEFAULT 0,
  status ENUM('active', 'scheduled', 'expired') NOT NULL DEFAULT 'active',
  description TEXT NULL,
  created_by CHAR(36) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  KEY idx_marketing_offer_clinic (clinic_id),
  CONSTRAINT fk_marketing_offer_clinic FOREIGN KEY (clinic_id) REFERENCES clinic(id) ON DELETE RESTRICT,
  CONSTRAINT fk_marketing_offer_user FOREIGN KEY (created_by) REFERENCES user(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS compliance_document (
  id CHAR(36) PRIMARY KEY,
  clinic_id CHAR(36) NOT NULL,
  title VARCHAR(255) NOT NULL,
  status ENUM('complete', 'action_required', 'expiring_soon') NOT NULL DEFAULT 'action_required',
  category ENUM('gdpr', 'clinical', 'training', 'insurance', 'regulatory') NOT NULL DEFAULT 'regulatory',
  due_date DATE NULL,
  created_by CHAR(36) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  KEY idx_compliance_document_clinic (clinic_id),
  CONSTRAINT fk_compliance_document_clinic FOREIGN KEY (clinic_id) REFERENCES clinic(id) ON DELETE RESTRICT,
  CONSTRAINT fk_compliance_document_user FOREIGN KEY (created_by) REFERENCES user(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS compliance_setting (
  id CHAR(36) PRIMARY KEY,
  clinic_id CHAR(36) NOT NULL,
  key_name VARCHAR(100) NOT NULL,
  value_json JSON NOT NULL,
  updated_by CHAR(36) NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_compliance_setting (clinic_id, key_name),
  CONSTRAINT fk_compliance_setting_clinic FOREIGN KEY (clinic_id) REFERENCES clinic(id) ON DELETE RESTRICT,
  CONSTRAINT fk_compliance_setting_user FOREIGN KEY (updated_by) REFERENCES user(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

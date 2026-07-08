CREATE TABLE IF NOT EXISTS manual_spend_entry (
  id CHAR(36) PRIMARY KEY,
  clinic_id CHAR(36) NOT NULL,
  source VARCHAR(100) NOT NULL,
  campaign VARCHAR(255) NOT NULL,
  amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  period VARCHAR(100) NOT NULL,
  notes TEXT NULL,
  created_by CHAR(36) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  KEY idx_mse_clinic (clinic_id),
  CONSTRAINT fk_mse_clinic FOREIGN KEY (clinic_id) REFERENCES clinic(id) ON DELETE RESTRICT,
  CONSTRAINT fk_mse_user FOREIGN KEY (created_by) REFERENCES user(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS manual_consult_entry (
  id CHAR(36) PRIMARY KEY,
  clinic_id CHAR(36) NOT NULL,
  patient_name VARCHAR(255) NOT NULL,
  treatment VARCHAR(255) NOT NULL,
  practitioner VARCHAR(255) NOT NULL,
  outcome VARCHAR(100) NOT NULL,
  revenue DECIMAL(12, 2) NOT NULL DEFAULT 0,
  consult_date DATE NULL,
  notes TEXT NULL,
  created_by CHAR(36) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  KEY idx_mce_clinic (clinic_id),
  CONSTRAINT fk_mce_clinic FOREIGN KEY (clinic_id) REFERENCES clinic(id) ON DELETE RESTRICT,
  CONSTRAINT fk_mce_user FOREIGN KEY (created_by) REFERENCES user(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS form_definition (
  id CHAR(36) PRIMARY KEY,
  clinic_id CHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'Lead',
  status ENUM('active', 'draft', 'archived') NOT NULL DEFAULT 'draft',
  fields JSON NULL,
  views INT NOT NULL DEFAULT 0,
  created_by CHAR(36) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  KEY idx_fd_clinic (clinic_id),
  CONSTRAINT fk_fd_clinic FOREIGN KEY (clinic_id) REFERENCES clinic(id) ON DELETE RESTRICT,
  CONSTRAINT fk_fd_user FOREIGN KEY (created_by) REFERENCES user(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS form_submission (
  id CHAR(36) PRIMARY KEY,
  clinic_id CHAR(36) NOT NULL,
  form_id CHAR(36) NOT NULL,
  submitted_data JSON NOT NULL,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  KEY idx_fs_clinic (clinic_id),
  KEY idx_fs_form (form_id),
  CONSTRAINT fk_fs_clinic FOREIGN KEY (clinic_id) REFERENCES clinic(id) ON DELETE RESTRICT,
  CONSTRAINT fk_fs_form FOREIGN KEY (form_id) REFERENCES form_definition(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS communication_sequence (
  id CHAR(36) PRIMARY KEY,
  clinic_id CHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  trigger_label VARCHAR(255) NOT NULL,
  steps JSON NOT NULL,
  status ENUM('active', 'paused', 'draft', 'archived') NOT NULL DEFAULT 'draft',
  enrolled_count INT NOT NULL DEFAULT 0,
  completed_count INT NOT NULL DEFAULT 0,
  created_by CHAR(36) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  KEY idx_cs_clinic (clinic_id),
  CONSTRAINT fk_cs_clinic FOREIGN KEY (clinic_id) REFERENCES clinic(id) ON DELETE RESTRICT,
  CONSTRAINT fk_cs_user FOREIGN KEY (created_by) REFERENCES user(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ai_project (
  id CHAR(36) PRIMARY KEY,
  clinic_id CHAR(36) NOT NULL,
  title VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  status ENUM('active', 'draft', 'completed', 'archived') NOT NULL DEFAULT 'draft',
  created_by CHAR(36) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  KEY idx_ap_clinic (clinic_id),
  CONSTRAINT fk_ap_clinic FOREIGN KEY (clinic_id) REFERENCES clinic(id) ON DELETE RESTRICT,
  CONSTRAINT fk_ap_user FOREIGN KEY (created_by) REFERENCES user(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ai_run (
  id CHAR(36) PRIMARY KEY,
  clinic_id CHAR(36) NOT NULL,
  project_id CHAR(36) NULL,
  agent_name VARCHAR(100) NOT NULL,
  agent_key VARCHAR(100) NOT NULL,
  task VARCHAR(255) NOT NULL,
  input TEXT NULL,
  output JSON NULL,
  status ENUM('success', 'error', 'running') NOT NULL DEFAULT 'success',
  tokens INT NOT NULL DEFAULT 0,
  created_by CHAR(36) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  KEY idx_ar_clinic (clinic_id),
  KEY idx_ar_project (project_id),
  CONSTRAINT fk_ar_clinic FOREIGN KEY (clinic_id) REFERENCES clinic(id) ON DELETE RESTRICT,
  CONSTRAINT fk_ar_project FOREIGN KEY (project_id) REFERENCES ai_project(id) ON DELETE SET NULL,
  CONSTRAINT fk_ar_user FOREIGN KEY (created_by) REFERENCES user(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO permission (id, key_name, description)
VALUES ('perm-reports-write', 'reports:write', 'Manage report adjustments and manual entries');

INSERT IGNORE INTO role_permission (role_id, permission_id)
VALUES ('role-clinic-admin', 'perm-reports-write');

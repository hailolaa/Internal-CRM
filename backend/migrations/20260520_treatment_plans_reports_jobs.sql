CREATE TABLE IF NOT EXISTS treatment_plan (
  id CHAR(36) PRIMARY KEY,
  clinic_id CHAR(36) NOT NULL,
  contact_name VARCHAR(255) NOT NULL,
  avatar VARCHAR(10) NULL,
  treatment VARCHAR(255) NOT NULL,
  total_value DECIMAL(12, 2) NOT NULL DEFAULT 0,
  paid DECIMAL(12, 2) NOT NULL DEFAULT 0,
  outstanding DECIMAL(12, 2) NOT NULL DEFAULT 0,
  status ENUM('active', 'completed', 'draft', 'archived') NOT NULL DEFAULT 'draft',
  sessions INT NOT NULL DEFAULT 1,
  sessions_completed INT NOT NULL DEFAULT 0,
  next_session DATE NULL,
  practitioner VARCHAR(255) NULL,
  created_by CHAR(36) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  KEY idx_treatment_plan_clinic (clinic_id),
  CONSTRAINT fk_treatment_plan_clinic FOREIGN KEY (clinic_id) REFERENCES clinic(id) ON DELETE RESTRICT,
  CONSTRAINT fk_treatment_plan_user FOREIGN KEY (created_by) REFERENCES user(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS treatment_plan_item (
  id CHAR(36) PRIMARY KEY,
  treatment_plan_id CHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_treatment_plan_item_plan (treatment_plan_id),
  CONSTRAINT fk_treatment_plan_item_plan FOREIGN KEY (treatment_plan_id) REFERENCES treatment_plan(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create table to persist per-clinic onboarding progress
CREATE TABLE IF NOT EXISTS onboarding_state (
  id CHAR(36) NOT NULL PRIMARY KEY,
  clinic_id CHAR(36) NOT NULL,
  data JSON NULL,
  created_by CHAR(36) NULL,
  completed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_onboarding_clinic (clinic_id),
  CONSTRAINT fk_onboarding_clinic FOREIGN KEY (clinic_id) REFERENCES clinic(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

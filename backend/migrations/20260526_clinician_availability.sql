CREATE TABLE IF NOT EXISTS clinician_availability (
  id CHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL PRIMARY KEY,
  clinic_id CHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  clinician_id CHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  day_of_week TINYINT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  slot_interval_minutes INT NOT NULL DEFAULT 30,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  UNIQUE KEY uq_clinician_availability_window (clinic_id, clinician_id, day_of_week, start_time, deleted_at),
  KEY idx_clinician_availability_lookup (clinic_id, clinician_id, day_of_week, is_active, deleted_at),
  CONSTRAINT fk_clinician_availability_clinic FOREIGN KEY (clinic_id) REFERENCES clinic(id) ON DELETE CASCADE,
  CONSTRAINT fk_clinician_availability_user FOREIGN KEY (clinician_id) REFERENCES user(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

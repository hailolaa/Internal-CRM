CREATE TABLE IF NOT EXISTS clinic_sla_setting (
  clinic_id CHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  target_minutes INT NOT NULL DEFAULT 5,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (clinic_id),
  CONSTRAINT fk_clinic_sla_setting_clinic FOREIGN KEY (clinic_id) REFERENCES clinic(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE contact
  ADD COLUMN sla_target_minutes INT NULL AFTER last_contact_at,
  ADD COLUMN sla_deadline_at DATETIME NULL AFTER sla_target_minutes,
  ADD COLUMN first_response_at DATETIME NULL AFTER sla_deadline_at,
  ADD COLUMN first_response_by CHAR(36) COLLATE utf8mb4_unicode_ci NULL AFTER first_response_at,
  ADD COLUMN sla_breached_at DATETIME NULL AFTER first_response_by,
  ADD KEY idx_contact_sla_queue (clinic_id, first_response_at, sla_deadline_at),
  ADD KEY idx_contact_first_response_by (first_response_by),
  ADD CONSTRAINT fk_contact_first_response_by FOREIGN KEY (first_response_by) REFERENCES user(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS sla_breach (
  id CHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  clinic_id CHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  contact_id CHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  target_minutes INT NOT NULL DEFAULT 5,
  deadline_at DATETIME NOT NULL,
  breached_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  first_response_at DATETIME NULL,
  status ENUM('open', 'resolved') NOT NULL DEFAULT 'open',
  resolved_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sla_breach_contact (contact_id),
  KEY idx_sla_breach_clinic_status (clinic_id, status, breached_at),
  CONSTRAINT fk_sla_breach_clinic FOREIGN KEY (clinic_id) REFERENCES clinic(id) ON DELETE CASCADE,
  CONSTRAINT fk_sla_breach_contact FOREIGN KEY (contact_id) REFERENCES contact(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO clinic_sla_setting (clinic_id, target_minutes)
SELECT id, 5
FROM clinic
WHERE deleted_at IS NULL;

UPDATE contact c
JOIN clinic_sla_setting s ON s.clinic_id = c.clinic_id
SET c.sla_target_minutes = COALESCE(c.sla_target_minutes, s.target_minutes),
    c.sla_deadline_at = COALESCE(c.sla_deadline_at, DATE_ADD(c.created_at, INTERVAL s.target_minutes MINUTE)),
    c.first_response_at = COALESCE(c.first_response_at, c.last_contact_at)
WHERE c.deleted_at IS NULL;

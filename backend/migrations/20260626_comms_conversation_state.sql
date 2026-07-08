CREATE TABLE IF NOT EXISTS comms_conversation_state (
  id CHAR(36) PRIMARY KEY,
  clinic_id CHAR(36) NOT NULL,
  contact_id CHAR(36) NOT NULL,
  starred TINYINT(1) NOT NULL DEFAULT 0,
  archived_at TIMESTAMP NULL,
  created_by CHAR(36) NULL,
  updated_by CHAR(36) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_comms_conversation_state_contact (clinic_id, contact_id),
  KEY idx_comms_conversation_state_filter (clinic_id, starred, archived_at),
  CONSTRAINT fk_comms_conversation_state_clinic FOREIGN KEY (clinic_id) REFERENCES clinic(id) ON DELETE RESTRICT,
  CONSTRAINT fk_comms_conversation_state_contact FOREIGN KEY (contact_id) REFERENCES contact(id) ON DELETE CASCADE,
  CONSTRAINT fk_comms_conversation_state_created_by FOREIGN KEY (created_by) REFERENCES user(id) ON DELETE SET NULL,
  CONSTRAINT fk_comms_conversation_state_updated_by FOREIGN KEY (updated_by) REFERENCES user(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

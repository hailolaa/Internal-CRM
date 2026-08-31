CREATE TABLE IF NOT EXISTS mission_control_integration_token (
  id CHAR(36) NOT NULL PRIMARY KEY,
  clinic_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  name VARCHAR(160) NOT NULL,
  subject VARCHAR(160) NOT NULL,
  token_id_hash CHAR(64) NOT NULL,
  issuer VARCHAR(160) NOT NULL,
  audience VARCHAR(160) NOT NULL,
  scopes JSON NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  last_used_at TIMESTAMP NULL DEFAULT NULL,
  revoked_at TIMESTAMP NULL DEFAULT NULL,
  created_by CHAR(36) NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_mission_control_integration_token_hash (token_id_hash),
  KEY idx_mission_control_integration_token_clinic (clinic_id, revoked_at, expires_at),
  KEY idx_mission_control_integration_token_user (user_id, revoked_at),
  CONSTRAINT fk_mc_integration_token_clinic
    FOREIGN KEY (clinic_id) REFERENCES clinic(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_mc_integration_token_user
    FOREIGN KEY (user_id) REFERENCES user(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_mc_integration_token_created_by
    FOREIGN KEY (created_by) REFERENCES user(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

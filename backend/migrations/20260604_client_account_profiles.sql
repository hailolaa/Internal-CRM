CREATE TABLE IF NOT EXISTS client_account_profile (
  id CHAR(36) NOT NULL PRIMARY KEY,
  clinic_id CHAR(36) NOT NULL,
  account_manager_id CHAR(36) NULL,
  active_services JSON NULL,
  onboarding_status ENUM('not_started', 'in_progress', 'completed', 'paused') NOT NULL DEFAULT 'not_started',
  health_status ENUM('healthy', 'attention_needed', 'at_risk', 'critical') NOT NULL DEFAULT 'attention_needed',
  churn_risk ENUM('low', 'medium', 'high', 'critical') NOT NULL DEFAULT 'low',
  renewal_date DATE NULL,
  contract_status ENUM('active', 'trial', 'pending', 'paused', 'cancelled', 'expired') NOT NULL DEFAULT 'pending',
  key_notes TEXT NULL,
  created_by CHAR(36) NULL,
  updated_by CHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_client_account_profile_clinic (clinic_id),
  KEY idx_client_account_profile_manager (account_manager_id),
  CONSTRAINT fk_client_account_profile_clinic FOREIGN KEY (clinic_id) REFERENCES clinic(id) ON DELETE CASCADE,
  CONSTRAINT fk_client_account_profile_manager FOREIGN KEY (account_manager_id) REFERENCES user(id) ON DELETE SET NULL,
  CONSTRAINT fk_client_account_profile_created_by FOREIGN KEY (created_by) REFERENCES user(id) ON DELETE SET NULL,
  CONSTRAINT fk_client_account_profile_updated_by FOREIGN KEY (updated_by) REFERENCES user(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO permission (id, key_name, description)
VALUES
  ('perm-client-accounts-read', 'client_accounts:read', 'Read internal client account profiles'),
  ('perm-client-accounts-write', 'client_accounts:write', 'Update internal client account profiles');

INSERT IGNORE INTO role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM role r
JOIN permission p ON p.key_name IN ('client_accounts:read', 'client_accounts:write')
WHERE r.name IN ('SUPER_ADMIN')
  AND r.deleted_at IS NULL;

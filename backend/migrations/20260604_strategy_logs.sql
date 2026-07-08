CREATE TABLE IF NOT EXISTS strategy_log (
  id CHAR(36) NOT NULL PRIMARY KEY,
  clinic_id CHAR(36) NOT NULL,
  client_account_profile_id CHAR(36) NOT NULL,
  log_month DATE NOT NULL,
  log_type ENUM('strategy', 'meeting') NOT NULL DEFAULT 'strategy',
  meeting_notes TEXT NULL,
  seo_plan TEXT NULL,
  ppc_plan TEXT NULL,
  landing_page_plan TEXT NULL,
  kpi_notes TEXT NULL,
  decisions TEXT NULL,
  next_actions TEXT NULL,
  owner_id CHAR(36) NULL,
  created_by CHAR(36) NULL,
  updated_by CHAR(36) NULL,
  archived_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_strategy_log_clinic (clinic_id),
  KEY idx_strategy_log_profile (client_account_profile_id),
  KEY idx_strategy_log_owner (owner_id),
  KEY idx_strategy_log_filter (clinic_id, client_account_profile_id, log_month, owner_id, log_type, archived_at),
  CONSTRAINT fk_strategy_log_clinic FOREIGN KEY (clinic_id) REFERENCES clinic(id) ON DELETE CASCADE,
  CONSTRAINT fk_strategy_log_profile FOREIGN KEY (client_account_profile_id) REFERENCES client_account_profile(id) ON DELETE CASCADE,
  CONSTRAINT fk_strategy_log_owner FOREIGN KEY (owner_id) REFERENCES user(id) ON DELETE SET NULL,
  CONSTRAINT fk_strategy_log_created_by FOREIGN KEY (created_by) REFERENCES user(id) ON DELETE SET NULL,
  CONSTRAINT fk_strategy_log_updated_by FOREIGN KEY (updated_by) REFERENCES user(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO permission (id, key_name, description)
VALUES
  ('perm-strategy-logs-read', 'strategy_logs:read', 'Read internal client strategy logs'),
  ('perm-strategy-logs-write', 'strategy_logs:write', 'Create and update internal client strategy logs');

INSERT IGNORE INTO role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM role r
JOIN permission p ON p.key_name IN ('strategy_logs:read', 'strategy_logs:write')
WHERE r.name IN ('SUPER_ADMIN')
  AND r.deleted_at IS NULL;

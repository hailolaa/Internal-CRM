ALTER TABLE task
  ADD COLUMN is_internal TINYINT(1) NOT NULL DEFAULT 0 AFTER clinic_id,
  ADD COLUMN board_key VARCHAR(100) NULL AFTER category,
  ADD COLUMN service_type ENUM('ppc', 'seo', 'gbp', 'website', 'landing_pages', 'cro', 'strategy', 'other') NULL AFTER board_key,
  ADD COLUMN client_account_profile_id CHAR(36) NULL AFTER service_type,
  ADD COLUMN client_account_service_id CHAR(36) NULL AFTER client_account_profile_id,
  ADD COLUMN assigned_user_id CHAR(36) NULL AFTER assigned_to,
  ADD COLUMN proof_reference VARCHAR(500) NULL AFTER assigned_user_id,
  ADD COLUMN workflow_month DATE NULL AFTER proof_reference,
  ADD COLUMN template_key VARCHAR(150) NULL AFTER workflow_month,
  ADD COLUMN recurrence_rule JSON NULL AFTER template_key,
  ADD COLUMN completed_at TIMESTAMP NULL AFTER recurrence_rule,
  ADD COLUMN archived_at TIMESTAMP NULL AFTER completed_at,
  ADD KEY idx_task_internal_board (clinic_id, is_internal, board_key, status, archived_at),
  ADD KEY idx_task_internal_due (clinic_id, is_internal, due_date, status, archived_at),
  ADD KEY idx_task_client_account (client_account_profile_id),
  ADD KEY idx_task_client_service (client_account_service_id),
  ADD KEY idx_task_assigned_user (assigned_user_id),
  ADD CONSTRAINT fk_task_client_account_profile FOREIGN KEY (client_account_profile_id) REFERENCES client_account_profile(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_task_client_account_service FOREIGN KEY (client_account_service_id) REFERENCES client_account_service(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_task_assigned_user FOREIGN KEY (assigned_user_id) REFERENCES user(id) ON DELETE SET NULL;

INSERT IGNORE INTO permission (id, key_name, description)
VALUES
  ('perm-internal-tasks-read', 'internal_tasks:read', 'Read The Growth Group internal delivery tasks'),
  ('perm-internal-tasks-write', 'internal_tasks:write', 'Create and update The Growth Group internal delivery tasks');

INSERT IGNORE INTO role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM role r
JOIN permission p ON p.key_name IN ('internal_tasks:read', 'internal_tasks:write')
WHERE r.name IN ('SUPER_ADMIN')
  AND r.deleted_at IS NULL;

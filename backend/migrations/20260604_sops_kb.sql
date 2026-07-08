ALTER TABLE sop ADD INDEX idx_sop_search (clinic_id, status, category, deleted_at);

INSERT IGNORE INTO permission (id, key_name, description)
VALUES
  ('perm-sops-read', 'sops:read', 'Read internal SOPs'),
  ('perm-sops-write', 'sops:write', 'Create and update internal SOPs');

INSERT IGNORE INTO role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM role r
JOIN permission p ON p.key_name IN ('sops:read', 'sops:write')
WHERE r.name IN ('SUPER_ADMIN')
  AND r.deleted_at IS NULL;

INSERT IGNORE INTO role (id, clinic_id, name, display_name, description, is_system)
VALUES
  ('role-read-only', NULL, 'READ_ONLY', 'Read Only', 'Read-only clinic access for reporting and reference data', 1);

INSERT IGNORE INTO role_permission (role_id, permission_id)
SELECT 'role-read-only', id
FROM permission
WHERE key_name IN (
  'contacts:read',
  'appointments:read',
  'reports:read',
  'settings:read',
  'team:read',
  'billing:read',
  'calls:read',
  'events:read',
  'marketing:read',
  'audit:read',
  'webhooks:read'
);

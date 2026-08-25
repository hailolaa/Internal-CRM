INSERT IGNORE INTO `permission` (`id`, `key_name`, `description`, `created_at`, `updated_at`)
VALUES
  ('perm-mission-control-api-read', 'mission_control_api:read', 'Read Mission Control API v1 endpoints', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perm-mission-control-mcp-read', 'mission_control_mcp:read', 'Read Mission Control MCP tools', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT IGNORE INTO `role_permission` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `role` r
JOIN `permission` p
  ON p.key_name IN ('mission_control_api:read', 'mission_control_mcp:read')
WHERE r.name IN ('ADMIN', 'SUPER_ADMIN');

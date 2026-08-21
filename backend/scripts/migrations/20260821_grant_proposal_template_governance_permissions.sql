INSERT IGNORE INTO `role_permission` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `role` r
JOIN `permission` p
  ON p.key_name IN ('proposal_templates:write', 'proposal_templates:approve')
WHERE r.name IN ('SUPER_ADMIN', 'ADMIN');

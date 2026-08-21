SET @schema_name := DATABASE();

INSERT IGNORE INTO `permission` (`id`, `key_name`, `description`)
VALUES
  ('perm-proposal-templates-write', 'proposal_templates:write', 'Create and update proposal template drafts'),
  ('perm-proposal-templates-approve', 'proposal_templates:approve', 'Approve, publish and roll back proposal template versions');

CREATE TABLE IF NOT EXISTS `proposal_template_version` (
  `id` CHAR(36) NOT NULL,
  `clinic_id` CHAR(36) NOT NULL,
  `template_id` CHAR(36) NOT NULL,
  `template_key` VARCHAR(100) NOT NULL,
  `version_number` INT NOT NULL,
  `content` JSON NOT NULL,
  `content_hash` CHAR(64) NOT NULL,
  `status` ENUM('draft','in_review','approved','published','rejected','superseded') NOT NULL DEFAULT 'draft',
  `source_version_id` CHAR(36) DEFAULT NULL,
  `created_by` CHAR(36) DEFAULT NULL,
  `submitted_by` CHAR(36) DEFAULT NULL,
  `approved_by` CHAR(36) DEFAULT NULL,
  `rejected_by` CHAR(36) DEFAULT NULL,
  `published_by` CHAR(36) DEFAULT NULL,
  `superseded_by_version_id` CHAR(36) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `submitted_at` DATETIME DEFAULT NULL,
  `approved_at` DATETIME DEFAULT NULL,
  `rejected_at` DATETIME DEFAULT NULL,
  `published_at` DATETIME DEFAULT NULL,
  `superseded_at` DATETIME DEFAULT NULL,
  `rejection_reason` TEXT DEFAULT NULL,
  `change_summary` TEXT DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_proposal_template_version_number` (`clinic_id`, `template_key`, `version_number`),
  KEY `idx_proposal_template_version_template` (`clinic_id`, `template_id`, `status`, `version_number`),
  KEY `idx_proposal_template_version_published` (`clinic_id`, `template_key`, `status`, `published_at`),
  KEY `fk_proposal_template_version_source` (`source_version_id`),
  CONSTRAINT `fk_proposal_template_version_template` FOREIGN KEY (`template_id`) REFERENCES `proposal_template` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_proposal_template_version_clinic` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_proposal_template_version_source` FOREIGN KEY (`source_version_id`) REFERENCES `proposal_template_version` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @proposal_template_version_id_sql := (
  SELECT CASE
    WHEN COUNT(*) = 0 THEN 'ALTER TABLE `proposal` ADD COLUMN `template_id` CHAR(36) DEFAULT NULL AFTER `template_key`'
    ELSE 'SELECT ''proposal.template_id already exists'' AS migration_note'
  END
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'proposal'
    AND COLUMN_NAME = 'template_id'
);
PREPARE proposal_template_id_stmt FROM @proposal_template_version_id_sql;
EXECUTE proposal_template_id_stmt;
DEALLOCATE PREPARE proposal_template_id_stmt;

SET @proposal_template_version_id_sql := (
  SELECT CASE
    WHEN COUNT(*) = 0 THEN 'ALTER TABLE `proposal` ADD COLUMN `template_version_id` CHAR(36) DEFAULT NULL AFTER `template_key`'
    ELSE 'SELECT ''proposal.template_version_id already exists'' AS migration_note'
  END
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'proposal'
    AND COLUMN_NAME = 'template_version_id'
);
PREPARE proposal_template_version_id_stmt FROM @proposal_template_version_id_sql;
EXECUTE proposal_template_version_id_stmt;
DEALLOCATE PREPARE proposal_template_version_id_stmt;

SET @proposal_template_version_position_sql := (
  SELECT CASE
    WHEN COUNT(*) > 0 THEN 'ALTER TABLE `proposal` MODIFY COLUMN `template_version_id` CHAR(36) DEFAULT NULL AFTER `template_id`'
    ELSE 'SELECT ''proposal.template_version_id not present for positioning'' AS migration_note'
  END
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'proposal'
    AND COLUMN_NAME = 'template_version_id'
);
PREPARE proposal_template_version_position_stmt FROM @proposal_template_version_position_sql;
EXECUTE proposal_template_version_position_stmt;
DEALLOCATE PREPARE proposal_template_version_position_stmt;

SET @proposal_template_version_number_sql := (
  SELECT CASE
    WHEN COUNT(*) = 0 THEN 'ALTER TABLE `proposal` ADD COLUMN `template_version_number` INT DEFAULT NULL AFTER `template_version_id`'
    ELSE 'SELECT ''proposal.template_version_number already exists'' AS migration_note'
  END
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'proposal'
    AND COLUMN_NAME = 'template_version_number'
);
PREPARE proposal_template_version_number_stmt FROM @proposal_template_version_number_sql;
EXECUTE proposal_template_version_number_stmt;
DEALLOCATE PREPARE proposal_template_version_number_stmt;

SET @proposal_template_content_hash_sql := (
  SELECT CASE
    WHEN COUNT(*) = 0 THEN 'ALTER TABLE `proposal` ADD COLUMN `template_content_hash` CHAR(64) DEFAULT NULL AFTER `template_version_number`'
    ELSE 'SELECT ''proposal.template_content_hash already exists'' AS migration_note'
  END
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'proposal'
    AND COLUMN_NAME = 'template_content_hash'
);
PREPARE proposal_template_content_hash_stmt FROM @proposal_template_content_hash_sql;
EXECUTE proposal_template_content_hash_stmt;
DEALLOCATE PREPARE proposal_template_content_hash_stmt;

SET @proposal_template_version_index_sql := (
  SELECT CASE
    WHEN COUNT(*) = 0 THEN 'ALTER TABLE `proposal` ADD INDEX `idx_proposal_template_version` (`clinic_id`, `template_version_id`)'
    ELSE 'SELECT ''idx_proposal_template_version already exists'' AS migration_note'
  END
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'proposal'
    AND INDEX_NAME = 'idx_proposal_template_version'
);
PREPARE proposal_template_version_index_stmt FROM @proposal_template_version_index_sql;
EXECUTE proposal_template_version_index_stmt;
DEALLOCATE PREPARE proposal_template_version_index_stmt;

INSERT IGNORE INTO `proposal_template`
  (`id`, `clinic_id`, `template_key`, `name`, `description`, `package_name`, `default_sections`,
   `default_roadmap`, `default_terms`, `default_success_metrics`, `sort_order`, `is_active`)
SELECT
  UUID(),
  source.`clinic_id`,
  'clinicgrower_v5',
  source.`name`,
  source.`description`,
  source.`package_name`,
  source.`default_sections`,
  source.`default_roadmap`,
  source.`default_terms`,
  source.`default_success_metrics`,
  source.`sort_order`,
  source.`is_active`
FROM `proposal_template` source
WHERE source.`template_key` = 'clinicgrower_standard';

INSERT INTO `proposal_template_version`
  (`id`, `clinic_id`, `template_id`, `template_key`, `version_number`, `content`, `content_hash`, `status`,
   `created_by`, `submitted_by`, `approved_by`, `published_by`, `submitted_at`, `approved_at`, `published_at`,
   `change_summary`)
SELECT
  UUID(),
  pt.`clinic_id`,
  pt.`id`,
  pt.`template_key`,
  1,
  JSON_OBJECT(
    'name', pt.`name`,
    'description', pt.`description`,
    'packageName', pt.`package_name`,
    'defaultSections', COALESCE(pt.`default_sections`, JSON_OBJECT()),
    'defaultRoadmap', COALESCE(pt.`default_roadmap`, JSON_ARRAY()),
    'defaultTerms', pt.`default_terms`,
    'defaultSuccessMetrics', COALESCE(pt.`default_success_metrics`, JSON_ARRAY()),
    'editablePolicyVersion', 'proposal-template-fields-2026-08-21',
    'lockedFields', JSON_ARRAY('packageName', 'defaultTerms', 'defaultScopeItems', 'packageCatalogue', 'proofAssets', 'crmClientData')
  ),
  SHA2(CAST(JSON_OBJECT(
    'name', pt.`name`,
    'description', pt.`description`,
    'packageName', pt.`package_name`,
    'defaultSections', COALESCE(pt.`default_sections`, JSON_OBJECT()),
    'defaultRoadmap', COALESCE(pt.`default_roadmap`, JSON_ARRAY()),
    'defaultTerms', pt.`default_terms`,
    'defaultSuccessMetrics', COALESCE(pt.`default_success_metrics`, JSON_ARRAY()),
    'editablePolicyVersion', 'proposal-template-fields-2026-08-21',
    'lockedFields', JSON_ARRAY('packageName', 'defaultTerms', 'defaultScopeItems', 'packageCatalogue', 'proofAssets', 'crmClientData')
  ) AS CHAR), 256),
  'published',
  NULL,
  NULL,
  NULL,
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  'Initial published version migrated from the existing proposal template library.'
FROM `proposal_template` pt
WHERE NOT EXISTS (
  SELECT 1
  FROM `proposal_template_version` existing
  WHERE existing.`clinic_id` = pt.`clinic_id`
    AND existing.`template_key` = pt.`template_key`
    AND existing.`version_number` = 1
);

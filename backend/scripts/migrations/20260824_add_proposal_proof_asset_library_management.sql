SET @proposal_proof_asset_version_sql := (
  SELECT CASE
    WHEN COUNT(*) = 0 THEN 'ALTER TABLE `proposal_proof_asset` ADD COLUMN `version` INT NOT NULL DEFAULT 1 AFTER `is_active`'
    ELSE 'SELECT ''proposal_proof_asset.version already exists'' AS migration_note'
  END
  FROM `INFORMATION_SCHEMA`.`COLUMNS`
  WHERE `TABLE_SCHEMA` = DATABASE()
    AND `TABLE_NAME` = 'proposal_proof_asset'
    AND `COLUMN_NAME` = 'version'
);
PREPARE proposal_proof_asset_version_stmt FROM @proposal_proof_asset_version_sql;
EXECUTE proposal_proof_asset_version_stmt;
DEALLOCATE PREPARE proposal_proof_asset_version_stmt;

SET @proposal_proof_asset_archived_sql := (
  SELECT CASE
    WHEN COUNT(*) = 0 THEN 'ALTER TABLE `proposal_proof_asset` ADD COLUMN `archived_at` DATETIME NULL AFTER `updated_by`'
    ELSE 'SELECT ''proposal_proof_asset.archived_at already exists'' AS migration_note'
  END
  FROM `INFORMATION_SCHEMA`.`COLUMNS`
  WHERE `TABLE_SCHEMA` = DATABASE()
    AND `TABLE_NAME` = 'proposal_proof_asset'
    AND `COLUMN_NAME` = 'archived_at'
);
PREPARE proposal_proof_asset_archived_stmt FROM @proposal_proof_asset_archived_sql;
EXECUTE proposal_proof_asset_archived_stmt;
DEALLOCATE PREPARE proposal_proof_asset_archived_stmt;

UPDATE `proposal_proof_asset`
SET `archived_at` = CASE WHEN `is_active` = 0 AND `archived_at` IS NULL THEN `updated_at` ELSE `archived_at` END
WHERE `deleted_at` IS NULL;

SET @proposal_proof_asset_search_index_sql := (
  SELECT CASE
    WHEN COUNT(*) = 0 THEN 'ALTER TABLE `proposal_proof_asset` ADD INDEX `idx_proposal_proof_asset_status_search` (`clinic_id`, `is_active`, `type`, `sort_order`)'
    ELSE 'SELECT ''idx_proposal_proof_asset_status_search already exists'' AS migration_note'
  END
  FROM `INFORMATION_SCHEMA`.`STATISTICS`
  WHERE `TABLE_SCHEMA` = DATABASE()
    AND `TABLE_NAME` = 'proposal_proof_asset'
    AND `INDEX_NAME` = 'idx_proposal_proof_asset_status_search'
);
PREPARE proposal_proof_asset_search_index_stmt FROM @proposal_proof_asset_search_index_sql;
EXECUTE proposal_proof_asset_search_index_stmt;
DEALLOCATE PREPARE proposal_proof_asset_search_index_stmt;

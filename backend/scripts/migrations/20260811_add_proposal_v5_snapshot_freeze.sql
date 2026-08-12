SET @schema_name = DATABASE();

SET @proposal_v5_snapshot_sql := (
  SELECT CASE
    WHEN COUNT(*) = 0 THEN 'ALTER TABLE `proposal` ADD COLUMN `v5_snapshot` JSON DEFAULT NULL AFTER `core_data`'
    ELSE 'SELECT ''proposal.v5_snapshot already exists'' AS migration_note'
  END
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'proposal'
    AND COLUMN_NAME = 'v5_snapshot'
);
PREPARE proposal_v5_snapshot_stmt FROM @proposal_v5_snapshot_sql;
EXECUTE proposal_v5_snapshot_stmt;
DEALLOCATE PREPARE proposal_v5_snapshot_stmt;

SET @proposal_v5_snapshot_hash_sql := (
  SELECT CASE
    WHEN COUNT(*) = 0 THEN 'ALTER TABLE `proposal` ADD COLUMN `v5_snapshot_hash` CHAR(64) DEFAULT NULL AFTER `v5_snapshot`'
    ELSE 'SELECT ''proposal.v5_snapshot_hash already exists'' AS migration_note'
  END
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'proposal'
    AND COLUMN_NAME = 'v5_snapshot_hash'
);
PREPARE proposal_v5_snapshot_hash_stmt FROM @proposal_v5_snapshot_hash_sql;
EXECUTE proposal_v5_snapshot_hash_stmt;
DEALLOCATE PREPARE proposal_v5_snapshot_hash_stmt;

SET @proposal_v5_snapshot_version_sql := (
  SELECT CASE
    WHEN COUNT(*) = 0 THEN 'ALTER TABLE `proposal` ADD COLUMN `v5_snapshot_version` VARCHAR(100) DEFAULT NULL AFTER `v5_snapshot_hash`'
    ELSE 'SELECT ''proposal.v5_snapshot_version already exists'' AS migration_note'
  END
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'proposal'
    AND COLUMN_NAME = 'v5_snapshot_version'
);
PREPARE proposal_v5_snapshot_version_stmt FROM @proposal_v5_snapshot_version_sql;
EXECUTE proposal_v5_snapshot_version_stmt;
DEALLOCATE PREPARE proposal_v5_snapshot_version_stmt;

SET @proposal_v5_snapshot_frozen_sql := (
  SELECT CASE
    WHEN COUNT(*) = 0 THEN 'ALTER TABLE `proposal` ADD COLUMN `v5_snapshot_frozen_at` DATETIME DEFAULT NULL AFTER `v5_snapshot_version`'
    ELSE 'SELECT ''proposal.v5_snapshot_frozen_at already exists'' AS migration_note'
  END
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'proposal'
    AND COLUMN_NAME = 'v5_snapshot_frozen_at'
);
PREPARE proposal_v5_snapshot_frozen_stmt FROM @proposal_v5_snapshot_frozen_sql;
EXECUTE proposal_v5_snapshot_frozen_stmt;
DEALLOCATE PREPARE proposal_v5_snapshot_frozen_stmt;

SET @acceptance_v5_snapshot_sql := (
  SELECT CASE
    WHEN COUNT(*) = 0 THEN 'ALTER TABLE `proposal_acceptance_record` ADD COLUMN `v5_snapshot` JSON DEFAULT NULL AFTER `core_data_snapshot`'
    ELSE 'SELECT ''proposal_acceptance_record.v5_snapshot already exists'' AS migration_note'
  END
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'proposal_acceptance_record'
    AND COLUMN_NAME = 'v5_snapshot'
);
PREPARE acceptance_v5_snapshot_stmt FROM @acceptance_v5_snapshot_sql;
EXECUTE acceptance_v5_snapshot_stmt;
DEALLOCATE PREPARE acceptance_v5_snapshot_stmt;

SET @acceptance_v5_snapshot_hash_sql := (
  SELECT CASE
    WHEN COUNT(*) = 0 THEN 'ALTER TABLE `proposal_acceptance_record` ADD COLUMN `v5_snapshot_hash` CHAR(64) DEFAULT NULL AFTER `v5_snapshot`'
    ELSE 'SELECT ''proposal_acceptance_record.v5_snapshot_hash already exists'' AS migration_note'
  END
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'proposal_acceptance_record'
    AND COLUMN_NAME = 'v5_snapshot_hash'
);
PREPARE acceptance_v5_snapshot_hash_stmt FROM @acceptance_v5_snapshot_hash_sql;
EXECUTE acceptance_v5_snapshot_hash_stmt;
DEALLOCATE PREPARE acceptance_v5_snapshot_hash_stmt;

SET @acceptance_v5_snapshot_version_sql := (
  SELECT CASE
    WHEN COUNT(*) = 0 THEN 'ALTER TABLE `proposal_acceptance_record` ADD COLUMN `v5_snapshot_version` VARCHAR(100) DEFAULT NULL AFTER `v5_snapshot_hash`'
    ELSE 'SELECT ''proposal_acceptance_record.v5_snapshot_version already exists'' AS migration_note'
  END
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'proposal_acceptance_record'
    AND COLUMN_NAME = 'v5_snapshot_version'
);
PREPARE acceptance_v5_snapshot_version_stmt FROM @acceptance_v5_snapshot_version_sql;
EXECUTE acceptance_v5_snapshot_version_stmt;
DEALLOCATE PREPARE acceptance_v5_snapshot_version_stmt;

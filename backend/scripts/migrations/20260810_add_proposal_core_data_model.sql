SET @schema_name = DATABASE();

SET @proposal_core_data_sql := (
  SELECT CASE
    WHEN COUNT(*) = 0 THEN 'ALTER TABLE `proposal` ADD COLUMN `core_data` JSON DEFAULT NULL AFTER `section_content`'
    ELSE 'SELECT ''proposal.core_data already exists'' AS migration_note'
  END
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'proposal'
    AND COLUMN_NAME = 'core_data'
);
PREPARE proposal_core_data_stmt FROM @proposal_core_data_sql;
EXECUTE proposal_core_data_stmt;
DEALLOCATE PREPARE proposal_core_data_stmt;

SET @proposal_acceptance_core_data_sql := (
  SELECT CASE
    WHEN COUNT(*) = 0 THEN 'ALTER TABLE `proposal_acceptance_record` ADD COLUMN `core_data_snapshot` JSON DEFAULT NULL AFTER `proposal_snapshot`'
    ELSE 'SELECT ''proposal_acceptance_record.core_data_snapshot already exists'' AS migration_note'
  END
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'proposal_acceptance_record'
    AND COLUMN_NAME = 'core_data_snapshot'
);
PREPARE proposal_acceptance_core_data_stmt FROM @proposal_acceptance_core_data_sql;
EXECUTE proposal_acceptance_core_data_stmt;
DEALLOCATE PREPARE proposal_acceptance_core_data_stmt;

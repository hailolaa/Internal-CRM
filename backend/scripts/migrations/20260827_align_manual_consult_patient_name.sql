SET @manual_consult_has_prospect_name = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'manual_consult_entry'
    AND COLUMN_NAME = 'prospect_name'
);

SET @manual_consult_has_patient_name = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'manual_consult_entry'
    AND COLUMN_NAME = 'patient_name'
);

SET @manual_consult_patient_name_sql = IF(
  @manual_consult_has_prospect_name = 1 AND @manual_consult_has_patient_name = 0,
  'ALTER TABLE `manual_consult_entry` CHANGE COLUMN `prospect_name` `patient_name` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL',
  'SELECT 1'
);

PREPARE manual_consult_patient_name_statement FROM @manual_consult_patient_name_sql;
EXECUTE manual_consult_patient_name_statement;
DEALLOCATE PREPARE manual_consult_patient_name_statement;

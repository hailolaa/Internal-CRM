SET @proposal_proof_asset_type_sql := (
  SELECT CASE
    WHEN COUNT(*) = 0 THEN 'SELECT ''proposal_proof_asset.type does not exist yet'' AS migration_note'
    WHEN MAX(`COLUMN_TYPE`) LIKE '%''product_screenshot''%' THEN 'SELECT ''proposal_proof_asset.type already supports product_screenshot'' AS migration_note'
    ELSE 'ALTER TABLE `proposal_proof_asset` MODIFY COLUMN `type` ENUM(''award'',''testimonial'',''testimonial_video'',''case_study'',''client_logo'',''performance_result'',''product_screenshot'',''team_image'') NOT NULL'
  END
  FROM `INFORMATION_SCHEMA`.`COLUMNS`
  WHERE `TABLE_SCHEMA` = DATABASE()
    AND `TABLE_NAME` = 'proposal_proof_asset'
    AND `COLUMN_NAME` = 'type'
);

PREPARE proposal_proof_asset_type_stmt FROM @proposal_proof_asset_type_sql;
EXECUTE proposal_proof_asset_type_stmt;
DEALLOCATE PREPARE proposal_proof_asset_type_stmt;

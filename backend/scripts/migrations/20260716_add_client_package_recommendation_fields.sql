SET @schema_name = DATABASE();

SET @add_recommended_next_package = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'client_account_profile' AND COLUMN_NAME = 'recommended_next_package') = 0,
  'ALTER TABLE `client_account_profile` ADD COLUMN `recommended_next_package` VARCHAR(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `current_package`',
  'SELECT ''client_account_profile.recommended_next_package already exists'' AS message'
);
PREPARE stmt FROM @add_recommended_next_package;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_upsell_opportunity = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'client_account_profile' AND COLUMN_NAME = 'upsell_opportunity') = 0,
  'ALTER TABLE `client_account_profile` ADD COLUMN `upsell_opportunity` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `recommended_next_package`',
  'SELECT ''client_account_profile.upsell_opportunity already exists'' AS message'
);
PREPARE stmt FROM @add_upsell_opportunity;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_package_recommendation_index = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'client_account_profile' AND INDEX_NAME = 'idx_client_account_profile_package_next') = 0,
  'ALTER TABLE `client_account_profile` ADD INDEX `idx_client_account_profile_package_next` (`clinic_id`, `recommended_next_package`)',
  'SELECT ''idx_client_account_profile_package_next already exists'' AS message'
);
PREPARE stmt FROM @add_package_recommendation_index;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @schema_name = DATABASE();

SET @add_first_source = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contact' AND COLUMN_NAME = 'first_source') = 0,
  'ALTER TABLE `contact` ADD COLUMN `first_source` VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `source`',
  'SELECT ''contact.first_source already exists'' AS message'
);
PREPARE stmt FROM @add_first_source;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_latest_source = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contact' AND COLUMN_NAME = 'latest_source') = 0,
  'ALTER TABLE `contact` ADD COLUMN `latest_source` VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `first_source`',
  'SELECT ''contact.latest_source already exists'' AS message'
);
PREPARE stmt FROM @add_latest_source;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_converting_source = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contact' AND COLUMN_NAME = 'converting_source') = 0,
  'ALTER TABLE `contact` ADD COLUMN `converting_source` VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `latest_source`',
  'SELECT ''contact.converting_source already exists'' AS message'
);
PREPARE stmt FROM @add_converting_source;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_utm_source = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contact' AND COLUMN_NAME = 'utm_source') = 0,
  'ALTER TABLE `contact` ADD COLUMN `utm_source` VARCHAR(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `converting_source`',
  'SELECT ''contact.utm_source already exists'' AS message'
);
PREPARE stmt FROM @add_utm_source;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_utm_medium = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contact' AND COLUMN_NAME = 'utm_medium') = 0,
  'ALTER TABLE `contact` ADD COLUMN `utm_medium` VARCHAR(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `utm_source`',
  'SELECT ''contact.utm_medium already exists'' AS message'
);
PREPARE stmt FROM @add_utm_medium;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_utm_campaign = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contact' AND COLUMN_NAME = 'utm_campaign') = 0,
  'ALTER TABLE `contact` ADD COLUMN `utm_campaign` VARCHAR(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `utm_medium`',
  'SELECT ''contact.utm_campaign already exists'' AS message'
);
PREPARE stmt FROM @add_utm_campaign;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_utm_content = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contact' AND COLUMN_NAME = 'utm_content') = 0,
  'ALTER TABLE `contact` ADD COLUMN `utm_content` VARCHAR(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `utm_campaign`',
  'SELECT ''contact.utm_content already exists'' AS message'
);
PREPARE stmt FROM @add_utm_content;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_utm_term = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contact' AND COLUMN_NAME = 'utm_term') = 0,
  'ALTER TABLE `contact` ADD COLUMN `utm_term` VARCHAR(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `utm_content`',
  'SELECT ''contact.utm_term already exists'' AS message'
);
PREPARE stmt FROM @add_utm_term;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_landing_page = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contact' AND COLUMN_NAME = 'landing_page') = 0,
  'ALTER TABLE `contact` ADD COLUMN `landing_page` VARCHAR(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `utm_term`',
  'SELECT ''contact.landing_page already exists'' AS message'
);
PREPARE stmt FROM @add_landing_page;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_referrer = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contact' AND COLUMN_NAME = 'referrer') = 0,
  'ALTER TABLE `contact` ADD COLUMN `referrer` VARCHAR(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `landing_page`',
  'SELECT ''contact.referrer already exists'' AS message'
);
PREPARE stmt FROM @add_referrer;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_form_submitted = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contact' AND COLUMN_NAME = 'form_submitted') = 0,
  'ALTER TABLE `contact` ADD COLUMN `form_submitted` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `referrer`',
  'SELECT ''contact.form_submitted already exists'' AS message'
);
PREPARE stmt FROM @add_form_submitted;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_page_submitted = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contact' AND COLUMN_NAME = 'page_submitted') = 0,
  'ALTER TABLE `contact` ADD COLUMN `page_submitted` VARCHAR(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `form_submitted`',
  'SELECT ''contact.page_submitted already exists'' AS message'
);
PREPARE stmt FROM @add_page_submitted;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_cta_clicked = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contact' AND COLUMN_NAME = 'cta_clicked') = 0,
  'ALTER TABLE `contact` ADD COLUMN `cta_clicked` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `page_submitted`',
  'SELECT ''contact.cta_clicked already exists'' AS message'
);
PREPARE stmt FROM @add_cta_clicked;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_gclid = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contact' AND COLUMN_NAME = 'gclid') = 0,
  'ALTER TABLE `contact` ADD COLUMN `gclid` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `cta_clicked`',
  'SELECT ''contact.gclid already exists'' AS message'
);
PREPARE stmt FROM @add_gclid;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_fbclid = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contact' AND COLUMN_NAME = 'fbclid') = 0,
  'ALTER TABLE `contact` ADD COLUMN `fbclid` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `gclid`',
  'SELECT ''contact.fbclid already exists'' AS message'
);
PREPARE stmt FROM @add_fbclid;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_msclkid = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contact' AND COLUMN_NAME = 'msclkid') = 0,
  'ALTER TABLE `contact` ADD COLUMN `msclkid` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `fbclid`',
  'SELECT ''contact.msclkid already exists'' AS message'
);
PREPARE stmt FROM @add_msclkid;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_ttclid = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contact' AND COLUMN_NAME = 'ttclid') = 0,
  'ALTER TABLE `contact` ADD COLUMN `ttclid` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `msclkid`',
  'SELECT ''contact.ttclid already exists'' AS message'
);
PREPARE stmt FROM @add_ttclid;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_gbraid = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contact' AND COLUMN_NAME = 'gbraid') = 0,
  'ALTER TABLE `contact` ADD COLUMN `gbraid` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `ttclid`',
  'SELECT ''contact.gbraid already exists'' AS message'
);
PREPARE stmt FROM @add_gbraid;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_wbraid = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contact' AND COLUMN_NAME = 'wbraid') = 0,
  'ALTER TABLE `contact` ADD COLUMN `wbraid` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `gbraid`',
  'SELECT ''contact.wbraid already exists'' AS message'
);
PREPARE stmt FROM @add_wbraid;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_source_index = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contact' AND INDEX_NAME = 'idx_contact_attribution_sources') = 0,
  'ALTER TABLE `contact` ADD INDEX `idx_contact_attribution_sources` (`clinic_id`, `first_source`, `latest_source`, `converting_source`)',
  'SELECT ''idx_contact_attribution_sources already exists'' AS message'
);
PREPARE stmt FROM @add_source_index;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_utm_index = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contact' AND INDEX_NAME = 'idx_contact_attribution_utm') = 0,
  'ALTER TABLE `contact` ADD INDEX `idx_contact_attribution_utm` (`clinic_id`, `utm_source`, `utm_medium`, `utm_campaign`)',
  'SELECT ''idx_contact_attribution_utm already exists'' AS message'
);
PREPARE stmt FROM @add_utm_index;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_click_index = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contact' AND INDEX_NAME = 'idx_contact_attribution_click_ids') = 0,
  'ALTER TABLE `contact` ADD INDEX `idx_contact_attribution_click_ids` (`clinic_id`, `gclid`, `fbclid`, `msclkid`)',
  'SELECT ''idx_contact_attribution_click_ids already exists'' AS message'
);
PREPARE stmt FROM @add_click_index;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

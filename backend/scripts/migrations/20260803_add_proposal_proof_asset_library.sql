CREATE TABLE IF NOT EXISTS `proposal_proof_asset` (
  `id` CHAR(36) NOT NULL,
  `clinic_id` CHAR(36) NOT NULL,
  `type` ENUM('award','testimonial','testimonial_video','case_study','client_logo','performance_result','team_image') NOT NULL,
  `title` VARCHAR(180) NOT NULL,
  `copy` TEXT NOT NULL,
  `media_url` VARCHAR(1000) NULL,
  `sector_tags` JSON NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_by` CHAR(36) NULL,
  `updated_by` CHAR(36) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  KEY `idx_proposal_proof_asset_workspace` (`clinic_id`, `is_active`, `sort_order`),
  KEY `idx_proposal_proof_asset_type` (`clinic_id`, `type`, `is_active`),
  KEY `fk_proposal_proof_asset_created_by` (`created_by`),
  KEY `fk_proposal_proof_asset_updated_by` (`updated_by`),
  CONSTRAINT `fk_proposal_proof_asset_clinic` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_proposal_proof_asset_created_by` FOREIGN KEY (`created_by`) REFERENCES `user` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_proposal_proof_asset_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `proposal_proof_asset`
  (`id`, `clinic_id`, `type`, `title`, `copy`, `media_url`, `sector_tags`, `sort_order`)
SELECT UUID(), c.`id`, 'award', 'Aesthetics Awards recognition',
       'ClinicGrower can be positioned with sector-specific credibility and recognised growth expertise for clinics.',
       NULL,
       '["aesthetics","clinic growth","trust"]',
       10
FROM `clinic` c
UNION ALL
SELECT UUID(), c.`id`, 'performance_result', '50+ clinics supported',
       'ClinicGrower has public positioning around helping more than 50 clinics improve marketing visibility, enquiries and growth systems.',
       NULL,
       '["clinic growth","performance","social proof"]',
       20
FROM `clinic` c
UNION ALL
SELECT UUID(), c.`id`, 'testimonial', 'Clinic owner testimonial',
       'A clinic owner proof block can be selected here once the exact approved testimonial copy is confirmed.',
       NULL,
       '["testimonial","clinic owner"]',
       30
FROM `clinic` c
UNION ALL
SELECT UUID(), c.`id`, 'case_study', 'Booked-consultation growth case study',
       'Use this block for a short case study showing the starting point, the growth constraint, the work completed and the measurable result.',
       NULL,
       '["case study","booked consultations"]',
       40
FROM `clinic` c
UNION ALL
SELECT UUID(), c.`id`, 'testimonial_video', 'Proposal video proof',
       'Use this block for an approved testimonial or founder video that supports the commercial recommendation.',
       'https://vimeo.com/1008757315?fl=pl&fe=sh',
       '["video","proposal"]',
       50
FROM `clinic` c
UNION ALL
SELECT UUID(), c.`id`, 'client_logo', 'Client logo proof block',
       'Use this block to show an approved client logo or brand proof asset when the media URL is available.',
       NULL,
       '["logo","client proof"]',
       60
FROM `clinic` c
UNION ALL
SELECT UUID(), c.`id`, 'team_image', 'ClinicGrower team image',
       'Use this block for an approved team or founder image that makes the proposal feel more personal.',
       NULL,
       '["team","trust"]',
       70
FROM `clinic` c;

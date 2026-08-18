UPDATE `proposal_proof_asset`
SET
  `copy` = '"They have taken the time to help us drill down into the detail to optimise the right leads."',
  `media_url` = COALESCE(`media_url`, '/brand/proposal/v5-reference/tanja-testimonial.jpg')
WHERE `type` = 'testimonial'
  AND `title` = 'Permissioned clinic owner testimonial'
  AND `deleted_at` IS NULL;

INSERT INTO `proposal_proof_asset`
  (`id`, `clinic_id`, `type`, `title`, `copy`, `media_url`, `sector_tags`, `sort_order`)
SELECT UUID(), c.`id`, seed.`type`, seed.`title`, seed.`copy`, seed.`media_url`, seed.`sector_tags`, seed.`sort_order`
FROM `clinic` c
JOIN (
  SELECT
    'performance_result' AS `type`,
    'DREAMAMED +163%' AS `title`,
    'Lead conversions increased by 163%. Period not published.' AS `copy`,
    NULL AS `media_url`,
    JSON_ARRAY(
      'clinic',
      'dental',
      'aesthetic',
      'aesthetics',
      'dermatology',
      'skin',
      'cosmetic surgery',
      'surgery',
      'hair transplant',
      'wellness',
      'private gp',
      'medical spa',
      'cross-sector',
      'state:known',
      'proof-scope:Published cross-sector clinic evidence; not a ClinicGrower OS guarantee.',
      'source:ClinicGrower approved proof library',
      'timeframe:period not published',
      'disclaimer:Published clinic evidence is contextual and does not imply a guaranteed future result.'
    ) AS `sector_tags`,
    85 AS `sort_order`
  UNION ALL SELECT
    'performance_result',
    'MEDISKIN +205%',
    'Conversions increased by 205% between January and May 2024.',
    NULL,
    JSON_ARRAY(
      'clinic',
      'dental',
      'aesthetic',
      'aesthetics',
      'dermatology',
      'skin',
      'cosmetic surgery',
      'surgery',
      'hair transplant',
      'wellness',
      'private gp',
      'medical spa',
      'cross-sector',
      'state:known',
      'proof-scope:Published cross-sector clinic evidence; not a ClinicGrower OS guarantee.',
      'source:ClinicGrower approved proof library',
      'timeframe:Jan-May 2024',
      'disclaimer:Published clinic evidence is contextual and does not imply a guaranteed future result.'
    ),
    86
) seed
WHERE NOT EXISTS (
  SELECT 1
  FROM `proposal_proof_asset` existing
  WHERE existing.`clinic_id` = c.`id`
    AND existing.`type` = seed.`type`
    AND existing.`title` = seed.`title`
    AND existing.`deleted_at` IS NULL
);

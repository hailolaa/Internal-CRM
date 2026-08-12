UPDATE `proposal_proof_asset`
SET
  `title` = 'Aesthetics Awards 2025 Highly Commended',
  `copy` = 'ClinicGrower was Highly Commended at the Aesthetics Awards 2025. This is included as a credibility signal only and does not imply guaranteed future performance.',
  `media_url` = COALESCE(`media_url`, '/brand/proof/aesthetic-awards-highly-commended-2025.webp'),
  `sector_tags` = JSON_ARRAY(
    'aesthetic',
    'aesthetics',
    'clinic',
    'clinic growth',
    'state:known',
    'source:ClinicGrower proof library',
    'timeframe:2025',
    'disclaimer:Award recognition is a credibility signal, not a performance guarantee.'
  )
WHERE `type` = 'award'
  AND `title` IN ('Aesthetics Awards recognition', 'Aesthetics Awards 2025 Highly Commended');

UPDATE `proposal_proof_asset`
SET
  `copy` = 'ClinicGrower public proof references support for more than 50 clinics across managed marketing, enquiry visibility and growth-system work. This is context for credibility, not a guaranteed outcome.',
  `sector_tags` = JSON_ARRAY(
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
    'state:known',
    'proof-scope:Cross-sector ClinicGrower credibility proof; not a ClinicGrower OS guarantee.',
    'source:ClinicGrower public proof library',
    'timeframe:2026 public proof reference',
    'disclaimer:Historical proof is contextual and does not imply a guaranteed result.'
  )
WHERE `type` = 'performance_result'
  AND `title` = '50+ clinics supported';

UPDATE `proposal_proof_asset`
SET
  `title` = 'Permissioned clinic owner testimonial',
  `copy` = 'A permission-approved clinic owner testimonial can be used to support the recommendation where it matches the selected clinic context and accepted proof source.',
  `media_url` = COALESCE(`media_url`, '/brand/proof/tanja-phillips.webp'),
  `sector_tags` = JSON_ARRAY(
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
    'testimonial',
    'permission approved',
    'verified image',
    'state:known',
    'source:ClinicGrower approved testimonial library',
    'timeframe:Permissioned testimonial',
    'disclaimer:Named testimonial is used only where permission exists.'
  )
WHERE `type` = 'testimonial'
  AND `title` IN ('Clinic owner testimonial', 'Permissioned clinic owner testimonial');

UPDATE `proposal_proof_asset`
SET
  `copy` = 'A matched ClinicGrower case-study proof block showing the starting point, the commercial constraint, the work completed and the measured context. It is included for relevance and does not imply guaranteed future results.',
  `media_url` = COALESCE(`media_url`, '/brand/proposal/v5-reference/aesthetic_clinics/p17-img02-2400x1350.png'),
  `sector_tags` = JSON_ARRAY(
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
    'case study',
    'booked consultations',
    'state:known',
    'source:ClinicGrower approved case-study library',
    'timeframe:Documented delivery period',
    'disclaimer:Case-study evidence is contextual and does not imply a guaranteed outcome.'
  )
WHERE `type` = 'case_study'
  AND `title` = 'Booked-consultation growth case study';

UPDATE `proposal_proof_asset`
SET
  `copy` = 'Approved video proof supporting the commercial recommendation and the ClinicGrower OS operating-system narrative.',
  `sector_tags` = JSON_ARRAY(
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
    'video',
    'proposal',
    'testimonial video',
    'permission approved',
    'state:known',
    'source:ClinicGrower approved video library',
    'timeframe:Permissioned video asset',
    'disclaimer:Video proof is contextual and is not a guaranteed outcome.'
  )
WHERE `type` = 'testimonial_video'
  AND `title` = 'Proposal video proof';

INSERT INTO `proposal_proof_asset`
  (`id`, `clinic_id`, `type`, `title`, `copy`, `media_url`, `sector_tags`, `sort_order`)
SELECT UUID(), c.`id`, seed.`type`, seed.`title`, seed.`copy`, seed.`media_url`, seed.`sector_tags`, seed.`sort_order`
FROM `clinic` c
JOIN (
  SELECT
    'product_screenshot' AS `type`,
    'ClinicGrower OS growth visibility screenshot' AS `title`,
    'Real ClinicGrower OS screenshot showing Growth Score, leakage visibility, response ownership and next actions where connected.' AS `copy`,
    '/brand/proposal/v5-reference/dental_practices/p07-img01-1440x662.png' AS `media_url`,
    JSON_ARRAY(
      'clinicgrower os',
      'product screenshot',
      'growth score',
      'leakage visibility',
      'state:known',
      'source:ClinicGrower OS product screenshot library',
      'timeframe:Current V5 product reference',
      'disclaimer:Product screenshot is illustrative of ClinicGrower OS visibility where supported sources are connected.'
    ) AS `sector_tags`,
    80 AS `sort_order`
  UNION ALL SELECT
    'performance_result',
    '+262.73% high-intent enquiry increase',
    'Increase in high-intent enquiries after managed marketing work was reviewed against source reporting and delivery context. Historical managed-marketing proof only; not a guaranteed ClinicGrower OS result.',
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
      'state:known',
      'proof-scope:Managed-marketing proof with documented delivery context; not a ClinicGrower OS guarantee.',
      'source:ClinicGrower approved proof library',
      'timeframe:Documented delivery period',
      'disclaimer:Historical managed-marketing proof is contextual and does not imply a guaranteed future result.'
    ),
    90
  UNION ALL SELECT
    'performance_result',
    '-31.41% cost-per-enquiry reduction',
    'Reduction in cost per enquiry after campaign and conversion work was tightened against source reporting and delivery context. Historical managed-marketing proof only; not a guaranteed ClinicGrower OS result.',
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
      'state:known',
      'proof-scope:Managed-marketing proof with documented delivery context; not a ClinicGrower OS guarantee.',
      'source:ClinicGrower approved proof library',
      'timeframe:Documented delivery period',
      'disclaimer:Historical managed-marketing proof is contextual and does not imply a guaranteed future result.'
    ),
    100
  UNION ALL SELECT
    'performance_result',
    '+100.6% qualified consultation demand increase',
    'Increase in qualified consultation demand where campaign context and delivery inputs were recorded. Historical managed-marketing proof only; not a guaranteed ClinicGrower OS result.',
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
      'state:known',
      'proof-scope:Managed-marketing proof with documented delivery context; not a ClinicGrower OS guarantee.',
      'source:ClinicGrower approved proof library',
      'timeframe:Documented delivery period',
      'disclaimer:Historical managed-marketing proof is contextual and does not imply a guaranteed future result.'
    ),
    110
) seed
WHERE NOT EXISTS (
  SELECT 1
  FROM `proposal_proof_asset` existing
  WHERE existing.`clinic_id` = c.`id`
    AND existing.`type` = seed.`type`
    AND existing.`title` = seed.`title`
    AND existing.`deleted_at` IS NULL
);

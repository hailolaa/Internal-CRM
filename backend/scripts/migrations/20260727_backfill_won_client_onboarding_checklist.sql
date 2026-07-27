-- MC-043: Backfill the canonical onboarding checklist for converted won deals.
--
-- The temporary target table deliberately requires an assignee. If a source
-- workspace has no active member, the migration fails instead of creating
-- unowned onboarding work.

DROP TEMPORARY TABLE IF EXISTS `mc043_onboarding_template`;
CREATE TEMPORARY TABLE `mc043_onboarding_template` (
  `task_key` VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `title_prefix` VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `due_days` INT UNSIGNED NOT NULL,
  `service_type` ENUM('ppc','seo','gbp','website','landing_pages','cro','strategy','other')
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`task_key`)
) ENGINE=InnoDB;

INSERT INTO `mc043_onboarding_template`
  (`task_key`, `title_prefix`, `due_days`, `service_type`)
VALUES
  ('owner-assignment', 'Assign client owner', 0, 'strategy'),
  ('invoice', 'Raise first invoice', 0, 'strategy'),
  ('gocardless', 'Confirm GoCardless setup', 1, 'strategy'),
  ('onboarding-form', 'Send onboarding form', 1, 'strategy'),
  ('drive-folder', 'Create or link Drive folder', 1, 'strategy'),
  ('website-access', 'Collect website access', 2, 'website'),
  ('ga4', 'Collect GA4 access', 2, 'other'),
  ('gsc', 'Collect Google Search Console access', 2, 'seo'),
  ('gtm', 'Collect Google Tag Manager access', 2, 'other'),
  ('google-ads', 'Collect Google Ads access', 3, 'ppc'),
  ('gbp', 'Collect Google Business Profile access', 3, 'gbp'),
  ('meta', 'Collect Meta Business access', 3, 'ppc'),
  ('brand-assets', 'Collect brand assets', 4, 'website'),
  ('treatment-pricing-info', 'Collect treatment and pricing info', 4, 'strategy'),
  ('reporting-setup', 'Set up reporting', 5, 'other'),
  ('first-review', 'Book first client review', 14, 'strategy');

DROP TEMPORARY TABLE IF EXISTS `mc043_converted_won_deal`;
CREATE TEMPORARY TABLE `mc043_converted_won_deal` (
  `source_clinic_id` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `deal_id` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `client_account_profile_id` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `client_name` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `contact_id` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `contact_name` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `deal_title` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `treatment` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `original_source` VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `assigned_user_id` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`source_clinic_id`, `deal_id`)
) ENGINE=InnoDB;

INSERT INTO `mc043_converted_won_deal`
  (`source_clinic_id`, `deal_id`, `client_account_profile_id`, `client_name`,
   `contact_id`, `contact_name`, `deal_title`, `treatment`, `original_source`,
   `assigned_user_id`)
SELECT
  d.clinic_id,
  d.id,
  d.client_account_profile_id,
  client_clinic.name,
  d.contact_id,
  COALESCE(
    NULLIF(TRIM(CONCAT_WS(' ', contact.first_name, contact.last_name)), ''),
    NULLIF(contact.email, ''),
    client_clinic.name
  ),
  COALESCE(NULLIF(d.title, ''), d.id),
  NULLIF(d.treatment, ''),
  COALESCE(NULLIF(d.source, ''), NULLIF(contact.source, '')),
  COALESCE(active_owner.id, fallback_user.id)
FROM deal d
JOIN clinic source_clinic
  ON source_clinic.id = d.clinic_id
 AND source_clinic.deleted_at IS NULL
JOIN client_account_profile profile
  ON profile.id = d.client_account_profile_id
JOIN clinic client_clinic
  ON client_clinic.id = profile.clinic_id
 AND client_clinic.deleted_at IS NULL
LEFT JOIN contact
  ON contact.id = d.contact_id
 AND contact.clinic_id = d.clinic_id
LEFT JOIN pipeline_stage stage
  ON stage.id = d.pipeline_stage_id
 AND stage.clinic_id = d.clinic_id
 AND stage.deleted_at IS NULL
LEFT JOIN user active_owner
  ON active_owner.id = d.owner_id
 AND active_owner.deleted_at IS NULL
 AND active_owner.status = 'active'
 AND active_owner.is_active = 1
 AND EXISTS (
   SELECT 1
   FROM clinic_membership owner_membership
   WHERE owner_membership.user_id = active_owner.id
     AND owner_membership.clinic_id = d.clinic_id
     AND owner_membership.status = 'active'
 )
LEFT JOIN (
  SELECT ranked_user.clinic_id, ranked_user.id
  FROM (
    SELECT
      membership.clinic_id,
      candidate.id,
      ROW_NUMBER() OVER (
        PARTITION BY membership.clinic_id
        ORDER BY
          CASE WHEN candidate.clinic_id = membership.clinic_id THEN 0 ELSE 1 END,
          CASE UPPER(membership.role)
            WHEN 'SUPER_ADMIN' THEN 0
            WHEN 'ADMIN' THEN 1
            ELSE 2
          END,
          candidate.created_at,
          candidate.id
      ) AS candidate_rank
    FROM clinic_membership membership
    JOIN user candidate
      ON candidate.id = membership.user_id
     AND candidate.deleted_at IS NULL
     AND candidate.status = 'active'
     AND candidate.is_active = 1
    WHERE membership.status = 'active'
  ) ranked_user
  WHERE ranked_user.candidate_rank = 1
) fallback_user
  ON fallback_user.clinic_id = d.clinic_id
WHERE d.client_account_profile_id IS NOT NULL
  AND d.deleted_at IS NULL
  AND (
    d.client_converted_at IS NOT NULL
    OR d.status = 'won'
    OR stage.kind = 'won'
  );

-- Repair reserved canonical tasks only. Preserve completion state, valid manual
-- reassignment, custom due dates, legacy tasks, and unrelated user-created work.
UPDATE task existing_task
JOIN `mc043_converted_won_deal` converted
  ON converted.source_clinic_id = existing_task.clinic_id
JOIN `mc043_onboarding_template` template
  ON existing_task.template_key =
     CONCAT('won_client_onboarding:', converted.deal_id, ':', template.task_key)
LEFT JOIN user current_assignee
  ON current_assignee.id = existing_task.assigned_user_id
 AND current_assignee.deleted_at IS NULL
 AND current_assignee.status = 'active'
 AND current_assignee.is_active = 1
 AND (
   current_assignee.clinic_id = converted.source_clinic_id
   OR EXISTS (
     SELECT 1
     FROM clinic_membership current_membership
     WHERE current_membership.user_id = current_assignee.id
       AND current_membership.clinic_id = converted.source_clinic_id
       AND current_membership.status = 'active'
   )
 )
SET
  existing_task.client_account_profile_id = converted.client_account_profile_id,
  existing_task.contact_id = converted.contact_id,
  existing_task.contact_name = COALESCE(NULLIF(existing_task.contact_name, ''), converted.contact_name),
  existing_task.category = 'client_onboarding',
  existing_task.board_key = 'delivery',
  existing_task.service_type = template.service_type,
  existing_task.due_date = COALESCE(
    existing_task.due_date,
    DATE_ADD(CURRENT_DATE, INTERVAL template.due_days DAY)
  ),
  existing_task.assigned_user_id = CASE
    WHEN current_assignee.id IS NULL THEN converted.assigned_user_id
    ELSE existing_task.assigned_user_id
  END,
  existing_task.created_by = COALESCE(existing_task.created_by, converted.assigned_user_id)
WHERE existing_task.is_internal = 1
  AND existing_task.deleted_at IS NULL
  AND existing_task.archived_at IS NULL;

INSERT INTO task
  (`id`, `clinic_id`, `is_internal`, `title`, `description`, `priority`, `status`,
   `category`, `board_key`, `service_type`, `client_account_profile_id`, `contact_id`,
   `contact_name`, `due_label`, `due_date`, `assigned_user_id`, `template_key`,
   `created_by`)
SELECT
  UUID(),
  converted.source_clinic_id,
  1,
  LEFT(CONCAT(template.title_prefix, ': ', converted.client_name), 255),
  CONCAT_WS(
    '\n',
    CONCAT('Client account: ', converted.client_name),
    CONCAT('Won opportunity: ', converted.deal_title),
    IF(converted.treatment IS NULL, NULL, CONCAT('Package/service: ', converted.treatment)),
    IF(converted.original_source IS NULL, NULL, CONCAT('Original source: ', converted.original_source)),
    '',
    CONCAT('Checklist item: ', template.title_prefix, ': ', converted.client_name),
    'Created automatically when the won opportunity was converted into a client account.'
  ),
  'high',
  'pending',
  'client_onboarding',
  'delivery',
  template.service_type,
  converted.client_account_profile_id,
  converted.contact_id,
  converted.contact_name,
  NULL,
  DATE_ADD(CURRENT_DATE, INTERVAL template.due_days DAY),
  converted.assigned_user_id,
  CONCAT('won_client_onboarding:', converted.deal_id, ':', template.task_key),
  converted.assigned_user_id
FROM `mc043_converted_won_deal` converted
CROSS JOIN `mc043_onboarding_template` template
LEFT JOIN task existing_task
  ON existing_task.clinic_id = converted.source_clinic_id
 AND existing_task.is_internal = 1
 AND existing_task.template_key =
     CONCAT('won_client_onboarding:', converted.deal_id, ':', template.task_key)
 AND existing_task.deleted_at IS NULL
 AND existing_task.archived_at IS NULL
WHERE existing_task.id IS NULL;

DROP TEMPORARY TABLE `mc043_converted_won_deal`;
DROP TEMPORARY TABLE `mc043_onboarding_template`;

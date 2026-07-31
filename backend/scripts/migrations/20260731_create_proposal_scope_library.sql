CREATE TABLE IF NOT EXISTS `proposal_scope_item` (
  `id` CHAR(36) NOT NULL,
  `clinic_id` CHAR(36) NOT NULL,
  `template_key` VARCHAR(100) NOT NULL,
  `category` VARCHAR(80) NOT NULL,
  `title` VARCHAR(180) NOT NULL,
  `client_description` TEXT NOT NULL,
  `frequency` VARCHAR(120) NULL,
  `quantity_limit` VARCHAR(120) NULL,
  `inclusion_status` ENUM('included','excluded') NOT NULL DEFAULT 'included',
  `delivery_type` ENUM('recurring','one_off') NOT NULL DEFAULT 'recurring',
  `is_optional_add_on` TINYINT(1) NOT NULL DEFAULT 0,
  `internal_notes` TEXT NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_proposal_scope_item_template` (`clinic_id`, `template_key`, `is_active`, `sort_order`),
  KEY `idx_proposal_scope_item_category` (`clinic_id`, `category`, `is_active`),
  CONSTRAINT `fk_proposal_scope_item_clinic` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_proposal_scope_item_template` FOREIGN KEY (`clinic_id`, `template_key`) REFERENCES `proposal_template` (`clinic_id`, `template_key`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `proposal_scope_item`
  (`id`, `clinic_id`, `template_key`, `category`, `title`, `client_description`, `frequency`, `quantity_limit`, `inclusion_status`, `delivery_type`, `is_optional_add_on`, `internal_notes`, `sort_order`)
SELECT UUID(), c.`id`, 'clinicgrower_standard', 'Strategy', 'Growth strategy and priorities',
       'A focused growth plan built around the clinic goals, service priorities, commercial capacity and highest-impact opportunities.',
       'Monthly', 'Included in programme', 'included', 'recurring', 0, 'Internal delivery planning stays outside the client-facing proposal.', 10
FROM `clinic` c
UNION ALL
SELECT UUID(), c.`id`, 'clinicgrower_standard', 'Google Ads', 'Google Ads management',
       'Campaign structure, search intent, budget control and optimisation for the agreed priority services and locations.',
       'Ongoing', 'Subject to agreed ad spend', 'included', 'recurring', 0, NULL, 20
FROM `clinic` c
UNION ALL
SELECT UUID(), c.`id`, 'clinicgrower_standard', 'Meta Ads', 'Meta Ads support',
       'Meta campaign support where retargeting, awareness or demand creation is agreed as part of the growth plan.',
       'As required', 'Campaign scope agreed before launch', 'included', 'recurring', 0, NULL, 30
FROM `clinic` c
UNION ALL
SELECT UUID(), c.`id`, 'clinicgrower_standard', 'SEO', 'Local SEO improvements',
       'Priority technical, content and local search improvements to strengthen qualified organic visibility.',
       'Monthly', 'Priority actions agreed each cycle', 'included', 'recurring', 0, NULL, 40
FROM `clinic` c
UNION ALL
SELECT UUID(), c.`id`, 'clinicgrower_standard', 'Google Business Profile', 'Google Business Profile optimisation',
       'Practical improvements to profile completeness, local visibility signals and enquiry paths from Google Business Profile.',
       'Monthly', 'One primary profile unless agreed otherwise', 'included', 'recurring', 0, NULL, 50
FROM `clinic` c
UNION ALL
SELECT UUID(), c.`id`, 'clinicgrower_standard', 'Website/Landing Pages', 'Website and landing page conversion work',
       'Conversion recommendations and agreed page improvements so more visitors understand the offer and take the next step.',
       'As required', 'Priority pages agreed in roadmap', 'included', 'recurring', 0, NULL, 60
FROM `clinic` c
UNION ALL
SELECT UUID(), c.`id`, 'clinicgrower_standard', 'Tracking', 'Lead tracking and reporting setup',
       'Tracking recommendations for calls, forms, campaign sources and booked enquiry visibility.',
       'Setup then ongoing review', 'Tracking depends on access and platform limits', 'included', 'recurring', 0, NULL, 70
FROM `clinic` c
UNION ALL
SELECT UUID(), c.`id`, 'clinicgrower_standard', 'Lead Handling', 'Lead handling and follow-up guidance',
       'Recommendations to reduce missed enquiries, improve response speed and make follow-up more consistent.',
       'Monthly review', 'Process recommendations, not outsourced reception unless agreed', 'included', 'recurring', 0, NULL, 80
FROM `clinic` c
UNION ALL
SELECT UUID(), c.`id`, 'clinicgrower_standard', 'Reporting', 'Performance reporting',
       'Clear reporting on the agreed growth indicators, blockers, next actions and commercial visibility.',
       'Monthly', 'Standard reporting cadence', 'included', 'recurring', 0, NULL, 90
FROM `clinic` c
UNION ALL
SELECT UUID(), c.`id`, 'clinicgrower_standard', 'Content', 'Content direction',
       'Content priorities and recommendations that support local visibility, trust and conversion.',
       'As required', 'Content production level confirmed separately', 'included', 'recurring', 0, NULL, 100
FROM `clinic` c
UNION ALL
SELECT UUID(), c.`id`, 'clinicgrower_standard', 'Conversion', 'Conversion improvement recommendations',
       'Practical conversion improvements across offer clarity, proof, calls to action and enquiry routes.',
       'Ongoing', 'Priority fixes agreed from evidence', 'included', 'recurring', 0, NULL, 110
FROM `clinic` c
UNION ALL
SELECT UUID(), c.`id`, 'clinicgrower_standard', 'Retention', 'Retention and upsell visibility',
       'Light-touch recommendations where patient journey, review activity or existing-client value can support growth.',
       'As required', 'Not a full retention programme unless scoped', 'included', 'recurring', 0, NULL, 120
FROM `clinic` c
UNION ALL
SELECT UUID(), c.`id`, 'clinicgrower_standard', 'Support', 'Growth support and review',
       'Regular support around priorities, blockers, progress and the next actions needed to keep the plan moving.',
       'Monthly', 'Normal business support channels', 'included', 'recurring', 0, NULL, 130
FROM `clinic` c;

INSERT INTO `proposal_scope_item`
  (`id`, `clinic_id`, `template_key`, `category`, `title`, `client_description`, `frequency`, `quantity_limit`, `inclusion_status`, `delivery_type`, `is_optional_add_on`, `internal_notes`, `sort_order`)
SELECT UUID(), c.`id`, 'bespoke_growth_plan', 'Strategy', 'Bespoke growth strategy',
       'A tailored plan based on the agreed commercial objective, available capacity, current constraints and internal team setup.',
       'Agreed per scope', 'Defined in proposal', 'included', 'one_off', 0, 'Internal estimates and margin notes remain outside the client-facing scope.', 10
FROM `clinic` c
UNION ALL
SELECT UUID(), c.`id`, 'bespoke_growth_plan', 'Website/Landing Pages', 'Priority website or landing page work',
       'The agreed website, landing page or conversion workstream needed to support the first commercial priority.',
       'Agreed per scope', 'Pages and deliverables confirmed before acceptance', 'included', 'one_off', 0, NULL, 20
FROM `clinic` c
UNION ALL
SELECT UUID(), c.`id`, 'bespoke_growth_plan', 'Tracking', 'Tracking and measurement foundations',
       'The agreed measurement setup needed to understand enquiries, source visibility and progress.',
       'Setup then review', 'Depends on platform access', 'included', 'one_off', 0, NULL, 30
FROM `clinic` c
UNION ALL
SELECT UUID(), c.`id`, 'bespoke_growth_plan', 'Google Ads', 'Google Ads workstream',
       'A Google Ads workstream can be included where paid search is part of the agreed route to growth.',
       'Optional', 'Budget and scope agreed separately', 'excluded', 'recurring', 1, NULL, 40
FROM `clinic` c
UNION ALL
SELECT UUID(), c.`id`, 'bespoke_growth_plan', 'Meta Ads', 'Meta Ads workstream',
       'A Meta Ads workstream can be added where awareness, retargeting or demand creation is part of the plan.',
       'Optional', 'Budget and scope agreed separately', 'excluded', 'recurring', 1, NULL, 50
FROM `clinic` c
UNION ALL
SELECT UUID(), c.`id`, 'bespoke_growth_plan', 'SEO', 'SEO workstream',
       'SEO support can be included where local organic visibility is part of the agreed first phase.',
       'Optional', 'Scope agreed separately', 'excluded', 'recurring', 1, NULL, 60
FROM `clinic` c
UNION ALL
SELECT UUID(), c.`id`, 'bespoke_growth_plan', 'Reporting', 'Bespoke reporting rhythm',
       'Progress reporting matched to the agreed milestones, responsibilities and decision points.',
       'Agreed per scope', 'Reporting format confirmed during kickoff', 'included', 'recurring', 0, NULL, 70
FROM `clinic` c
UNION ALL
SELECT UUID(), c.`id`, 'bespoke_growth_plan', 'Support', 'Project support and governance',
       'Support around blockers, decisions and next actions so the bespoke scope remains controlled.',
       'Agreed per scope', 'Support route confirmed before launch', 'included', 'recurring', 0, NULL, 80
FROM `clinic` c;

INSERT INTO `proposal_scope_item`
  (`id`, `clinic_id`, `template_key`, `category`, `title`, `client_description`, `frequency`, `quantity_limit`, `inclusion_status`, `delivery_type`, `is_optional_add_on`, `internal_notes`, `sort_order`)
SELECT UUID(), c.`id`, 'growth_score_follow_up', 'Strategy', 'Growth Score action plan',
       'A focused action plan based on the highest-impact Growth Score gaps.',
       'One-off', 'Initial follow-up plan', 'included', 'one_off', 0, NULL, 10
FROM `clinic` c
UNION ALL
SELECT UUID(), c.`id`, 'growth_score_follow_up', 'Tracking', 'Measurement gap review',
       'A review of the tracking and visibility gaps that make growth decisions harder.',
       'One-off', 'Initial diagnostic review', 'included', 'one_off', 0, NULL, 20
FROM `clinic` c
UNION ALL
SELECT UUID(), c.`id`, 'growth_score_follow_up', 'Conversion', 'Conversion gap review',
       'A review of the conversion points most likely to affect enquiry quality and booked consultations.',
       'One-off', 'Initial diagnostic review', 'included', 'one_off', 0, NULL, 30
FROM `clinic` c
UNION ALL
SELECT UUID(), c.`id`, 'growth_score_follow_up', 'Lead Handling', 'Lead handling gap review',
       'A review of response speed, follow-up and enquiry handling gaps highlighted by the Growth Score.',
       'One-off', 'Initial diagnostic review', 'included', 'one_off', 0, NULL, 40
FROM `clinic` c
UNION ALL
SELECT UUID(), c.`id`, 'growth_score_follow_up', 'Reporting', 'Recommended next-step summary',
       'A clear summary of the recommended package, priority gaps and next actions.',
       'One-off', 'Initial recommendation', 'included', 'one_off', 0, NULL, 50
FROM `clinic` c;

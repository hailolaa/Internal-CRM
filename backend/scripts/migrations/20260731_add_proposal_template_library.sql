CREATE TABLE IF NOT EXISTS `proposal_template` (
  `id` CHAR(36) NOT NULL,
  `clinic_id` CHAR(36) NOT NULL,
  `template_key` VARCHAR(100) NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `description` TEXT NULL,
  `package_name` VARCHAR(150) NULL,
  `default_sections` JSON NULL,
  `default_roadmap` JSON NULL,
  `default_terms` TEXT NULL,
  `default_success_metrics` JSON NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_proposal_template_workspace_key` (`clinic_id`, `template_key`),
  KEY `idx_proposal_template_active` (`clinic_id`, `is_active`, `sort_order`),
  CONSTRAINT `fk_proposal_template_clinic` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `proposal_template`
  (`id`, `clinic_id`, `template_key`, `name`, `description`, `package_name`, `default_sections`, `default_roadmap`, `default_terms`, `default_success_metrics`, `sort_order`)
SELECT
  UUID(),
  c.`id`,
  'clinicgrower_standard',
  'Clinic Growth Engine',
  'Diagnosis-led proposal for growth campaigns, tracking, lead handling and commercial growth.',
  'Growth Engine',
  '{
    "executiveSummary": "This proposal is built around the growth gaps we can see today, the commercial opportunity available, and the practical plan to turn more existing demand into booked, trackable enquiries.",
    "personalIntroduction": "I have kept this proposal focused on the areas that matter most: visibility, conversion, tracking, lead handling and the first actions needed to create measurable progress.",
    "diagnosis": "The main opportunity is not simply more activity. The priority is to connect the website, tracking, paid media, follow-up process and reporting into one growth system that the team can trust.",
    "introVideoUrl": "https://vimeo.com/1008757315?fl=pl&fe=sh",
    "introVideoTitle": "A short message from ClinicGrower",
    "primaryGoal": "Increase qualified enquiries and booked consultations from the existing local market.",
    "currentPosition": "There is demand available, but visibility, conversion, follow-up and measurement need to work together more consistently.",
    "desiredOutcome": "A clearer growth system with better enquiries, stronger conversion and reliable performance visibility.",
    "biggestRisk": "Continuing to spend time or budget without clear attribution, fast follow-up and a reliable path from enquiry to booked consultation.",
    "biggestOpportunity": "A focused growth engine that improves lead quality, speed to lead, tracking and the conversion journey.",
    "firstRecommendedFix": "Start with the tracking, campaign and conversion fixes that make every future lead easier to measure and follow up.",
    "recommendedPlan": "Build a joined-up ClinicGrower growth engine across website conversion, tracking, campaign structure, lead handling and performance reporting.",
    "strategyPoints": [
      "Clarify the offer and conversion path before scaling traffic.",
      "Tighten tracking so enquiries, booked calls and commercial value are visible.",
      "Improve the paid and organic routes that create qualified local demand.",
      "Create a follow-up rhythm so high-intent leads are not missed.",
      "Review results consistently and move budget toward what is working."
    ],
    "includedFeatures": [
      "Growth strategy and campaign planning",
      "Tracking and reporting setup",
      "Website and landing-page conversion guidance",
      "Paid media campaign management",
      "SEO and local visibility support",
      "Lead handling and follow-up recommendations",
      "Monthly performance review"
    ],
    "successMetrics": [
      "More qualified enquiries",
      "Improved booked-call or consultation rate",
      "Clearer source and campaign attribution",
      "Faster follow-up on high-intent leads",
      "Better visibility of commercial return"
    ],
    "clinicGrowerResponsibilities": [
      "Own the strategy, campaign structure, tracking recommendations and growth reporting.",
      "Review performance and recommend the next actions based on evidence.",
      "Flag blockers early where access, content or client-side actions are needed."
    ],
    "clientResponsibilities": [
      "Provide requested access, assets and commercial context promptly.",
      "Keep the team informed about capacity, service priorities and enquiry quality.",
      "Review recommendations and approve agreed actions in good time."
    ],
    "timeline": "First 30 days: access, tracking, diagnosis and campaign foundations. Days 31-60: launch priority improvements and tighten follow-up. Days 61-90: review evidence, scale what works and plan the next growth phase.",
    "termsSummary": "Monthly service with agreed minimum term, notice period and start date confirmed in the commercial section.",
    "investmentNotes": "Pricing should be reviewed against available capacity, target bookings, required ad spend and the commercial value of a converted enquiry.",
    "nextSteps": "Confirm the recommended package, approve the start date, complete access requests and schedule the kickoff."
  }',
  '[
    "Confirm offer, goals, access and commercial assumptions",
    "Complete tracking and visibility foundations",
    "Launch agreed campaign and conversion improvements",
    "Review first performance signals and tighten lead handling",
    "Scale the strongest channels and agree the next growth priority"
  ]',
  'Monthly service with the agreed minimum term, notice period, start date, VAT position and ad spend note confirmed before launch.',
  '[
    "Qualified enquiries",
    "Booked calls or consultations",
    "Speed to lead",
    "Tracking completeness",
    "Pipeline and revenue visibility"
  ]',
  10
FROM `clinic` c;

INSERT IGNORE INTO `proposal_template`
  (`id`, `clinic_id`, `template_key`, `name`, `description`, `package_name`, `default_sections`, `default_roadmap`, `default_terms`, `default_success_metrics`, `sort_order`)
SELECT
  UUID(),
  c.`id`,
  'bespoke_growth_plan',
  'Bespoke Growth Plan',
  'Flexible proposal for custom scope, mixed delivery needs, multi-location work or non-standard commercial terms.',
  'Bespoke Growth Plan',
  '{
    "executiveSummary": "This proposal is shaped around the specific commercial situation, constraints and growth priorities discussed so the scope can stay practical rather than generic.",
    "personalIntroduction": "I have used the agreed context as the starting point and left the scope flexible enough to match the level of support required.",
    "diagnosis": "The opportunity needs a tailored plan because the growth constraints, delivery requirements or commercial model do not fit a standard package cleanly.",
    "introVideoUrl": "https://vimeo.com/1008757315?fl=pl&fe=sh",
    "introVideoTitle": "A short message from ClinicGrower",
    "primaryGoal": "Agree a practical growth plan that matches the current priority, budget and internal capacity.",
    "currentPosition": "There is a clear growth opportunity, but the route to execution needs to be scoped around the client situation.",
    "desiredOutcome": "A focused plan with clear responsibilities, measurable outcomes and enough flexibility to handle the real delivery needs.",
    "biggestRisk": "Trying to force a standard package where a tailored scope is needed, creating gaps in delivery or unclear expectations.",
    "biggestOpportunity": "Build the right scope from the start and keep the proposal tied to measurable commercial progress.",
    "firstRecommendedFix": "Confirm the highest-impact growth constraint and build the first phase around that.",
    "recommendedPlan": "Create a bespoke growth plan with agreed priorities, responsibilities, milestones and reporting.",
    "strategyPoints": [
      "Confirm the commercial objective and highest-value services or locations.",
      "Prioritise the work that removes the biggest growth constraint first.",
      "Define the split between ClinicGrower delivery and client-side responsibilities.",
      "Set measurable success indicators before work begins.",
      "Review the first phase before expanding scope."
    ],
    "includedFeatures": [
      "Custom growth planning",
      "Priority channel or conversion work",
      "Tracking and reporting recommendations",
      "Delivery roadmap",
      "Progress reviews",
      "Defined responsibilities and next actions"
    ],
    "successMetrics": [
      "Clearer growth priorities",
      "Improved enquiry visibility",
      "Better conversion or lead handling",
      "Completed agreed milestones",
      "Decision-ready reporting"
    ],
    "clinicGrowerResponsibilities": [
      "Define and deliver the agreed scope.",
      "Keep progress visible through agreed updates and reviews.",
      "Flag risks, blockers and recommended next steps."
    ],
    "clientResponsibilities": [
      "Provide access, approvals and source information needed for delivery.",
      "Confirm business priorities where trade-offs are required.",
      "Review outputs and respond to blockers promptly."
    ],
    "timeline": "First phase to be agreed based on priority, access readiness, launch requirements and internal capacity.",
    "termsSummary": "Commercial terms, scope boundaries, payment timing and notice period are confirmed in the investment section.",
    "investmentNotes": "The bespoke price should reflect the agreed scope, delivery intensity, support level and expected commercial value.",
    "nextSteps": "Confirm scope, commercial terms, access requirements and the first delivery milestone."
  }',
  '[
    "Confirm bespoke scope and commercial objective",
    "Agree access, responsibilities and first milestone",
    "Deliver the first priority workstream",
    "Review early results and blockers",
    "Confirm the next phase or package recommendation"
  ]',
  'Bespoke terms should be confirmed against the agreed scope, payment timing, start date, minimum commitment and notice period.',
  '[
    "Agreed milestone completion",
    "Enquiry or conversion visibility",
    "Priority blocker removal",
    "Client-side readiness",
    "Next-phase decision clarity"
  ]',
  20
FROM `clinic` c;

INSERT IGNORE INTO `proposal_template`
  (`id`, `clinic_id`, `template_key`, `name`, `description`, `package_name`, `default_sections`, `default_roadmap`, `default_terms`, `default_success_metrics`, `sort_order`)
SELECT
  UUID(),
  c.`id`,
  'growth_score_follow_up',
  'Growth Score Follow-up',
  'Follow-up proposal after a Clinic Growth Score, audit or diagnostic review.',
  'Clinic Growth Score Follow-up',
  '{
    "executiveSummary": "This proposal turns the Growth Score findings into the next practical commercial step.",
    "personalIntroduction": "The score gives us a useful starting point: where growth is blocked today and what should happen next.",
    "diagnosis": "The priority is to address the lowest-scoring areas first, especially where they affect visibility, conversion, tracking or lead handling.",
    "introVideoUrl": "https://vimeo.com/1008757315?fl=pl&fe=sh",
    "introVideoTitle": "A short message from ClinicGrower",
    "recommendedPlan": "Use the Growth Score gaps to prioritise the first phase of the growth plan.",
    "strategyPoints": [
      "Review the weakest score categories.",
      "Agree the first commercial priority.",
      "Fix the tracking and conversion gaps that affect decision-making.",
      "Move into the recommended package once the priority is clear."
    ],
    "successMetrics": [
      "Improved Growth Score categories",
      "Clearer enquiry visibility",
      "Better lead handling",
      "Agreed package recommendation"
    ],
    "timeline": "Use the first 30 days to turn the Growth Score findings into an agreed plan and first delivery actions.",
    "termsSummary": "Terms are confirmed once the recommended package and start date are agreed.",
    "nextSteps": "Review the Growth Score findings, confirm the recommended next package and agree the first action."
  }',
  '[
    "Review Growth Score findings",
    "Confirm the highest-impact gap",
    "Agree recommended package",
    "Start the first improvement action"
  ]',
  'Terms follow the selected recommended package unless a bespoke scope is agreed.',
  '[
    "Growth Score improvement",
    "Priority gaps closed",
    "Recommended package agreed",
    "First follow-up action completed"
  ]',
  30
FROM `clinic` c;

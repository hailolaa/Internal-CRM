-- CG service agreement journey: accepted proposal -> controlled branded agreement.
-- Additive only. Keeps legal content/version checks server-side and preserves immutable evidence.

SET @schema_name = DATABASE();

INSERT IGNORE INTO `permission` (`id`, `key_name`, `description`, `created_at`, `updated_at`)
VALUES
  ('perm-service-agreements-read', 'service_agreements:read', 'Read controlled ClinicGrower service agreements', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perm-service-agreements-write', 'service_agreements:write', 'Generate and manage controlled ClinicGrower service agreements', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perm-service-agreements-approve', 'service_agreements:approve', 'Approve exact service agreement versions for external send', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT IGNORE INTO `role_permission` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `role` r
JOIN `permission` p
  ON p.key_name IN ('service_agreements:read', 'service_agreements:write', 'service_agreements:approve')
WHERE r.name IN ('SUPER_ADMIN', 'ADMIN');

CREATE TABLE IF NOT EXISTS `service_agreement` (
  `id` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `proposal_id` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `client_account_profile_id` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `source_type` ENUM('accepted_proposal','manual_entry','transcript_draft') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `source_reference` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` ENUM('max_approval_required','approved_for_send','sent','signed','voided') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'max_approval_required',
  `render_mode` ENUM('test_do_not_send','production') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'test_do_not_send',
  `legal_terms_version` VARCHAR(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `legal_content_sha256` CHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `template_version` VARCHAR(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `template_sha256` CHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `css_sha256` CHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `asset_manifest_sha256` CHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `agreement_payload` JSON NOT NULL,
  `agreement_payload_sha256` CHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `rendered_html_sha256` CHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `watermark` VARCHAR(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `max_approved_by` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `max_approved_at` DATETIME DEFAULT NULL,
  `approval_event_sha256` CHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `signed_evidence_id` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `accepted_pdf_sha256` CHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `quickbooks_draft_id` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `onboarding_unlocked_at` DATETIME DEFAULT NULL,
  `created_by` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_service_agreement_source` (`clinic_id`, `source_type`, `source_reference`),
  KEY `idx_service_agreement_status` (`clinic_id`, `status`, `created_at`),
  KEY `idx_service_agreement_proposal` (`clinic_id`, `proposal_id`),
  KEY `idx_service_agreement_client` (`clinic_id`, `client_account_profile_id`),
  KEY `idx_service_agreement_signature` (`signed_evidence_id`),
  KEY `idx_service_agreement_quickbooks` (`quickbooks_draft_id`),
  KEY `fk_service_agreement_created_by` (`created_by`),
  CONSTRAINT `fk_service_agreement_clinic` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_service_agreement_proposal` FOREIGN KEY (`proposal_id`) REFERENCES `proposal` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_service_agreement_client` FOREIGN KEY (`client_account_profile_id`) REFERENCES `client_account_profile` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_service_agreement_signature` FOREIGN KEY (`signed_evidence_id`) REFERENCES `proposal_signature_evidence` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_service_agreement_created_by` FOREIGN KEY (`created_by`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `service_agreement_audit_event` (
  `id` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `service_agreement_id` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `event_type` ENUM('generated','max_approved','signature_attached','quickbooks_triggered','onboarding_unlocked','blocked') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `idempotency_key` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `event_payload` JSON NOT NULL,
  `event_sha256` CHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_by` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_service_agreement_audit_idempotency` (`clinic_id`, `idempotency_key`),
  KEY `idx_service_agreement_audit_agreement` (`clinic_id`, `service_agreement_id`, `created_at`),
  KEY `idx_service_agreement_audit_type` (`clinic_id`, `event_type`, `created_at`),
  KEY `fk_service_agreement_audit_created_by` (`created_by`),
  CONSTRAINT `fk_service_agreement_audit_clinic` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_service_agreement_audit_agreement` FOREIGN KEY (`service_agreement_id`) REFERENCES `service_agreement` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_service_agreement_audit_created_by` FOREIGN KEY (`created_by`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

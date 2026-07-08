
/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
DROP TABLE IF EXISTS `activity`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `activity` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `contact_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` enum('Call','Email','SMS','Appointment','Note','StatusChange') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `timestamp` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `user_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `metadata` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_clinic_id` (`clinic_id`),
  KEY `idx_contact_id` (`contact_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_timestamp` (`timestamp`),
  KEY `idx_deleted_at` (`deleted_at`),
  CONSTRAINT `activity_ibfk_1` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `activity_ibfk_2` FOREIGN KEY (`contact_id`) REFERENCES `contact` (`id`) ON DELETE CASCADE,
  CONSTRAINT `activity_ibfk_3` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `activity` WRITE;
/*!40000 ALTER TABLE `activity` DISABLE KEYS */;
INSERT INTO `activity` VALUES ('activity-001','clinic-001','contact-001','Appointment','2026-04-24 08:00:00','user-002','{\"action\": \"scheduled\", \"appointment_id\": \"appt-001\"}','2026-04-24 13:22:43','2026-04-24 13:22:43',NULL),('activity-002','clinic-001','contact-002','Appointment','2026-04-22 09:45:00','user-002','{\"action\": \"completed\", \"appointment_id\": \"appt-002\"}','2026-04-24 13:22:43','2026-04-24 13:22:43',NULL),('activity-003','clinic-001','contact-003','Note','2026-03-01 14:00:00','user-002','{\"note_type\": \"treatment_started\"}','2026-04-24 13:22:43','2026-04-24 13:22:43',NULL),('activity-004','clinic-001','contact-004','Appointment','2026-05-01 10:00:00',NULL,'{\"action\": \"no_show\", \"appointment_id\": \"appt-004\"}','2026-04-24 13:22:43','2026-04-24 13:22:43',NULL),('activity-005','clinic-002','contact-005','StatusChange','2026-04-18 08:30:00','user-005','{\"new_status\": \"active\", \"old_status\": \"prospect\"}','2026-04-24 13:22:43','2026-04-24 13:22:43',NULL),('activity-006','clinic-002','contact-006','Note','2026-04-19 13:30:00','user-005','{\"note_type\": \"assessment_added\"}','2026-04-24 13:22:43','2026-04-24 13:22:43',NULL),('activity-007','clinic-003','contact-007','Appointment','2026-04-24 14:00:00','user-007','{\"to\": \"2026-04-26\", \"from\": \"2026-04-25\", \"action\": \"rescheduled\"}','2026-04-24 13:22:43','2026-04-24 13:22:43',NULL),('activity-008','clinic-003','contact-008','Note','2026-04-20 10:00:00','user-007','{\"note_type\": \"treatment_updated\"}','2026-04-24 13:22:43','2026-04-24 13:22:43',NULL),('activity-009','clinic-004','contact-009','Email','2026-04-23 09:00:00','user-008','{\"email_type\": \"reminder\"}','2026-04-24 13:22:43','2026-04-24 13:22:43',NULL),('activity-010','clinic-004','contact-010','SMS','2026-04-23 13:00:00','user-009','{\"sms_type\": \"reminder\"}','2026-04-24 13:22:43','2026-04-24 13:22:43',NULL);
/*!40000 ALTER TABLE `activity` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `ai_agent`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ai_agent` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `type` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `config` json DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_by` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `created_by` (`created_by`),
  KEY `idx_clinic_id` (`clinic_id`),
  KEY `idx_is_active` (`is_active`),
  KEY `idx_deleted_at` (`deleted_at`),
  CONSTRAINT `ai_agent_ibfk_1` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `ai_agent_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `ai_agent` WRITE;
/*!40000 ALTER TABLE `ai_agent` DISABLE KEYS */;
/*!40000 ALTER TABLE `ai_agent` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `ai_agent_run`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ai_agent_run` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `ai_agent_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `input_data` json DEFAULT NULL,
  `output_data` json DEFAULT NULL,
  `status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `started_at` timestamp NULL DEFAULT NULL,
  `completed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_clinic_id` (`clinic_id`),
  KEY `idx_ai_agent_id` (`ai_agent_id`),
  KEY `idx_status` (`status`),
  KEY `idx_deleted_at` (`deleted_at`),
  CONSTRAINT `ai_agent_run_ibfk_1` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `ai_agent_run_ibfk_2` FOREIGN KEY (`ai_agent_id`) REFERENCES `ai_agent` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `ai_agent_run` WRITE;
/*!40000 ALTER TABLE `ai_agent_run` DISABLE KEYS */;
/*!40000 ALTER TABLE `ai_agent_run` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `ai_project`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ai_project` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('active','draft','completed','archived') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft',
  `created_by` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_ap_clinic` (`clinic_id`),
  KEY `fk_ap_user` (`created_by`),
  CONSTRAINT `fk_ap_clinic` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_ap_user` FOREIGN KEY (`created_by`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `ai_project` WRITE;
/*!40000 ALTER TABLE `ai_project` DISABLE KEYS */;
/*!40000 ALTER TABLE `ai_project` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `ai_run`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ai_run` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `project_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `agent_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `agent_key` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `task` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `input` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `output` json DEFAULT NULL,
  `status` enum('success','error','running') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'success',
  `tokens` int NOT NULL DEFAULT '0',
  `created_by` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_ar_clinic` (`clinic_id`),
  KEY `idx_ar_project` (`project_id`),
  KEY `fk_ar_user` (`created_by`),
  CONSTRAINT `fk_ar_clinic` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_ar_project` FOREIGN KEY (`project_id`) REFERENCES `ai_project` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_ar_user` FOREIGN KEY (`created_by`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `ai_run` WRITE;
/*!40000 ALTER TABLE `ai_run` DISABLE KEYS */;
/*!40000 ALTER TABLE `ai_run` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `api_key`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `api_key` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `key_prefix` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `key_hash` char(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_by` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `last_used_at` timestamp NULL DEFAULT NULL,
  `revoked_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_api_key_hash` (`key_hash`),
  KEY `idx_api_key_clinic` (`clinic_id`),
  KEY `idx_api_key_revoked` (`revoked_at`),
  KEY `fk_api_key_created_by` (`created_by`),
  CONSTRAINT `fk_api_key_clinic` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_api_key_created_by` FOREIGN KEY (`created_by`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `api_key` WRITE;
/*!40000 ALTER TABLE `api_key` DISABLE KEYS */;
/*!40000 ALTER TABLE `api_key` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `appointment`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `appointment` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `contact_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinician_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `date_time` datetime NOT NULL,
  `status` enum('Scheduled','Completed','NoShow','Cancelled') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'Scheduled',
  `appointment_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'consult',
  `treatment` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `value` decimal(12,2) NOT NULL DEFAULT '0.00',
  `duration_minutes` int NOT NULL DEFAULT '30',
  `no_show_reason` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `consult_notes` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `recurrence_rule` json DEFAULT NULL,
  `recurrence_series_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `recurrence_position` int DEFAULT NULL,
  `pre_consult_checklist` json DEFAULT NULL,
  `outcomes` json DEFAULT NULL,
  `follow_up_appointment_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_by` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `follow_up_appointment_id` (`follow_up_appointment_id`),
  KEY `idx_clinic_id` (`clinic_id`),
  KEY `idx_contact_id` (`contact_id`),
  KEY `idx_clinician_id` (`clinician_id`),
  KEY `idx_date_time` (`date_time`),
  KEY `idx_status` (`status`),
  KEY `idx_appointment_recurrence_series` (`clinic_id`,`recurrence_series_id`,`recurrence_position`),
  KEY `idx_appointment_clinic_range` (`clinic_id`,`date_time`,`status`),
  KEY `idx_appointment_clinician_slot` (`clinic_id`,`clinician_id`,`date_time`,`status`,`deleted_at`),
  KEY `idx_deleted_at` (`deleted_at`),
  KEY `fk_appointment_created_by` (`created_by`),
  CONSTRAINT `appointment_ibfk_1` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `appointment_ibfk_2` FOREIGN KEY (`contact_id`) REFERENCES `contact` (`id`) ON DELETE CASCADE,
  CONSTRAINT `appointment_ibfk_3` FOREIGN KEY (`clinician_id`) REFERENCES `user` (`id`) ON DELETE SET NULL,
  CONSTRAINT `appointment_ibfk_4` FOREIGN KEY (`follow_up_appointment_id`) REFERENCES `appointment` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_appointment_created_by` FOREIGN KEY (`created_by`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `appointment` WRITE;
/*!40000 ALTER TABLE `appointment` DISABLE KEYS */;
INSERT INTO `appointment` VALUES ('appt-001','clinic-001','contact-001','user-002','2026-04-28 09:00:00','Scheduled','consult',NULL,0.00,30,NULL,NULL,'{\"consent_form\": true, \"medical_history\": true}',NULL,NULL,NULL,'2026-04-24 13:22:35','2026-04-24 13:22:35',NULL),('appt-002','clinic-001','contact-002','user-002','2026-04-29 10:00:00','Scheduled','consult',NULL,0.00,30,NULL,NULL,'{\"consent_form\": true, \"medical_history\": true}',NULL,NULL,NULL,'2026-04-24 13:22:35','2026-04-24 13:22:35',NULL),('appt-003','clinic-001','contact-003','user-002','2026-04-30 14:00:00','Completed','consult',NULL,0.00,30,NULL,'Patient responded well to treatment. Pain reduced.','{\"consent_form\": true, \"medical_history\": true}','{\"mobility\": \"improved\", \"pain_level\": 4}',NULL,NULL,'2026-04-24 13:22:35','2026-04-24 13:22:35',NULL),('appt-004','clinic-001','contact-004','user-002','2026-05-01 11:00:00','NoShow','consult',NULL,0.00,30,'Forgot appointment',NULL,NULL,NULL,NULL,NULL,'2026-04-24 13:22:35','2026-04-24 13:22:35',NULL),('appt-005','clinic-002','contact-005','user-005','2026-04-27 09:30:00','Completed','consult',NULL,0.00,30,NULL,'Initial assessment completed successfully.','{\"consent_form\": true, \"medical_history\": true}','{\"assessment_complete\": true}',NULL,NULL,'2026-04-24 13:22:35','2026-04-24 13:22:35',NULL),('appt-006','clinic-002','contact-006','user-005','2026-05-02 15:00:00','Scheduled','consult',NULL,0.00,30,NULL,NULL,'{\"consent_form\": true, \"medical_history\": true}',NULL,NULL,NULL,'2026-04-24 13:22:35','2026-04-24 13:22:35',NULL),('appt-007','clinic-003','contact-007','user-007','2026-04-26 10:00:00','Completed','consult',NULL,0.00,30,NULL,'Sports injury assessment complete. Hamstring strain confirmed.','{\"consent_form\": true, \"medical_history\": true}','{\"diagnosis\": \"hamstring_strain\"}',NULL,NULL,'2026-04-24 13:22:35','2026-04-24 13:22:35',NULL),('appt-008','clinic-003','contact-008','user-007','2026-05-03 13:00:00','Scheduled','consult',NULL,0.00,30,NULL,NULL,'{\"consent_form\": true, \"medical_history\": true}',NULL,NULL,NULL,'2026-04-24 13:22:35','2026-04-24 13:22:35',NULL),('appt-009','clinic-004','contact-009','user-008','2026-04-25 11:00:00','Completed','consult',NULL,0.00,30,NULL,'Initial consultation completed. Patient engaged and motivated.','{\"consent_form\": true, \"medical_history\": true}','{\"consultation_complete\": true}',NULL,NULL,'2026-04-24 13:22:35','2026-04-24 13:22:35',NULL),('appt-010','clinic-004','contact-010','user-009','2026-05-04 16:00:00','Scheduled','consult',NULL,0.00,30,NULL,NULL,'{\"consent_form\": true, \"medical_history\": true}',NULL,NULL,NULL,'2026-04-24 13:22:35','2026-04-24 13:22:35',NULL);
/*!40000 ALTER TABLE `appointment` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `attribution`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `attribution` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `contact_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `campaign_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `channel` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `touchpoint_date` datetime DEFAULT NULL,
  `conversion_date` datetime DEFAULT NULL,
  `value` decimal(12,2) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_clinic_id` (`clinic_id`),
  KEY `idx_contact_id` (`contact_id`),
  KEY `idx_campaign_id` (`campaign_id`),
  KEY `idx_touchpoint_date` (`touchpoint_date`),
  KEY `idx_deleted_at` (`deleted_at`),
  CONSTRAINT `attribution_ibfk_1` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `attribution_ibfk_2` FOREIGN KEY (`contact_id`) REFERENCES `contact` (`id`) ON DELETE CASCADE,
  CONSTRAINT `attribution_ibfk_3` FOREIGN KEY (`campaign_id`) REFERENCES `campaign` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `attribution` WRITE;
/*!40000 ALTER TABLE `attribution` DISABLE KEYS */;
INSERT INTO `attribution` VALUES ('attr-001','clinic-001','contact-001','campaign-001','email','2026-04-10 09:00:00',NULL,1500.00,'2026-04-24 13:23:20','2026-04-24 13:23:20',NULL),('attr-002','clinic-001','contact-002','campaign-001','email','2026-04-12 10:30:00','2026-04-15 14:00:00',2000.00,'2026-04-24 13:23:20','2026-04-24 13:23:20',NULL),('attr-003','clinic-001','contact-003','campaign-002','referral','2026-03-15 11:00:00',NULL,1500.00,'2026-04-24 13:23:20','2026-04-24 13:23:20',NULL),('attr-004','clinic-001','contact-004','campaign-004','email','2026-04-20 15:00:00',NULL,1200.00,'2026-04-24 13:23:20','2026-04-24 13:23:20',NULL),('attr-005','clinic-002','contact-005','campaign-005','email','2026-05-05 09:30:00',NULL,1800.00,'2026-04-24 13:23:20','2026-04-24 13:23:20',NULL),('attr-006','clinic-002','contact-006','campaign-006','event','2026-05-10 10:00:00',NULL,2500.00,'2026-04-24 13:23:20','2026-04-24 13:23:20',NULL),('attr-007','clinic-003','contact-007','campaign-007','social','2026-04-05 14:00:00',NULL,2200.00,'2026-04-24 13:23:20','2026-04-24 13:23:20',NULL),('attr-008','clinic-003','contact-008','campaign-008','email','2026-04-15 11:30:00',NULL,1900.00,'2026-04-24 13:23:20','2026-04-24 13:23:20',NULL),('attr-009','clinic-004','contact-009','campaign-009','social','2026-04-10 13:00:00',NULL,2100.00,'2026-04-24 13:23:20','2026-04-24 13:23:20',NULL),('attr-010','clinic-005','contact-010','campaign-010','email','2026-04-25 09:00:00',NULL,1600.00,'2026-04-24 13:23:20','2026-04-24 13:23:20',NULL);
/*!40000 ALTER TABLE `attribution` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `audit_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_log` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `action` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `entity_type` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `entity_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `changes` json DEFAULT NULL,
  `ip_address` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_clinic_id` (`clinic_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_action` (`action`),
  KEY `idx_entity_type` (`entity_type`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_deleted_at` (`deleted_at`),
  CONSTRAINT `audit_log_ibfk_1` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `audit_log_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `audit_log` WRITE;
/*!40000 ALTER TABLE `audit_log` DISABLE KEYS */;
INSERT INTO `audit_log` VALUES ('audit-001','clinic-001','user-001','CREATE','contact','contact-001','{\"email\": \" john.doe@email.com \", \"last_name\": \"Doe\", \"first_name\": \"John\"}','192.168.1.100','Mozilla/5.0','2026-04-24 13:23:36',NULL),('audit-002','clinic-001','user-002','UPDATE','appointment','appt-001','{\"status\": \"Scheduled\"}','192.168.1.101','Mozilla/5.0','2026-04-24 13:23:36',NULL),('audit-003','clinic-001','user-001','CREATE','clinical_note','note-001','{\"content\": \"Patient presents with lower back pain\"}','192.168.1.100','Mozilla/5.0','2026-04-24 13:23:36',NULL),('audit-004','clinic-001','user-002','UPDATE','treatment','treat-001','{\"outcome\": null}','192.168.1.101','Mozilla/5.0','2026-04-24 13:23:36',NULL),('audit-005','clinic-002','user-004','CREATE','contact','contact-005','{\"last_name\": \"Johnson\", \"first_name\": \"Michael\"}','192.168.1.102','Mozilla/5.0','2026-04-24 13:23:36',NULL),('audit-006','clinic-002','user-005','UPDATE','appointment','appt-005','{\"status\": \"Completed\"}','192.168.1.103','Mozilla/5.0','2026-04-24 13:23:36',NULL),('audit-007','clinic-003','user-006','DELETE','clinical_note','note-007','{\"deleted_at\": \"2026-04-24\"}','192.168.1.104','Mozilla/5.0','2026-04-24 13:23:36',NULL),('audit-008','clinic-003','user-007','CREATE','treatment','treat-007','{\"name\": \"Hamstring strain rehabilitation\"}','192.168.1.105','Mozilla/5.0','2026-04-24 13:23:36',NULL),('audit-009','clinic-004','user-008','UPDATE','contact','contact-009','{\"status\": \"active\"}','192.168.1.106','Mozilla/5.0','2026-04-24 13:23:36',NULL),('audit-010','clinic-004','user-010','CREATE','appointment','appt-010','{\"title\": \"Therapy Session\"}','192.168.1.107','Mozilla/5.0','2026-04-24 13:23:36',NULL);
/*!40000 ALTER TABLE `audit_log` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `automation`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `automation` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `trigger_type` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `actions` json DEFAULT NULL,
  `is_enabled` tinyint(1) DEFAULT '1',
  `created_by` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `created_by` (`created_by`),
  KEY `idx_clinic_id` (`clinic_id`),
  KEY `idx_is_enabled` (`is_enabled`),
  KEY `idx_deleted_at` (`deleted_at`),
  CONSTRAINT `automation_ibfk_1` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `automation_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `automation` WRITE;
/*!40000 ALTER TABLE `automation` DISABLE KEYS */;
INSERT INTO `automation` VALUES ('automation-001','clinic-001','Appointment Reminder Email','Send email reminder 24 hours before appointment','appointment_scheduled','[\"send_email\"]',1,'user-001','2026-04-24 13:26:27','2026-04-24 13:26:27',NULL),('automation-002','clinic-001','No-Show SMS Alert','Send SMS alert when patient no-shows','appointment_no_show','[\"send_sms\"]',1,'user-001','2026-04-24 13:26:27','2026-04-24 13:26:27',NULL),('automation-003','clinic-001','New Patient Welcome','Send welcome email to new patients','contact_created','[\"send_email\"]',1,'user-001','2026-04-24 13:26:27','2026-04-24 13:26:27',NULL),('automation-004','clinic-001','Treatment Completion Notification','Notify clinician when treatment is completed','treatment_completed','[\"send_notification\"]',1,'user-001','2026-04-24 13:26:27','2026-04-24 13:26:27',NULL),('automation-005','clinic-002','Appointment Confirmation SMS','Send SMS confirmation after booking','appointment_booked','[\"send_sms\"]',1,'user-004','2026-04-24 13:26:27','2026-04-24 13:26:27',NULL),('automation-006','clinic-002','Payment Receipt Email','Send payment receipt after successful payment','payment_completed','[\"send_email\"]',1,'user-004','2026-04-24 13:26:27','2026-04-24 13:26:27',NULL),('automation-007','clinic-003','Slack Alert for No-Shows','Post Slack alert when patient no-shows','appointment_no_show','[\"post_slack\"]',1,'user-006','2026-04-24 13:26:27','2026-04-24 13:26:27',NULL),('automation-008','clinic-003','Automated Follow-up Email','Send follow-up email after appointment','appointment_completed','[\"send_email\"]',1,'user-006','2026-04-24 13:26:27','2026-04-24 13:26:27',NULL),('automation-009','clinic-004','Patient Survey Request','Request patient feedback via email','appointment_completed','[\"send_survey\"]',1,'user-008','2026-04-24 13:26:27','2026-04-24 13:26:27',NULL),('automation-010','clinic-005','Calendar Sync','Sync appointments to Google Calendar','appointment_created','[\"sync_calendar\"]',1,'user-010','2026-04-24 13:26:27','2026-04-24 13:26:27',NULL);
/*!40000 ALTER TABLE `automation` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `background_job_run`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `background_job_run` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `job_key` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('started','completed','failed') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'started',
  `triggered_by` enum('schedule','manual') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'schedule',
  `started_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `completed_at` datetime DEFAULT NULL,
  `duration_ms` int DEFAULT NULL,
  `error_message` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `metadata` json DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_background_job_run_job_started` (`job_key`,`started_at`),
  KEY `idx_background_job_run_status_started` (`status`,`started_at`),
  CONSTRAINT `fk_background_job_run_state` FOREIGN KEY (`job_key`) REFERENCES `background_job_state` (`job_key`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `background_job_run` WRITE;
/*!40000 ALTER TABLE `background_job_run` DISABLE KEYS */;
/*!40000 ALTER TABLE `background_job_run` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `background_job_state`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `background_job_state` (
  `job_key` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('active','paused','error') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `last_run_at` datetime DEFAULT NULL,
  `next_run_at` datetime DEFAULT NULL,
  `last_status` enum('started','completed','failed') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `last_duration_ms` int DEFAULT NULL,
  `last_error_message` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `success_count` int NOT NULL DEFAULT '0',
  `failure_count` int NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`job_key`),
  KEY `idx_background_job_state_status_next` (`status`,`next_run_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `background_job_state` WRITE;
/*!40000 ALTER TABLE `background_job_state` DISABLE KEYS */;
/*!40000 ALTER TABLE `background_job_state` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `backup_run`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `backup_run` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('started','completed','failed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'started',
  `file_path` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `storage_provider` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'local',
  `size_bytes` bigint DEFAULT NULL,
  `checksum_sha256` char(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `started_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `completed_at` datetime DEFAULT NULL,
  `error_message` text COLLATE utf8mb4_unicode_ci,
  `created_by` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_backup_run_status_started` (`status`,`started_at`),
  KEY `idx_backup_run_created_by` (`created_by`),
  CONSTRAINT `fk_backup_run_created_by` FOREIGN KEY (`created_by`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `backup_run` WRITE;
/*!40000 ALTER TABLE `backup_run` DISABLE KEYS */;
/*!40000 ALTER TABLE `backup_run` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `call_tracking_number`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `call_tracking_number` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone_number` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `normalized_number` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `label` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_call_tracking_number_clinic_phone` (`clinic_id`,`normalized_number`),
  KEY `idx_call_tracking_number_lookup` (`normalized_number`,`is_active`),
  CONSTRAINT `fk_call_tracking_number_clinic` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `call_tracking_number` WRITE;
/*!40000 ALTER TABLE `call_tracking_number` DISABLE KEYS */;
/*!40000 ALTER TABLE `call_tracking_number` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `campaign`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `campaign` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'draft',
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `budget` decimal(12,2) DEFAULT NULL,
  `channel` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_clinic_campaign` (`clinic_id`,`name`),
  KEY `idx_clinic_id` (`clinic_id`),
  KEY `idx_status` (`status`),
  KEY `idx_deleted_at` (`deleted_at`),
  CONSTRAINT `campaign_ibfk_1` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `campaign` WRITE;
/*!40000 ALTER TABLE `campaign` DISABLE KEYS */;
INSERT INTO `campaign` VALUES ('campaign-001','clinic-001','Spring Wellness Promotion','Promote wellness programs for spring','email','active','2026-04-01','2026-05-31',2000.00,'email','2026-04-24 13:23:13','2026-04-24 13:23:13',NULL),('campaign-002','clinic-001','New Patient Referral','Encourage referrals from existing patients','referral','active','2026-03-01','2026-06-30',500.00,'referral','2026-04-24 13:23:13','2026-04-24 13:23:13',NULL),('campaign-003','clinic-001','Recovery Program Launch','Launch new recovery program','social_media','draft','2026-02-01','2026-03-31',1500.00,'social','2026-04-24 13:23:13','2026-04-24 13:23:13',NULL),('campaign-004','clinic-001','Patient Retention','Retain existing patients with special offers','email','active','2026-04-15','2026-06-15',1000.00,'email','2026-04-24 13:23:13','2026-04-24 13:23:13',NULL),('campaign-005','clinic-002','Summer Sports Medicine','Promote sports medicine services for summer','email','active','2026-05-01','2026-08-31',2500.00,'email','2026-04-24 13:23:13','2026-04-24 13:23:13',NULL),('campaign-006','clinic-002','Injury Prevention Workshop','Educational workshop on injury prevention','event','draft','2026-05-20','2026-05-20',3000.00,'event','2026-04-24 13:23:13','2026-04-24 13:23:13',NULL),('campaign-007','clinic-003','Chronic Pain Management','Awareness campaign for pain management','social_media','active','2026-04-01','2026-06-30',1200.00,'social','2026-04-24 13:23:13','2026-04-24 13:23:13',NULL),('campaign-008','clinic-003','Rehabilitation Success Stories','Share patient success stories','email','active','2026-04-10','2026-05-31',800.00,'email','2026-04-24 13:23:13','2026-04-24 13:23:13',NULL),('campaign-009','clinic-004','Mental Health Awareness','Mental health support campaign','social_media','active','2026-04-01','2026-06-30',1500.00,'social','2026-04-24 13:23:13','2026-04-24 13:23:13',NULL),('campaign-010','clinic-005','Wellness Program Enrollment','Enroll new patients in wellness programs','email','active','2026-04-20','2026-06-20',1800.00,'email','2026-04-24 13:23:13','2026-04-24 13:23:13',NULL);
/*!40000 ALTER TABLE `campaign` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `campaign_contact`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `campaign_contact` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `campaign_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `contact_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `engaged_at` timestamp NULL DEFAULT NULL,
  `converted_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_clinic_id` (`clinic_id`),
  KEY `idx_campaign_id` (`campaign_id`),
  KEY `idx_contact_id` (`contact_id`),
  KEY `idx_deleted_at` (`deleted_at`),
  CONSTRAINT `campaign_contact_ibfk_1` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `campaign_contact_ibfk_2` FOREIGN KEY (`campaign_id`) REFERENCES `campaign` (`id`) ON DELETE CASCADE,
  CONSTRAINT `campaign_contact_ibfk_3` FOREIGN KEY (`contact_id`) REFERENCES `contact` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `campaign_contact` WRITE;
/*!40000 ALTER TABLE `campaign_contact` DISABLE KEYS */;
INSERT INTO `campaign_contact` VALUES ('cc-001','clinic-001','campaign-001','contact-001','engaged','2026-04-10 08:00:00',NULL,'2026-04-24 13:23:13','2026-04-24 13:23:13',NULL),('cc-002','clinic-001','campaign-001','contact-002','engaged','2026-04-12 09:30:00','2026-04-15 13:00:00','2026-04-24 13:23:13','2026-04-24 13:23:13',NULL),('cc-003','clinic-001','campaign-002','contact-003','enrolled','2026-03-15 11:00:00',NULL,'2026-04-24 13:23:13','2026-04-24 13:23:13',NULL),('cc-004','clinic-001','campaign-004','contact-004','enrolled','2026-04-20 14:00:00',NULL,'2026-04-24 13:23:13','2026-04-24 13:23:13',NULL),('cc-005','clinic-002','campaign-005','contact-005','engaged','2026-05-05 08:30:00',NULL,'2026-04-24 13:23:13','2026-04-24 13:23:13',NULL),('cc-006','clinic-002','campaign-006','contact-006','enrolled','2026-05-10 09:00:00',NULL,'2026-04-24 13:23:13','2026-04-24 13:23:13',NULL),('cc-007','clinic-003','campaign-007','contact-007','engaged','2026-04-05 13:00:00',NULL,'2026-04-24 13:23:13','2026-04-24 13:23:13',NULL),('cc-008','clinic-003','campaign-008','contact-008','engaged','2026-04-15 10:30:00',NULL,'2026-04-24 13:23:13','2026-04-24 13:23:13',NULL),('cc-009','clinic-004','campaign-009','contact-009','engaged','2026-04-10 12:00:00',NULL,'2026-04-24 13:23:13','2026-04-24 13:23:13',NULL),('cc-010','clinic-005','campaign-010','contact-010','engaged','2026-04-25 08:00:00',NULL,'2026-04-24 13:23:13','2026-04-24 13:23:13',NULL);
/*!40000 ALTER TABLE `campaign_contact` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `clinic`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `clinic` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `website` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `address` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `city` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `state` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `postal_code` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `country` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `timezone` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'UTC',
  `subscription_plan` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'free',
  `subscription_status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'active',
  `stripe_customer_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `stripe_subscription_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `plan_expires_at` timestamp NULL DEFAULT NULL,
  `max_users` int DEFAULT '5',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_deleted_at` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `clinic` WRITE;
/*!40000 ALTER TABLE `clinic` DISABLE KEYS */;
INSERT INTO `clinic` VALUES ('clinic-001','Wellness Clinic London',' info@wellnessclinic.co.uk ',NULL,'020 7946 0958','123 Oxford St','London','England','W1A 1AA','UK','Europe/London','professional','active',NULL,NULL,NULL,20,'2026-04-24 13:22:11','2026-04-24 13:22:11',NULL),('clinic-002','Manchester Health Centre',' hello@manchesterhc.co.uk ',NULL,'0161 234 5678','456 Deansgate','Manchester','England','M1 2AA','UK','Europe/London','professional','active',NULL,NULL,NULL,20,'2026-04-24 13:22:11','2026-04-24 13:22:11',NULL),('clinic-003','Edinburgh Physio',' contact@edinburghphysio.co.uk ',NULL,'0131 225 1550','789 Princes St','Edinburgh','Scotland','EH2 2ER','UK','Europe/London','starter','active',NULL,NULL,NULL,10,'2026-04-24 13:22:11','2026-04-24 13:22:11',NULL),('clinic-004','Bristol Wellness Hub',' info@bristolwellness.co.uk ',NULL,'0117 929 2000','321 Park St','Bristol','England','BS1 5LL','UK','Europe/London','professional','active',NULL,NULL,NULL,20,'2026-04-24 13:22:11','2026-04-24 13:22:11',NULL),('clinic-005','Leeds Rehabilitation',' hello@leedsrehab.co.uk ',NULL,'0113 242 8283','654 City Square','Leeds','England','LS1 1NN','UK','Europe/London','professional','active',NULL,NULL,NULL,20,'2026-04-24 13:22:11','2026-04-24 13:22:11',NULL),('clinic-006','Birmingham Sports Clinic',' info@birminghamsports.co.uk ',NULL,'0121 236 8000','987 Corporation St','Birmingham','England','B4 6AE','UK','Europe/London','starter','active',NULL,NULL,NULL,10,'2026-04-24 13:22:11','2026-04-24 13:22:11',NULL),('clinic-007','Glasgow Health Partners',' contact@glasgowhp.co.uk ',NULL,'0141 332 9999','111 Sauchiehall St','Glasgow','Scotland','G2 3PQ','UK','Europe/London','professional','active',NULL,NULL,NULL,20,'2026-04-24 13:22:11','2026-04-24 13:22:11',NULL),('clinic-008','Liverpool Therapy Centre',' hello@liverpooltc.co.uk ',NULL,'0151 707 1111','222 Bold St','Liverpool','England','L1 4DS','UK','Europe/London','starter','active',NULL,NULL,NULL,10,'2026-04-24 13:22:11','2026-04-24 13:22:11',NULL),('clinic-009','Newcastle Wellness',' info@newcastlewellness.co.uk ',NULL,'0191 232 2222','333 Grey St','Newcastle','England','NE1 6EE','UK','Europe/London','professional','active',NULL,NULL,NULL,20,'2026-04-24 13:22:11','2026-04-24 13:22:11',NULL),('clinic-010','Sheffield Care Clinic',' contact@sheffieldcare.co.uk ',NULL,'0114 276 3333','444 Fargate','Sheffield','England','S1 2AD','UK','Europe/London','starter','active',NULL,NULL,NULL,10,'2026-04-24 13:22:11','2026-04-24 13:22:11',NULL);
/*!40000 ALTER TABLE `clinic` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `clinic_location`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `clinic_location` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `address` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `city` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `state` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `postal_code` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `country` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `working_hours` json DEFAULT NULL,
  `room_count` int DEFAULT '0',
  `is_primary` tinyint(1) DEFAULT '0',
  `status` enum('active','inactive','coming_soon') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_location_clinic` (`clinic_id`),
  CONSTRAINT `fk_location_clinic` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `clinic_location` WRITE;
/*!40000 ALTER TABLE `clinic_location` DISABLE KEYS */;
/*!40000 ALTER TABLE `clinic_location` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `client_account_profile`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `client_account_profile` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `account_manager_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `active_services` json DEFAULT NULL,
  `onboarding_status` enum('not_started','in_progress','completed','paused') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'not_started',
  `health_status` enum('healthy','attention_needed','at_risk','critical') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'attention_needed',
  `churn_risk` enum('low','medium','high','critical') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'low',
  `renewal_date` date DEFAULT NULL,
  `contract_status` enum('active','trial','pending','paused','cancelled','expired') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `key_notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_by` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `updated_by` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_client_account_profile_clinic` (`clinic_id`),
  KEY `idx_client_account_profile_manager` (`account_manager_id`),
  KEY `fk_client_account_profile_created_by` (`created_by`),
  KEY `fk_client_account_profile_updated_by` (`updated_by`),
  CONSTRAINT `fk_client_account_profile_clinic` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_client_account_profile_created_by` FOREIGN KEY (`created_by`) REFERENCES `user` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_client_account_profile_manager` FOREIGN KEY (`account_manager_id`) REFERENCES `user` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_client_account_profile_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `client_account_profile` WRITE;
/*!40000 ALTER TABLE `client_account_profile` DISABLE KEYS */;
/*!40000 ALTER TABLE `client_account_profile` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `client_account_service`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `client_account_service` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `client_account_profile_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `service_type` enum('ppc','seo','gbp','website','landing_pages','cro','strategy','other') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('onboarding','active','paused','ended','archived') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'onboarding',
  `start_date` date DEFAULT NULL,
  `renewal_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `owner_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `recurring_value` decimal(12,2) DEFAULT NULL,
  `currency` char(3) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'USD',
  `contract_status` enum('active','trial','pending','paused','cancelled','expired') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `archived_at` datetime DEFAULT NULL,
  `created_by` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `updated_by` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_client_account_service_profile` (`client_account_profile_id`),
  KEY `idx_client_account_service_clinic_status` (`clinic_id`,`status`,`archived_at`),
  KEY `idx_client_account_service_renewal` (`clinic_id`,`renewal_date`,`contract_status`),
  KEY `idx_client_account_service_owner` (`owner_id`),
  KEY `fk_client_account_service_created_by` (`created_by`),
  KEY `fk_client_account_service_updated_by` (`updated_by`),
  CONSTRAINT `fk_client_account_service_clinic` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_client_account_service_created_by` FOREIGN KEY (`created_by`) REFERENCES `user` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_client_account_service_owner` FOREIGN KEY (`owner_id`) REFERENCES `user` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_client_account_service_profile` FOREIGN KEY (`client_account_profile_id`) REFERENCES `client_account_profile` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_client_account_service_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `client_account_service` WRITE;
/*!40000 ALTER TABLE `client_account_service` DISABLE KEYS */;
/*!40000 ALTER TABLE `client_account_service` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `clinic_sla_setting`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `clinic_sla_setting` (
  `clinic_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `target_minutes` int NOT NULL DEFAULT '5',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`clinic_id`),
  CONSTRAINT `fk_clinic_sla_setting_clinic` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `clinic_sla_setting` WRITE;
/*!40000 ALTER TABLE `clinic_sla_setting` DISABLE KEYS */;
INSERT INTO `clinic_sla_setting` VALUES ('clinic-001',5,'2026-06-01 22:07:36','2026-06-01 22:07:36'),('clinic-002',5,'2026-06-01 22:07:36','2026-06-01 22:07:36'),('clinic-003',5,'2026-06-01 22:07:36','2026-06-01 22:07:36'),('clinic-004',5,'2026-06-01 22:07:36','2026-06-01 22:07:36'),('clinic-005',5,'2026-06-01 22:07:36','2026-06-01 22:07:36'),('clinic-006',5,'2026-06-01 22:07:36','2026-06-01 22:07:36'),('clinic-007',5,'2026-06-01 22:07:36','2026-06-01 22:07:36'),('clinic-008',5,'2026-06-01 22:07:36','2026-06-01 22:07:36'),('clinic-009',5,'2026-06-01 22:07:36','2026-06-01 22:07:36'),('clinic-010',5,'2026-06-01 22:07:36','2026-06-01 22:07:36');
/*!40000 ALTER TABLE `clinic_sla_setting` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `clinical_note`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `clinical_note` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `contact_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `content` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_clinic_id` (`clinic_id`),
  KEY `idx_contact_id` (`contact_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_deleted_at` (`deleted_at`),
  CONSTRAINT `clinical_note_ibfk_1` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `clinical_note_ibfk_2` FOREIGN KEY (`contact_id`) REFERENCES `contact` (`id`) ON DELETE CASCADE,
  CONSTRAINT `clinical_note_ibfk_3` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `clinical_note` WRITE;
/*!40000 ALTER TABLE `clinical_note` DISABLE KEYS */;
INSERT INTO `clinical_note` VALUES ('note-001','clinic-001','contact-001','user-002','Patient presents with lower back pain. Pain level 7/10. Onset 2 weeks ago after lifting. No previous history. Examination shows muscle tension in lumbar region.','2026-04-24 13:22:35','2026-04-24 13:22:35',NULL),('note-002','clinic-001','contact-002','user-002','Physical examination completed. Range of motion limited in forward flexion. Palpation reveals muscle tension in lumbar region. Recommended stretching and strengthening exercises.','2026-04-24 13:22:35','2026-04-24 13:22:35',NULL),('note-003','clinic-001','contact-003','user-002','Physiotherapy session completed. Performed stretching and strengthening exercises. Patient tolerated well. Pain reduced from 7/10 to 4/10.','2026-04-24 13:22:35','2026-04-24 13:22:35',NULL),('note-004','clinic-001','contact-004','user-002','Patient showing good progress. Pain reduced to 4/10. Mobility improving. Continue current treatment plan. Next review in 2 weeks.','2026-04-24 13:22:35','2026-04-24 13:22:35',NULL),('note-005','clinic-002','contact-005','user-005','New patient consultation. Chief complaint: shoulder pain after sports injury. Acute onset 1 week ago. Rotator cuff strength testing performed.','2026-04-24 13:22:35','2026-04-24 13:22:35',NULL),('note-006','clinic-002','contact-006','user-005','Shoulder mobility assessment. Rotator cuff strength testing performed. Mild impingement noted. Recommend conservative treatment with physiotherapy.','2026-04-24 13:22:35','2026-04-24 13:22:35',NULL),('note-007','clinic-003','contact-007','user-007','Sports injury assessment. Patient is rugby player. Hamstring strain suspected. Immediate ice and rest recommended. Return to sport timeline: 4-6 weeks.','2026-04-24 13:22:35','2026-04-24 13:22:35',NULL),('note-008','clinic-003','contact-008','user-007','Chronic pain management session. Applied manual therapy and prescribed home exercises. Patient educated on pain management strategies and coping mechanisms.','2026-04-24 13:22:35','2026-04-24 13:22:35',NULL),('note-009','clinic-004','contact-009','user-008','Initial mental health consultation. Patient reports anxiety and stress. Sleep disturbance noted. Recommended cognitive behavioral therapy and stress management techniques.','2026-04-24 13:22:35','2026-04-24 13:22:35',NULL),('note-010','clinic-004','contact-010','user-009','Therapy progress review. Patient responding well to treatment. Coping mechanisms improving. Continue weekly sessions. Patient showing positive progress.','2026-04-24 13:22:35','2026-04-24 13:22:35',NULL);
/*!40000 ALTER TABLE `clinical_note` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `clinician_availability`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `clinician_availability` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinician_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `day_of_week` tinyint NOT NULL,
  `start_time` time NOT NULL,
  `end_time` time NOT NULL,
  `slot_interval_minutes` int NOT NULL DEFAULT '30',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_clinician_availability_window` (`clinic_id`,`clinician_id`,`day_of_week`,`start_time`,`deleted_at`),
  KEY `idx_clinician_availability_lookup` (`clinic_id`,`clinician_id`,`day_of_week`,`is_active`,`deleted_at`),
  KEY `fk_clinician_availability_user` (`clinician_id`),
  CONSTRAINT `fk_clinician_availability_clinic` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_clinician_availability_user` FOREIGN KEY (`clinician_id`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `clinician_availability` WRITE;
/*!40000 ALTER TABLE `clinician_availability` DISABLE KEYS */;
/*!40000 ALTER TABLE `clinician_availability` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `communication_sequence`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `communication_sequence` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `trigger_label` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `steps` json NOT NULL,
  `status` enum('active','paused','draft','archived') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft',
  `enrolled_count` int NOT NULL DEFAULT '0',
  `completed_count` int NOT NULL DEFAULT '0',
  `created_by` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_cs_clinic` (`clinic_id`),
  KEY `fk_cs_user` (`created_by`),
  CONSTRAINT `fk_cs_clinic` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_cs_user` FOREIGN KEY (`created_by`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `communication_sequence` WRITE;
/*!40000 ALTER TABLE `communication_sequence` DISABLE KEYS */;
/*!40000 ALTER TABLE `communication_sequence` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `competitor`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `competitor` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `url` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `key_treatments` json NOT NULL,
  `price_position` enum('Budget','Mid-range','Premium') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Mid-range',
  `offer` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `messaging_angle` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `ad_presence` json NOT NULL,
  `seo_strength` enum('Strong','Medium','Weak') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Weak',
  `rating` decimal(3,1) NOT NULL DEFAULT '0.0',
  `reviews` int NOT NULL DEFAULT '0',
  `created_by` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_competitor_clinic` (`clinic_id`),
  KEY `fk_competitor_user` (`created_by`),
  CONSTRAINT `fk_competitor_clinic` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_competitor_user` FOREIGN KEY (`created_by`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `competitor` WRITE;
/*!40000 ALTER TABLE `competitor` DISABLE KEYS */;
/*!40000 ALTER TABLE `competitor` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `compliance_document`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `compliance_document` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('complete','action_required','expiring_soon') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'action_required',
  `category` enum('gdpr','clinical','training','insurance','regulatory') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'regulatory',
  `due_date` date DEFAULT NULL,
  `created_by` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_compliance_document_clinic` (`clinic_id`),
  KEY `fk_compliance_document_user` (`created_by`),
  CONSTRAINT `fk_compliance_document_clinic` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_compliance_document_user` FOREIGN KEY (`created_by`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `compliance_document` WRITE;
/*!40000 ALTER TABLE `compliance_document` DISABLE KEYS */;
/*!40000 ALTER TABLE `compliance_document` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `compliance_setting`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `compliance_setting` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `key_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `value_json` json NOT NULL,
  `updated_by` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_compliance_setting` (`clinic_id`,`key_name`),
  KEY `fk_compliance_setting_user` (`updated_by`),
  CONSTRAINT `fk_compliance_setting_clinic` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_compliance_setting_user` FOREIGN KEY (`updated_by`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `compliance_setting` WRITE;
/*!40000 ALTER TABLE `compliance_setting` DISABLE KEYS */;
/*!40000 ALTER TABLE `compliance_setting` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `consent`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `consent` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `contact_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `consent_date` date DEFAULT NULL,
  `expiry_date` date DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_clinic_id` (`clinic_id`),
  KEY `idx_contact_id` (`contact_id`),
  KEY `idx_status` (`status`),
  KEY `idx_deleted_at` (`deleted_at`),
  CONSTRAINT `consent_ibfk_1` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `consent_ibfk_2` FOREIGN KEY (`contact_id`) REFERENCES `contact` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `consent` WRITE;
/*!40000 ALTER TABLE `consent` DISABLE KEYS */;
INSERT INTO `consent` VALUES ('consent-001','clinic-001','contact-001','treatment','active','2026-04-20','2027-04-20','2026-04-24 13:23:36','2026-04-24 13:23:36',NULL),('consent-002','clinic-001','contact-002','treatment','active','2026-04-15','2027-04-15','2026-04-24 13:23:36','2026-04-24 13:23:36',NULL),('consent-003','clinic-001','contact-003','treatment','active','2026-03-01','2027-03-01','2026-04-24 13:23:36','2026-04-24 13:23:36',NULL),('consent-004','clinic-001','contact-004','marketing','inactive','2026-04-10','2027-04-10','2026-04-24 13:23:36','2026-04-24 13:23:36',NULL),('consent-005','clinic-002','contact-005','treatment','active','2026-04-18','2027-04-18','2026-04-24 13:23:36','2026-04-24 13:23:36',NULL),('consent-006','clinic-002','contact-006','treatment','active','2026-04-19','2027-04-19','2026-04-24 13:23:36','2026-04-24 13:23:36',NULL),('consent-007','clinic-003','contact-007','treatment','active','2026-04-22','2027-04-22','2026-04-24 13:23:36','2026-04-24 13:23:36',NULL),('consent-008','clinic-003','contact-008','marketing','active','2026-02-01','2027-02-01','2026-04-24 13:23:36','2026-04-24 13:23:36',NULL),('consent-009','clinic-004','contact-009','treatment','active','2026-04-21','2027-04-21','2026-04-24 13:23:36','2026-04-24 13:23:36',NULL),('consent-010','clinic-004','contact-010','treatment','active','2026-04-01','2027-04-01','2026-04-24 13:23:36','2026-04-24 13:23:36',NULL);
/*!40000 ALTER TABLE `consent` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `consult_template`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `consult_template` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `content` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_by` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_clinic_template` (`clinic_id`,`name`),
  KEY `created_by` (`created_by`),
  KEY `idx_clinic_id` (`clinic_id`),
  KEY `idx_deleted_at` (`deleted_at`),
  CONSTRAINT `consult_template_ibfk_1` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `consult_template_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `consult_template` WRITE;
/*!40000 ALTER TABLE `consult_template` DISABLE KEYS */;
INSERT INTO `consult_template` VALUES ('template-001','clinic-001','Initial Consultation','{\"sections\":[\"patient_history\",\"chief_complaint\",\"vital_signs\",\"physical_exam\",\"assessment\",\"plan\"]}','user-001','2026-04-24 13:27:18','2026-04-24 13:27:18',NULL),('template-002','clinic-001','Follow-up Consultation','{\"sections\":[\"progress_review\",\"symptom_check\",\"treatment_response\",\"next_steps\"]}','user-001','2026-04-24 13:27:18','2026-04-24 13:27:18',NULL),('template-003','clinic-001','Discharge Summary','{\"sections\":[\"treatment_summary\",\"outcomes\",\"recommendations\",\"follow_up\"]}','user-001','2026-04-24 13:27:18','2026-04-24 13:27:18',NULL),('template-004','clinic-002','Sports Injury Assessment','{\"sections\":[\"injury_mechanism\",\"pain_assessment\",\"movement_testing\",\"diagnosis\",\"rehab_plan\"]}','user-004','2026-04-24 13:27:18','2026-04-24 13:27:18',NULL),('template-005','clinic-002','Treatment Plan','{\"sections\":[\"goals\",\"interventions\",\"frequency\",\"duration\",\"expected_outcomes\"]}','user-004','2026-04-24 13:27:18','2026-04-24 13:27:18',NULL),('template-006','clinic-003','Pain Management Consultation','{\"sections\":[\"pain_history\",\"pain_scale\",\"impact_assessment\",\"coping_strategies\",\"treatment_options\"]}','user-006','2026-04-24 13:27:18','2026-04-24 13:27:18',NULL),('template-007','clinic-003','Rehabilitation Progress','{\"sections\":[\"current_status\",\"progress_metrics\",\"exercises\",\"adherence\",\"next_goals\"]}','user-006','2026-04-24 13:27:18','2026-04-24 13:27:18',NULL),('template-008','clinic-004','Mental Health Assessment','{\"sections\":[\"presenting_issue\",\"mental_status\",\"risk_assessment\",\"diagnosis\",\"treatment_plan\"]}','user-008','2026-04-24 13:27:18','2026-04-24 13:27:18',NULL),('template-009','clinic-004','Therapy Session Notes','{\"sections\":[\"session_focus\",\"interventions\",\"patient_response\",\"homework\",\"next_session_plan\"]}','user-008','2026-04-24 13:27:18','2026-04-24 13:27:18',NULL),('template-010','clinic-005','Wellness Program Enrollment','{\"sections\":[\"health_goals\",\"baseline_assessment\",\"program_selection\",\"expectations\",\"commitment\"]}','user-010','2026-04-24 13:27:18','2026-04-24 13:27:18',NULL);
/*!40000 ALTER TABLE `consult_template` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `contact`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `contact` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `first_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `last_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `date_of_birth` date DEFAULT NULL,
  `gender` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `address` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `city` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `state` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `postal_code` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `country` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tags` json DEFAULT NULL,
  `status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'active',
  `source` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `value` decimal(12,2) NOT NULL DEFAULT '0.00',
  `treatment_interests` json DEFAULT NULL,
  `external_id` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `import_batch_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `last_contact_at` datetime DEFAULT NULL,
  `sla_target_minutes` int DEFAULT NULL,
  `sla_deadline_at` datetime DEFAULT NULL,
  `first_response_at` datetime DEFAULT NULL,
  `first_response_by` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sla_breached_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_clinic_id` (`clinic_id`),
  KEY `idx_email_clinic` (`clinic_id`,`email`),
  KEY `idx_phone_clinic` (`clinic_id`,`phone`),
  KEY `idx_contact_status` (`clinic_id`,`status`),
  KEY `idx_contact_source` (`clinic_id`,`source`),
  KEY `idx_contact_last_contact` (`clinic_id`,`last_contact_at`),
  KEY `idx_contact_sla_queue` (`clinic_id`,`first_response_at`,`sla_deadline_at`),
  KEY `idx_contact_first_response_by` (`first_response_by`),
  KEY `idx_contact_external_id` (`clinic_id`,`external_id`),
  KEY `idx_contact_import_batch` (`import_batch_id`),
  KEY `idx_deleted_at` (`deleted_at`),
  CONSTRAINT `contact_ibfk_1` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_contact_first_response_by` FOREIGN KEY (`first_response_by`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `contact` WRITE;
/*!40000 ALTER TABLE `contact` DISABLE KEYS */;
INSERT INTO `contact` VALUES ('contact-001','clinic-001','John','Doe',' john.doe@email.com ','07700 900001','1985-03-15','M','10 Main St','London','England','SW1A 1AA','UK','[\"new\", \"priority\"]','active','referral',0.00,NULL,NULL,NULL,'Initial consultation booked',NULL,5,'2026-04-24 13:27:26',NULL,NULL,NULL,'2026-04-24 13:22:26','2026-06-01 22:07:36',NULL),('contact-002','clinic-001','Jane','Smith',' jane.smith@email.com ','07700 900002','1990-07-22','F','20 High St','London','England','SW1A 2AA','UK','[\"returning\"]','active','website',0.00,NULL,NULL,NULL,'Regular patient',NULL,5,'2026-04-24 13:27:26',NULL,NULL,NULL,'2026-04-24 13:22:26','2026-06-01 22:07:36',NULL),('contact-003','clinic-001','Robert','Williams',' robert.w@email.com ','07700 900003','1978-11-08','M','30 Park Lane','London','England','SW1A 3AA','UK','[\"vip\"]','active','referral',0.00,NULL,NULL,NULL,'Long-term patient',NULL,5,'2026-04-24 13:27:26',NULL,NULL,NULL,'2026-04-24 13:22:26','2026-06-01 22:07:36',NULL),('contact-004','clinic-001','Patricia','Brown',' patricia.b@email.com ','07700 900004','1988-05-30','F','40 Oxford St','London','England','SW1A 4AA','UK','[]','inactive','website',0.00,NULL,NULL,NULL,'Inactive for 6 months',NULL,5,'2026-04-24 13:27:26',NULL,NULL,NULL,'2026-04-24 13:22:26','2026-06-01 22:07:36',NULL),('contact-005','clinic-002','Michael','Johnson',' michael.j@email.com ','07700 900005','1982-09-12','M','50 Deansgate','Manchester','England','M1 1AA','UK','[\"new\"]','active','phone',0.00,NULL,NULL,NULL,'Sports injury patient',NULL,5,'2026-04-24 13:27:26',NULL,NULL,NULL,'2026-04-24 13:22:26','2026-06-01 22:07:36',NULL),('contact-006','clinic-002','Sarah','Davis',' sarah.d@email.com ','07700 900006','1995-01-25','F','60 Market St','Manchester','England','M1 2AA','UK','[\"returning\"]','active','referral',0.00,NULL,NULL,NULL,'Regular wellness visits',NULL,5,'2026-04-24 13:27:26',NULL,NULL,NULL,'2026-04-24 13:22:26','2026-06-01 22:07:36',NULL),('contact-007','clinic-003','David','Miller',' david.m@email.com ','07700 900007','1980-12-03','M','70 Princes St','Edinburgh','Scotland','EH2 1AA','UK','[\"new\", \"vip\"]','active','website',0.00,NULL,NULL,NULL,'Rugby player',NULL,5,'2026-04-24 13:27:26',NULL,NULL,NULL,'2026-04-24 13:22:26','2026-06-01 22:07:36',NULL),('contact-008','clinic-003','Emma','Wilson',' emma.w@email.com ','07700 900008','1992-06-18','F','80 George St','Edinburgh','Scotland','EH2 2AA','UK','[\"returning\"]','active','referral',0.00,NULL,NULL,NULL,'Chronic pain management',NULL,5,'2026-04-24 13:27:26',NULL,NULL,NULL,'2026-04-24 13:22:26','2026-06-01 22:07:36',NULL),('contact-009','clinic-004','Christopher','Taylor',' chris.t@email.com ','07700 900009','1987-04-09','M','90 Park St','Bristol','England','BS1 1AA','UK','[\"new\"]','active','website',0.00,NULL,NULL,NULL,'Mental health support',NULL,5,'2026-04-24 13:27:26',NULL,NULL,NULL,'2026-04-24 13:22:26','2026-06-01 22:07:36',NULL),('contact-010','clinic-004','Lisa','Anderson',' lisa.a@email.com ','07700 900010','1993-08-14','F','100 Clifton','Bristol','England','BS1 2AA','UK','[\"returning\"]','active','referral',0.00,NULL,NULL,NULL,'Wellness program member',NULL,5,'2026-04-24 13:27:26',NULL,NULL,NULL,'2026-04-24 13:22:26','2026-06-01 22:07:36',NULL);
/*!40000 ALTER TABLE `contact` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `contact_duplicate_candidate`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `contact_duplicate_candidate` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `import_batch_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `existing_contact_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `candidate_contact_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `match_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `score` int NOT NULL DEFAULT '0',
  `status` enum('open','confirmed_duplicate','not_duplicate','merged','ignored') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'open',
  `candidate_data` json DEFAULT NULL,
  `resolved_by` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `resolved_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_contact_duplicate_clinic_status` (`clinic_id`,`status`),
  KEY `idx_contact_duplicate_import_batch` (`import_batch_id`),
  KEY `idx_contact_duplicate_existing` (`existing_contact_id`),
  KEY `idx_contact_duplicate_candidate` (`candidate_contact_id`),
  KEY `fk_contact_duplicate_resolved_by` (`resolved_by`),
  CONSTRAINT `fk_contact_duplicate_candidate` FOREIGN KEY (`candidate_contact_id`) REFERENCES `contact` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_contact_duplicate_clinic` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_contact_duplicate_existing` FOREIGN KEY (`existing_contact_id`) REFERENCES `contact` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_contact_duplicate_import_batch` FOREIGN KEY (`import_batch_id`) REFERENCES `contact_import_batch` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_contact_duplicate_resolved_by` FOREIGN KEY (`resolved_by`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `contact_duplicate_candidate` WRITE;
/*!40000 ALTER TABLE `contact_duplicate_candidate` DISABLE KEYS */;
/*!40000 ALTER TABLE `contact_duplicate_candidate` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `contact_import_batch`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `contact_import_batch` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_by` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `filename` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('processing','completed','completed_with_errors','failed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'processing',
  `total_rows` int NOT NULL DEFAULT '0',
  `inserted_rows` int NOT NULL DEFAULT '0',
  `updated_rows` int NOT NULL DEFAULT '0',
  `duplicate_rows` int NOT NULL DEFAULT '0',
  `error_rows` int NOT NULL DEFAULT '0',
  `errors` json DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_contact_import_batch_clinic` (`clinic_id`,`created_at`),
  KEY `idx_contact_import_batch_created_by` (`created_by`),
  KEY `idx_contact_import_batch_status` (`status`),
  CONSTRAINT `fk_contact_import_batch_clinic` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_contact_import_batch_created_by` FOREIGN KEY (`created_by`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `contact_import_batch` WRITE;
/*!40000 ALTER TABLE `contact_import_batch` DISABLE KEYS */;
/*!40000 ALTER TABLE `contact_import_batch` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `dashboard`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `dashboard` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `layout` json DEFAULT NULL,
  `widgets` json DEFAULT NULL,
  `created_by` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_clinic_dashboard` (`clinic_id`,`name`),
  KEY `created_by` (`created_by`),
  KEY `idx_clinic_id` (`clinic_id`),
  KEY `idx_deleted_at` (`deleted_at`),
  CONSTRAINT `dashboard_ibfk_1` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `dashboard_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `dashboard` WRITE;
/*!40000 ALTER TABLE `dashboard` DISABLE KEYS */;
INSERT INTO `dashboard` VALUES ('dashboard-001','clinic-001','Executive Overview','High-level clinic metrics','{\"type\": \"grid\", \"columns\": 4}','[\"revenue_card\", \"appointment_card\", \"patient_card\", \"no_show_card\"]','user-001','2026-04-24 13:23:30','2026-04-24 13:23:30',NULL),('dashboard-002','clinic-001','Clinician Dashboard','Clinician-focused metrics','{\"type\": \"grid\", \"columns\": 3}','[\"schedule_widget\", \"patient_list\", \"treatment_progress\", \"notes_widget\"]','user-001','2026-04-24 13:23:30','2026-04-24 13:23:30',NULL),('dashboard-003','clinic-001','Receptionist Dashboard','Receptionist tasks and metrics','{\"type\": \"grid\", \"columns\": 3}','[\"appointment_list\", \"no_show_alerts\", \"contact_search\", \"calendar_widget\"]','user-001','2026-04-24 13:23:30','2026-04-24 13:23:30',NULL),('dashboard-004','clinic-002','Executive Overview','High-level clinic metrics','{\"type\": \"grid\", \"columns\": 4}','[\"revenue_card\", \"appointment_card\", \"patient_card\", \"no_show_card\"]','user-004','2026-04-24 13:23:30','2026-04-24 13:23:30',NULL),('dashboard-005','clinic-002','Financial Dashboard','Financial performance metrics','{\"type\": \"grid\", \"columns\": 4}','[\"revenue_chart\", \"expense_chart\", \"profit_margin\", \"payment_status\"]','user-004','2026-04-24 13:23:30','2026-04-24 13:23:30',NULL),('dashboard-006','clinic-003','Clinical Dashboard','Clinical performance metrics','{\"type\": \"grid\", \"columns\": 3}','[\"treatment_outcomes\", \"patient_progress\", \"appointment_schedule\", \"clinical_notes\"]','user-006','2026-04-24 13:23:30','2026-04-24 13:23:30',NULL),('dashboard-007','clinic-003','Marketing Dashboard','Marketing and campaign metrics','{\"type\": \"grid\", \"columns\": 3}','[\"campaign_performance\", \"roi_chart\", \"contact_engagement\", \"conversion_funnel\"]','user-006','2026-04-24 13:23:30','2026-04-24 13:23:30',NULL),('dashboard-008','clinic-004','Operations Dashboard','Operational metrics','{\"type\": \"grid\", \"columns\": 3}','[\"appointment_trends\", \"staff_schedule\", \"resource_utilization\", \"queue_status\"]','user-008','2026-04-24 13:23:30','2026-04-24 13:23:30',NULL),('dashboard-009','clinic-004','Patient Engagement','Patient engagement metrics','{\"type\": \"grid\", \"columns\": 3}','[\"patient_satisfaction\", \"retention_rate\", \"review_score\", \"engagement_trend\"]','user-008','2026-04-24 13:23:30','2026-04-24 13:23:30',NULL),('dashboard-010','clinic-005','Performance Overview','Overall clinic performance','{\"type\": \"grid\", \"columns\": 4}','[\"kpi_cards\", \"trend_charts\", \"goal_tracking\", \"alerts\"]','user-010','2026-04-24 13:23:30','2026-04-24 13:23:30',NULL);
/*!40000 ALTER TABLE `dashboard` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `deal`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `deal` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `contact_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `pipeline_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `pipeline_stage_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `title` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `value` decimal(12,2) DEFAULT NULL,
  `stage` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `probability` int DEFAULT '0',
  `expected_close_date` date DEFAULT NULL,
  `owner_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `source` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `treatment` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'open',
  `stage_changed_at` datetime DEFAULT NULL,
  `booked_at` datetime DEFAULT NULL,
  `sold_at` datetime DEFAULT NULL,
  `lost_at` datetime DEFAULT NULL,
  `lost_reason` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_by` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_clinic_id` (`clinic_id`),
  KEY `idx_contact_id` (`contact_id`),
  KEY `idx_pipeline_id` (`pipeline_id`),
  KEY `idx_owner_id` (`owner_id`),
  KEY `idx_deal_pipeline_stage` (`clinic_id`,`pipeline_stage_id`),
  KEY `idx_deal_stage_status` (`clinic_id`,`status`,`stage`),
  KEY `idx_deal_stage_changed` (`clinic_id`,`stage_changed_at`),
  KEY `idx_deleted_at` (`deleted_at`),
  KEY `fk_deal_pipeline_stage` (`pipeline_stage_id`),
  KEY `fk_deal_created_by` (`created_by`),
  CONSTRAINT `deal_ibfk_1` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `deal_ibfk_2` FOREIGN KEY (`contact_id`) REFERENCES `contact` (`id`) ON DELETE CASCADE,
  CONSTRAINT `deal_ibfk_3` FOREIGN KEY (`pipeline_id`) REFERENCES `pipeline` (`id`) ON DELETE CASCADE,
  CONSTRAINT `deal_ibfk_4` FOREIGN KEY (`owner_id`) REFERENCES `user` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_deal_created_by` FOREIGN KEY (`created_by`) REFERENCES `user` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_deal_pipeline_stage` FOREIGN KEY (`pipeline_stage_id`) REFERENCES `pipeline_stage` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `deal` WRITE;
/*!40000 ALTER TABLE `deal` DISABLE KEYS */;
INSERT INTO `deal` VALUES ('deal-001','clinic-001','contact-001','pipeline-001',NULL,'John Doe - Initial Consultation',1500.00,'Initial Consultation',75,'2026-05-15','user-002','referral',NULL,'open','2026-04-24 13:22:26',NULL,NULL,NULL,NULL,NULL,'2026-04-24 13:22:26','2026-06-01 22:07:36',NULL),('deal-002','clinic-001','contact-002','pipeline-001',NULL,'Jane Smith - Assessment',2000.00,'Assessment',85,'2026-05-20','user-002','website',NULL,'open','2026-04-24 13:22:26',NULL,NULL,NULL,NULL,NULL,'2026-04-24 13:22:26','2026-06-01 22:07:36',NULL),('deal-003','clinic-001','contact-003','pipeline-002',NULL,'Robert Williams - Active Treatment',3500.00,'Active Treatment',95,'2026-06-30','user-002','referral',NULL,'open','2026-04-24 13:22:26',NULL,NULL,NULL,NULL,NULL,'2026-04-24 13:22:26','2026-06-01 22:07:36',NULL),('deal-004','clinic-001','contact-004','pipeline-003',NULL,'Patricia Brown - Program Start',1200.00,'Program Start',60,'2026-05-10','user-003','website',NULL,'open','2026-04-24 13:22:26',NULL,NULL,NULL,NULL,NULL,'2026-04-24 13:22:26','2026-06-01 22:07:36',NULL),('deal-005','clinic-002','contact-005','pipeline-004',NULL,'Michael Johnson - Consultation Booked',1800.00,'Consultation Booked',70,'2026-05-12','user-005','phone',NULL,'open','2026-04-24 13:22:26',NULL,NULL,NULL,NULL,NULL,'2026-04-24 13:22:26','2026-06-01 22:07:36',NULL),('deal-006','clinic-002','contact-006','pipeline-005',NULL,'Sarah Davis - Treatment Start',2500.00,'Treatment Start',80,'2026-06-15','user-005','referral',NULL,'open','2026-04-24 13:22:26',NULL,NULL,NULL,NULL,NULL,'2026-04-24 13:22:26','2026-06-01 22:07:36',NULL),('deal-007','clinic-003','contact-007','pipeline-006',NULL,'David Miller - Diagnosis',2200.00,'Diagnosis',75,'2026-05-25','user-007','website',NULL,'open','2026-04-24 13:22:26',NULL,NULL,NULL,NULL,NULL,'2026-04-24 13:22:26','2026-06-01 22:07:36',NULL),('deal-008','clinic-003','contact-008','pipeline-007',NULL,'Emma Wilson - Treatment Plan',1900.00,'Treatment Plan',65,'2026-05-18','user-007','referral',NULL,'open','2026-04-24 13:22:26',NULL,NULL,NULL,NULL,NULL,'2026-04-24 13:22:26','2026-06-01 22:07:36',NULL),('deal-009','clinic-004','contact-009','pipeline-008',NULL,'Christopher Taylor - Treatment Plan',2100.00,'Treatment Plan',78,'2026-05-22','user-008','website',NULL,'open','2026-04-24 13:22:26',NULL,NULL,NULL,NULL,NULL,'2026-04-24 13:22:26','2026-06-01 22:07:36',NULL),('deal-010','clinic-004','contact-010','pipeline-009',NULL,'Lisa Anderson - Therapy Start',1600.00,'Therapy Start',72,'2026-05-16','user-009','referral',NULL,'open','2026-04-24 13:22:26',NULL,NULL,NULL,NULL,NULL,'2026-04-24 13:22:26','2026-06-01 22:07:36',NULL);
/*!40000 ALTER TABLE `deal` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `deposit_record`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `deposit_record` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `contact_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `appointment_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `contact_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `treatment` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `appointment_date` date DEFAULT NULL,
  `deposit_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `deposit_paid` tinyint(1) NOT NULL DEFAULT '0',
  `paid_date` date DEFAULT NULL,
  `method` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `showed_up` tinyint(1) DEFAULT NULL,
  `practitioner` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('requested','paid','failed','unpaid','waived','refunded') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'unpaid',
  `reminder_sent` tinyint(1) NOT NULL DEFAULT '0',
  `deposit_requested` tinyint(1) NOT NULL DEFAULT '0',
  `created_by` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `stripe_session_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `stripe_payment_intent_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `stripe_payment_link_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payment_status` enum('requested','paid','failed','refunded','waived','unpaid') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'unpaid',
  `provider_response` json DEFAULT NULL,
  `provider_error` text COLLATE utf8mb4_unicode_ci,
  `payment_attempted_at` datetime DEFAULT NULL,
  `paid_at` datetime DEFAULT NULL,
  `refunded_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_deposit_record_clinic` (`clinic_id`),
  KEY `fk_deposit_record_user` (`created_by`),
  KEY `idx_deposit_record_contact` (`clinic_id`,`contact_id`),
  KEY `idx_deposit_record_appointment` (`clinic_id`,`appointment_id`),
  KEY `fk_deposit_record_contact` (`contact_id`),
  KEY `fk_deposit_record_appointment` (`appointment_id`),
  KEY `idx_deposit_stripe_session` (`stripe_session_id`),
  KEY `idx_deposit_payment_intent` (`stripe_payment_intent_id`),
  KEY `idx_deposit_clinic_payment_status` (`clinic_id`,`payment_status`),
  CONSTRAINT `fk_deposit_record_appointment` FOREIGN KEY (`appointment_id`) REFERENCES `appointment` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_deposit_record_clinic` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_deposit_record_contact` FOREIGN KEY (`contact_id`) REFERENCES `contact` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_deposit_record_user` FOREIGN KEY (`created_by`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `deposit_record` WRITE;
/*!40000 ALTER TABLE `deposit_record` DISABLE KEYS */;
/*!40000 ALTER TABLE `deposit_record` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `document`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `document` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `contact_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_url` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `file_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `file_size` int DEFAULT NULL,
  `uploaded_by` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `uploaded_by` (`uploaded_by`),
  KEY `idx_clinic_id` (`clinic_id`),
  KEY `idx_contact_id` (`contact_id`),
  KEY `idx_deleted_at` (`deleted_at`),
  CONSTRAINT `document_ibfk_1` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `document_ibfk_2` FOREIGN KEY (`contact_id`) REFERENCES `contact` (`id`) ON DELETE CASCADE,
  CONSTRAINT `document_ibfk_3` FOREIGN KEY (`uploaded_by`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `document` WRITE;
/*!40000 ALTER TABLE `document` DISABLE KEYS */;
INSERT INTO `document` VALUES ('doc-001','clinic-001','contact-001','john_doe_medical_history.pdf',' https://storage.example.com/docs/doc-001.pdf ','pdf',245000,'user-001','2026-04-24 13:27:18','2026-04-24 13:27:18',NULL),('doc-002','clinic-001','contact-002','jane_smith_consent.pdf',' https://storage.example.com/docs/doc-002.pdf ','pdf',125000,'user-001','2026-04-24 13:27:18','2026-04-24 13:27:18',NULL),('doc-003','clinic-001','contact-003','robert_williams_treatment_plan.pdf',' https://storage.example.com/docs/doc-003.pdf ','pdf',189000,'user-001','2026-04-24 13:27:18','2026-04-24 13:27:18',NULL),('doc-004','clinic-001','contact-004','patricia_brown_prescription.pdf',' https://storage.example.com/docs/doc-004.pdf ','pdf',95000,'user-001','2026-04-24 13:27:18','2026-04-24 13:27:18',NULL),('doc-005','clinic-002','contact-005','michael_johnson_medical_history.pdf',' https://storage.example.com/docs/doc-005.pdf ','pdf',267000,'user-004','2026-04-24 13:27:18','2026-04-24 13:27:18',NULL),('doc-006','clinic-002','contact-006','sarah_davis_assessment.pdf',' https://storage.example.com/docs/doc-006.pdf ','pdf',156000,'user-004','2026-04-24 13:27:18','2026-04-24 13:27:18',NULL),('doc-007','clinic-003','contact-007','david_miller_injury_assessment.pdf',' https://storage.example.com/docs/doc-007.pdf ','pdf',203000,'user-006','2026-04-24 13:27:18','2026-04-24 13:27:18',NULL),('doc-008','clinic-003','contact-008','emma_wilson_treatment_plan.pdf',' https://storage.example.com/docs/doc-008.pdf ','pdf',178000,'user-006','2026-04-24 13:27:18','2026-04-24 13:27:18',NULL),('doc-009','clinic-004','contact-009','christopher_taylor_consent.pdf',' https://storage.example.com/docs/doc-009.pdf ','pdf',118000,'user-008','2026-04-24 13:27:18','2026-04-24 13:27:18',NULL),('doc-010','clinic-005','contact-010','lisa_anderson_medical_history.pdf',' https://storage.example.com/docs/doc-010.pdf ','pdf',234000,'user-010','2026-04-24 13:27:18','2026-04-24 13:27:18',NULL);
/*!40000 ALTER TABLE `document` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `email`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `email` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `contact_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `subject` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `body` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `direction` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_clinic_id` (`clinic_id`),
  KEY `idx_contact_id` (`contact_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_deleted_at` (`deleted_at`),
  CONSTRAINT `email_ibfk_1` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `email_ibfk_2` FOREIGN KEY (`contact_id`) REFERENCES `contact` (`id`) ON DELETE CASCADE,
  CONSTRAINT `email_ibfk_3` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `email` WRITE;
/*!40000 ALTER TABLE `email` DISABLE KEYS */;
INSERT INTO `email` VALUES ('email-001','clinic-001','contact-001','user-002','Appointment Confirmation','Your appointment is confirmed for 2026-04-28 at 09:00. Please arrive 10 minutes early.','outbound','sent','2026-04-24 13:22:59','2026-04-24 13:22:59',NULL),('email-002','clinic-001','contact-002','user-002','Treatment Progress Update','Great progress on your treatment plan. Keep up with the exercises we discussed.','outbound','sent','2026-04-24 13:22:59','2026-04-24 13:22:59',NULL),('email-003','clinic-001','contact-003','user-002','Exercise Guide','Please find attached your personalized exercise guide for home practice.','outbound','sent','2026-04-24 13:22:59','2026-04-24 13:22:59',NULL),('email-004','clinic-001','contact-004','user-002','Missed Appointment','We noticed you missed your appointment on 2026-05-01. Please reschedule at your earliest convenience.','outbound','sent','2026-04-24 13:22:59','2026-04-24 13:22:59',NULL),('email-005','clinic-002','contact-005','user-005','Welcome to Our Clinic','Welcome! We look forward to helping you with your health goals.','outbound','sent','2026-04-24 13:22:59','2026-04-24 13:22:59',NULL),('email-006','clinic-002','contact-006','user-005','Treatment Plan Details','Your personalized treatment plan has been prepared. Please review the attached document.','outbound','sent','2026-04-24 13:22:59','2026-04-24 13:22:59',NULL),('email-007','clinic-003','contact-007','user-007','Sports Injury Recovery','Your sports injury assessment is complete. Recovery plan attached.','outbound','sent','2026-04-24 13:22:59','2026-04-24 13:22:59',NULL),('email-008','clinic-003','contact-008','user-007','Pain Management Resources','Resources for chronic pain management have been sent to your email.','outbound','sent','2026-04-24 13:22:59','2026-04-24 13:22:59',NULL),('email-009','clinic-004','contact-009','user-008','Initial Consultation Scheduled','Your consultation has been scheduled for 2026-04-25 at 11:00.','outbound','sent','2026-04-24 13:22:59','2026-04-24 13:22:59',NULL),('email-010','clinic-004','contact-010','user-009','Therapy Session Reminder','Reminder: Your therapy session is scheduled for 2026-05-04 at 16:00.','outbound','sent','2026-04-24 13:22:59','2026-04-24 13:22:59',NULL);
/*!40000 ALTER TABLE `email` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `form_definition`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `form_definition` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Lead',
  `status` enum('active','draft','archived') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft',
  `fields` json DEFAULT NULL,
  `views` int NOT NULL DEFAULT '0',
  `created_by` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_fd_clinic` (`clinic_id`),
  KEY `fk_fd_user` (`created_by`),
  CONSTRAINT `fk_fd_clinic` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_fd_user` FOREIGN KEY (`created_by`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `form_definition` WRITE;
/*!40000 ALTER TABLE `form_definition` DISABLE KEYS */;
/*!40000 ALTER TABLE `form_definition` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `form_submission`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `form_submission` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `form_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `submitted_data` json NOT NULL,
  `submitted_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_fs_clinic` (`clinic_id`),
  KEY `idx_fs_form` (`form_id`),
  CONSTRAINT `fk_fs_clinic` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_fs_form` FOREIGN KEY (`form_id`) REFERENCES `form_definition` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `form_submission` WRITE;
/*!40000 ALTER TABLE `form_submission` DISABLE KEYS */;
/*!40000 ALTER TABLE `form_submission` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `integration`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `integration` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `config` json DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '0',
  `last_sync` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_clinic_integration` (`clinic_id`,`name`),
  KEY `idx_clinic_id` (`clinic_id`),
  KEY `idx_is_active` (`is_active`),
  KEY `idx_deleted_at` (`deleted_at`),
  CONSTRAINT `integration_ibfk_1` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `integration` WRITE;
/*!40000 ALTER TABLE `integration` DISABLE KEYS */;
INSERT INTO `integration` VALUES ('integration-001','clinic-001','Stripe Payments','stripe','{\"api_key\": \"sk_test_xxx\", \"webhook_enabled\": true}',1,'2026-04-24 09:00:00','2026-04-24 13:25:09','2026-04-24 13:25:09',NULL),('integration-002','clinic-001','Google Calendar Sync','google_calendar','{\"calendar_id\": \"clinic1@gmail.com\", \"sync_enabled\": true}',1,'2026-04-24 08:30:00','2026-04-24 13:25:09','2026-04-24 13:25:09',NULL),('integration-003','clinic-001','Mailchimp Email','mailchimp','{\"api_key\": \"xxx\", \"list_id\": \"abc123\"}',1,'2026-04-23 13:00:00','2026-04-24 13:25:09','2026-04-24 13:25:09',NULL),('integration-004','clinic-001','Twilio SMS','twilio','{\"auth_token\": \"yyy\", \"account_sid\": \"xxx\"}',1,'2026-04-24 07:00:00','2026-04-24 13:25:09','2026-04-24 13:25:09',NULL),('integration-005','clinic-002','Stripe Payments','stripe','{\"api_key\": \"sk_test_yyy\", \"webhook_enabled\": true}',1,'2026-04-24 09:15:00','2026-04-24 13:25:09','2026-04-24 13:25:09',NULL),('integration-006','clinic-002','Google Calendar Sync','google_calendar','{\"calendar_id\": \"clinic2@gmail.com\", \"sync_enabled\": true}',1,'2026-04-24 08:45:00','2026-04-24 13:25:09','2026-04-24 13:25:09',NULL),('integration-007','clinic-003','Slack Notifications','slack','{\"webhook_url\": \"https://hooks.slack.com/xxx\"}',1,'2026-04-24 06:00:00','2026-04-24 13:25:09','2026-04-24 13:25:09',NULL),('integration-008','clinic-003','Zapier Automation','zapier','{\"api_key\": \"xxx\"}',0,NULL,'2026-04-24 13:25:09','2026-04-24 13:25:09',NULL),('integration-009','clinic-004','Stripe Payments','stripe','{\"api_key\": \"sk_test_zzz\"}',1,'2026-04-24 09:30:00','2026-04-24 13:25:09','2026-04-24 13:25:09',NULL),('integration-010','clinic-005','Google Calendar Sync','google_calendar','{\"calendar_id\": \"clinic5@gmail.com\"}',1,'2026-04-24 08:15:00','2026-04-24 13:25:09','2026-04-24 13:25:09',NULL);
/*!40000 ALTER TABLE `integration` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `invitation`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `invitation` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `token_hash` char(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `invited_by` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('pending','accepted','expired') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `expires_at` timestamp NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_invite_token` (`token_hash`),
  KEY `idx_invite_clinic` (`clinic_id`),
  CONSTRAINT `fk_invite_clinic` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `invitation` WRITE;
/*!40000 ALTER TABLE `invitation` DISABLE KEYS */;
/*!40000 ALTER TABLE `invitation` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `manual_consult_entry`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `manual_consult_entry` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `contact_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `appointment_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `patient_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `treatment` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `practitioner` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `practitioner_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `outcome` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `revenue` decimal(12,2) NOT NULL DEFAULT '0.00',
  `consult_date` date DEFAULT NULL,
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `deposit_status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'not_required',
  `lost_reason` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_by` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_mce_clinic` (`clinic_id`),
  KEY `idx_mce_contact` (`clinic_id`,`contact_id`),
  KEY `idx_mce_outcome` (`clinic_id`,`outcome`),
  KEY `fk_mce_contact` (`contact_id`),
  KEY `fk_mce_appointment` (`appointment_id`),
  KEY `fk_mce_practitioner` (`practitioner_id`),
  KEY `fk_mce_user` (`created_by`),
  CONSTRAINT `fk_mce_appointment` FOREIGN KEY (`appointment_id`) REFERENCES `appointment` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_mce_clinic` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_mce_contact` FOREIGN KEY (`contact_id`) REFERENCES `contact` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_mce_practitioner` FOREIGN KEY (`practitioner_id`) REFERENCES `user` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_mce_user` FOREIGN KEY (`created_by`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `manual_consult_entry` WRITE;
/*!40000 ALTER TABLE `manual_consult_entry` DISABLE KEYS */;
/*!40000 ALTER TABLE `manual_consult_entry` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `manual_spend_entry`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `manual_spend_entry` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `source` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `channel` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `campaign` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `period` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `attribution_label` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_by` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_mse_clinic` (`clinic_id`),
  KEY `idx_mse_channel` (`clinic_id`,`channel`),
  KEY `idx_mse_period_dates` (`clinic_id`,`start_date`,`end_date`),
  KEY `fk_mse_user` (`created_by`),
  CONSTRAINT `fk_mse_clinic` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_mse_user` FOREIGN KEY (`created_by`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `manual_spend_entry` WRITE;
/*!40000 ALTER TABLE `manual_spend_entry` DISABLE KEYS */;
/*!40000 ALTER TABLE `manual_spend_entry` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `marketing_offer`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `marketing_offer` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `discount` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `treatment` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `valid_until` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `redemptions` int NOT NULL DEFAULT '0',
  `status` enum('active','scheduled','expired') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_by` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_marketing_offer_clinic` (`clinic_id`),
  KEY `fk_marketing_offer_user` (`created_by`),
  CONSTRAINT `fk_marketing_offer_clinic` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_marketing_offer_user` FOREIGN KEY (`created_by`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `marketing_offer` WRITE;
/*!40000 ALTER TABLE `marketing_offer` DISABLE KEYS */;
/*!40000 ALTER TABLE `marketing_offer` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `message_template`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `message_template` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `channel` enum('email','sms','whatsapp') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'email',
  `subject` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `body` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('draft','active','archived') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft',
  `created_by` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_message_template_name` (`clinic_id`,`name`),
  KEY `idx_message_template_clinic` (`clinic_id`),
  KEY `idx_message_template_channel` (`channel`),
  KEY `idx_message_template_status` (`status`),
  KEY `idx_message_template_deleted` (`deleted_at`),
  KEY `fk_message_template_created_by` (`created_by`),
  CONSTRAINT `fk_message_template_clinic` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_message_template_created_by` FOREIGN KEY (`created_by`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `message_template` WRITE;
/*!40000 ALTER TABLE `message_template` DISABLE KEYS */;
/*!40000 ALTER TABLE `message_template` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `oauth_account`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `oauth_account` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `provider` enum('google','facebook','apple') COLLATE utf8mb4_unicode_ci NOT NULL,
  `provider_user_id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_oauth_provider_user` (`provider`,`provider_user_id`),
  KEY `idx_oauth_user` (`user_id`),
  CONSTRAINT `fk_oauth_account_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `oauth_account` WRITE;
/*!40000 ALTER TABLE `oauth_account` DISABLE KEYS */;
/*!40000 ALTER TABLE `oauth_account` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `onboarding_state`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `onboarding_state` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `data` json DEFAULT NULL,
  `created_by` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_onboarding_clinic` (`clinic_id`),
  CONSTRAINT `fk_onboarding_clinic` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `onboarding_state` WRITE;
/*!40000 ALTER TABLE `onboarding_state` DISABLE KEYS */;
/*!40000 ALTER TABLE `onboarding_state` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `payment`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payment` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `subscription_plan_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `amount` decimal(12,2) NOT NULL,
  `currency` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'USD',
  `status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `payment_method` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `stripe_payment_id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `invoice_number` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `due_date` date DEFAULT NULL,
  `paid_date` date DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `subscription_plan_id` (`subscription_plan_id`),
  KEY `idx_clinic_id` (`clinic_id`),
  KEY `idx_status` (`status`),
  KEY `idx_deleted_at` (`deleted_at`),
  CONSTRAINT `payment_ibfk_1` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `payment_ibfk_2` FOREIGN KEY (`subscription_plan_id`) REFERENCES `subscription_plan` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `payment` WRITE;
/*!40000 ALTER TABLE `payment` DISABLE KEYS */;
INSERT INTO `payment` VALUES ('payment-001','clinic-001','plan-002',299.00,'USD','completed','card','pi_stripe_001','INV-001','2026-05-01','2026-04-01','2026-04-24 13:23:20','2026-04-24 13:23:20',NULL),('payment-002','clinic-001','plan-002',299.00,'USD','pending','card','pi_stripe_002','INV-002','2026-06-01',NULL,'2026-04-24 13:23:20','2026-04-24 13:23:20',NULL),('payment-003','clinic-002','plan-003',999.00,'USD','completed','card','pi_stripe_003','INV-003','2026-05-01','2026-04-01','2026-04-24 13:23:20','2026-04-24 13:23:20',NULL),('payment-004','clinic-002','plan-003',999.00,'USD','completed','card','pi_stripe_004','INV-004','2026-06-01','2026-05-01','2026-04-24 13:23:20','2026-04-24 13:23:20',NULL),('payment-005','clinic-003','plan-002',299.00,'USD','completed','card','pi_stripe_005','INV-005','2026-05-15','2026-04-15','2026-04-24 13:23:20','2026-04-24 13:23:20',NULL),('payment-006','clinic-003','plan-002',299.00,'USD','pending','card','pi_stripe_006','INV-006','2026-06-15',NULL,'2026-04-24 13:23:20','2026-04-24 13:23:20',NULL),('payment-007','clinic-004','plan-001',99.00,'USD','completed','card','pi_stripe_007','INV-007','2026-05-10','2026-04-10','2026-04-24 13:23:20','2026-04-24 13:23:20',NULL),('payment-008','clinic-004','plan-001',99.00,'USD','completed','card','pi_stripe_008','INV-008','2026-06-10','2026-05-10','2026-04-24 13:23:20','2026-04-24 13:23:20',NULL),('payment-009','clinic-005','plan-002',299.00,'USD','completed','card','pi_stripe_009','INV-009','2026-05-20','2026-04-20','2026-04-24 13:23:20','2026-04-24 13:23:20',NULL),('payment-010','clinic-005','plan-002',299.00,'USD','pending','card','pi_stripe_010','INV-010','2026-06-20',NULL,'2026-04-24 13:23:20','2026-04-24 13:23:20',NULL);
/*!40000 ALTER TABLE `payment` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `permission`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `permission` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `key_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_permission_key` (`key_name`),
  KEY `idx_permission_deleted_at` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `permission` WRITE;
/*!40000 ALTER TABLE `permission` DISABLE KEYS */;
INSERT INTO `permission` VALUES
('perm-client-accounts-read','client_accounts:read','Read internal client account profiles','2026-06-05 00:00:00','2026-06-05 00:00:00',NULL),
('perm-client-accounts-write','client_accounts:write','Update internal client account profiles','2026-06-05 00:00:00','2026-06-05 00:00:00',NULL),
('perm-internal-tasks-read','internal_tasks:read','Read Clinic Grower internal delivery tasks','2026-06-05 00:00:00','2026-06-05 00:00:00',NULL),
('perm-internal-tasks-write','internal_tasks:write','Create and update Clinic Grower internal delivery tasks','2026-06-05 00:00:00','2026-06-05 00:00:00',NULL),
('perm-sops-read','sops:read','Read clinic SOPs','2026-06-05 00:00:00','2026-06-05 00:00:00',NULL),
('perm-sops-write','sops:write','Create and update clinic SOPs','2026-06-05 00:00:00','2026-06-05 00:00:00',NULL),
('perm-strategy-logs-read','strategy_logs:read','Read internal client strategy logs','2026-06-05 00:00:00','2026-06-05 00:00:00',NULL),
('perm-strategy-logs-write','strategy_logs:write','Create and update internal client strategy logs','2026-06-05 00:00:00','2026-06-05 00:00:00',NULL);
INSERT INTO `permission` VALUES ('perm-all','*','All permissions','2026-06-01 22:07:33','2026-06-01 22:07:33',NULL),('perm-appointments-delete','appointments:delete','Delete appointments','2026-06-01 22:07:33','2026-06-01 22:07:33',NULL),('perm-appointments-read','appointments:read','Read appointments','2026-06-01 22:07:33','2026-06-01 22:07:33',NULL),('perm-appointments-write','appointments:write','Create and update appointments','2026-06-01 22:07:33','2026-06-01 22:07:33',NULL),('perm-audit-read','audit:read','Read audit log','2026-06-01 22:07:33','2026-06-01 22:07:33',NULL),('perm-billing-read','billing:read','Read billing data','2026-06-01 22:07:33','2026-06-01 22:07:33',NULL),('perm-billing-write','billing:write','Manage billing','2026-06-01 22:07:33','2026-06-01 22:07:33',NULL),('perm-calls-read','calls:read','Read call records','2026-06-01 22:07:33','2026-06-01 22:07:33',NULL),('perm-calls-write','calls:write','Create and update call records','2026-06-01 22:07:33','2026-06-01 22:07:33',NULL),('perm-contacts-delete','contacts:delete','Delete contacts','2026-06-01 22:07:33','2026-06-01 22:07:33',NULL),('perm-contacts-read','contacts:read','Read contacts and patient profiles','2026-06-01 22:07:33','2026-06-01 22:07:33',NULL),('perm-contacts-write','contacts:write','Create and update contacts and patient profiles','2026-06-01 22:07:33','2026-06-01 22:07:33',NULL),('perm-events-read','events:read','Read events','2026-06-01 22:07:33','2026-06-01 22:07:33',NULL),('perm-events-write','events:write','Create and update events','2026-06-01 22:07:33','2026-06-01 22:07:33',NULL),('perm-marketing-read','marketing:read','Read marketing data','2026-06-01 22:07:33','2026-06-01 22:07:33',NULL),('perm-marketing-write','marketing:write','Manage marketing data','2026-06-01 22:07:33','2026-06-01 22:07:33',NULL),('perm-reports-read','reports:read','Read reports','2026-06-01 22:07:33','2026-06-01 22:07:33',NULL),('perm-reports-write','reports:write','Manage report adjustments and manual entries','2026-06-01 22:07:33','2026-06-01 22:07:33',NULL),('perm-settings-read','settings:read','Read clinic and security settings','2026-06-01 22:07:33','2026-06-01 22:07:33',NULL),('perm-settings-write','settings:write','Update clinic and security settings','2026-06-01 22:07:33','2026-06-01 22:07:33',NULL),('perm-team-read','team:read','Read team members','2026-06-01 22:07:33','2026-06-01 22:07:33',NULL),('perm-team-write','team:write','Invite and update team members','2026-06-01 22:07:33','2026-06-01 22:07:33',NULL),('perm-webhooks-read','webhooks:read','Read webhook settings','2026-06-01 22:07:33','2026-06-01 22:07:33',NULL),('perm-webhooks-write','webhooks:write','Manage webhook settings','2026-06-01 22:07:33','2026-06-01 22:07:33',NULL);
/*!40000 ALTER TABLE `permission` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `pipeline`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pipeline` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `stages` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_clinic_pipeline` (`clinic_id`,`name`),
  KEY `idx_clinic_id` (`clinic_id`),
  KEY `idx_deleted_at` (`deleted_at`),
  CONSTRAINT `pipeline_ibfk_1` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `pipeline` WRITE;
/*!40000 ALTER TABLE `pipeline` DISABLE KEYS */;
INSERT INTO `pipeline` VALUES ('4c08fa3e-5e06-11f1-8123-8cec4bbbf9f1','clinic-001','Revenue Pipeline','Default conversion pipeline for lead and consult revenue tracking','[\"New\", \"Contacted\", \"Qualified\", \"Consult Booked\", \"Consult Attended\", \"Sold\", \"Lost\"]','2026-06-01 22:07:36','2026-06-01 22:07:36',NULL),('4c08fac1-5e06-11f1-8123-8cec4bbbf9f1','clinic-002','Revenue Pipeline','Default conversion pipeline for lead and consult revenue tracking','[\"New\", \"Contacted\", \"Qualified\", \"Consult Booked\", \"Consult Attended\", \"Sold\", \"Lost\"]','2026-06-01 22:07:36','2026-06-01 22:07:36',NULL),('4c08fae9-5e06-11f1-8123-8cec4bbbf9f1','clinic-003','Revenue Pipeline','Default conversion pipeline for lead and consult revenue tracking','[\"New\", \"Contacted\", \"Qualified\", \"Consult Booked\", \"Consult Attended\", \"Sold\", \"Lost\"]','2026-06-01 22:07:36','2026-06-01 22:07:36',NULL),('4c08fb0d-5e06-11f1-8123-8cec4bbbf9f1','clinic-004','Revenue Pipeline','Default conversion pipeline for lead and consult revenue tracking','[\"New\", \"Contacted\", \"Qualified\", \"Consult Booked\", \"Consult Attended\", \"Sold\", \"Lost\"]','2026-06-01 22:07:36','2026-06-01 22:07:36',NULL),('4c08fb3c-5e06-11f1-8123-8cec4bbbf9f1','clinic-005','Revenue Pipeline','Default conversion pipeline for lead and consult revenue tracking','[\"New\", \"Contacted\", \"Qualified\", \"Consult Booked\", \"Consult Attended\", \"Sold\", \"Lost\"]','2026-06-01 22:07:36','2026-06-01 22:07:36',NULL),('4c08fb5c-5e06-11f1-8123-8cec4bbbf9f1','clinic-006','Revenue Pipeline','Default conversion pipeline for lead and consult revenue tracking','[\"New\", \"Contacted\", \"Qualified\", \"Consult Booked\", \"Consult Attended\", \"Sold\", \"Lost\"]','2026-06-01 22:07:36','2026-06-01 22:07:36',NULL),('4c08fb7c-5e06-11f1-8123-8cec4bbbf9f1','clinic-007','Revenue Pipeline','Default conversion pipeline for lead and consult revenue tracking','[\"New\", \"Contacted\", \"Qualified\", \"Consult Booked\", \"Consult Attended\", \"Sold\", \"Lost\"]','2026-06-01 22:07:36','2026-06-01 22:07:36',NULL),('4c08fb99-5e06-11f1-8123-8cec4bbbf9f1','clinic-008','Revenue Pipeline','Default conversion pipeline for lead and consult revenue tracking','[\"New\", \"Contacted\", \"Qualified\", \"Consult Booked\", \"Consult Attended\", \"Sold\", \"Lost\"]','2026-06-01 22:07:36','2026-06-01 22:07:36',NULL),('4c08fbb7-5e06-11f1-8123-8cec4bbbf9f1','clinic-009','Revenue Pipeline','Default conversion pipeline for lead and consult revenue tracking','[\"New\", \"Contacted\", \"Qualified\", \"Consult Booked\", \"Consult Attended\", \"Sold\", \"Lost\"]','2026-06-01 22:07:36','2026-06-01 22:07:36',NULL),('4c08fbd2-5e06-11f1-8123-8cec4bbbf9f1','clinic-010','Revenue Pipeline','Default conversion pipeline for lead and consult revenue tracking','[\"New\", \"Contacted\", \"Qualified\", \"Consult Booked\", \"Consult Attended\", \"Sold\", \"Lost\"]','2026-06-01 22:07:36','2026-06-01 22:07:36',NULL),('pipeline-001','clinic-001','New Patient Onboarding','Standard pipeline for new patient intake','[\"Inquiry\", \"Consultation Booked\", \"Initial Consultation\", \"Assessment\", \"Treatment Plan\", \"Active Treatment\"]','2026-04-24 13:22:26','2026-04-24 13:22:26',NULL),('pipeline-002','clinic-001','Physiotherapy Recovery','Recovery and rehabilitation pipeline','[\"Initial Assessment\", \"Week 1-2\", \"Week 3-4\", \"Week 5-6\", \"Discharge Planning\", \"Follow-up\"]','2026-04-24 13:22:26','2026-04-24 13:22:26',NULL),('pipeline-003','clinic-001','Wellness Program','Preventative wellness pipeline','[\"Interest\", \"Enrollment\", \"Program Start\", \"Progress Check\", \"Completion\", \"Renewal\"]','2026-04-24 13:22:26','2026-04-24 13:22:26',NULL),('pipeline-004','clinic-002','New Patient Onboarding','Standard pipeline for new patient intake','[\"Inquiry\", \"Consultation Booked\", \"Initial Consultation\", \"Assessment\", \"Treatment Plan\", \"Active Treatment\"]','2026-04-24 13:22:26','2026-04-24 13:22:26',NULL),('pipeline-005','clinic-002','Injury Recovery','Injury treatment and recovery','[\"Injury Assessment\", \"Treatment Start\", \"Mid-Treatment Review\", \"Recovery Progress\", \"Discharge\", \"Follow-up Care\"]','2026-04-24 13:22:26','2026-04-24 13:22:26',NULL),('pipeline-006','clinic-003','Sports Medicine','Sports injury and performance','[\"Initial Consultation\", \"Diagnosis\", \"Treatment\", \"Rehabilitation\", \"Return to Sport\", \"Maintenance\"]','2026-04-24 13:22:26','2026-04-24 13:22:26',NULL),('pipeline-007','clinic-003','Chronic Pain Management','Long-term pain management','[\"Assessment\", \"Pain Evaluation\", \"Treatment Plan\", \"Active Management\", \"Progress Review\", \"Maintenance\"]','2026-04-24 13:22:26','2026-04-24 13:22:26',NULL),('pipeline-008','clinic-004','New Patient Onboarding','Standard pipeline for new patient intake','[\"Inquiry\", \"Consultation Booked\", \"Initial Consultation\", \"Assessment\", \"Treatment Plan\", \"Active Treatment\"]','2026-04-24 13:22:26','2026-04-24 13:22:26',NULL),('pipeline-009','clinic-004','Mental Health Support','Mental health and wellness','[\"Initial Contact\", \"Assessment\", \"Therapy Start\", \"Progress Review\", \"Stabilization\", \"Discharge\"]','2026-04-24 13:22:26','2026-04-24 13:22:26',NULL),('pipeline-010','clinic-005','Rehabilitation Program','Post-injury rehabilitation','[\"Referral Received\", \"Initial Assessment\", \"Program Design\", \"Active Rehab\", \"Progress Milestones\", \"Discharge\"]','2026-04-24 13:22:26','2026-04-24 13:22:26',NULL);
/*!40000 ALTER TABLE `pipeline` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `pipeline_deal_movement`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pipeline_deal_movement` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `deal_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `pipeline_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `from_stage_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `to_stage_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `from_stage` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `to_stage` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `moved_by` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `moved_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `metadata` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_pipeline_deal_movement_clinic` (`clinic_id`,`moved_at`),
  KEY `idx_pipeline_deal_movement_deal` (`deal_id`,`moved_at`),
  KEY `idx_pipeline_deal_movement_pipeline` (`pipeline_id`,`moved_at`),
  KEY `fk_pdm_from_stage` (`from_stage_id`),
  KEY `fk_pdm_to_stage` (`to_stage_id`),
  KEY `fk_pdm_moved_by` (`moved_by`),
  CONSTRAINT `fk_pdm_clinic` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pdm_deal` FOREIGN KEY (`deal_id`) REFERENCES `deal` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pdm_from_stage` FOREIGN KEY (`from_stage_id`) REFERENCES `pipeline_stage` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_pdm_moved_by` FOREIGN KEY (`moved_by`) REFERENCES `user` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_pdm_pipeline` FOREIGN KEY (`pipeline_id`) REFERENCES `pipeline` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pdm_to_stage` FOREIGN KEY (`to_stage_id`) REFERENCES `pipeline_stage` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `pipeline_deal_movement` WRITE;
/*!40000 ALTER TABLE `pipeline_deal_movement` DISABLE KEYS */;
/*!40000 ALTER TABLE `pipeline_deal_movement` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `pipeline_stage`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pipeline_stage` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `pipeline_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `color` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'bg-blue-500',
  `position` int NOT NULL DEFAULT '1',
  `kind` enum('open','won','lost') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'open',
  `is_locked` tinyint(1) NOT NULL DEFAULT '0',
  `created_by` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_pipeline_stage_position` (`pipeline_id`,`position`,`deleted_at`),
  KEY `idx_pipeline_stage_clinic` (`clinic_id`),
  KEY `idx_pipeline_stage_pipeline` (`pipeline_id`),
  KEY `idx_pipeline_stage_deleted` (`deleted_at`),
  KEY `fk_pipeline_stage_created_by` (`created_by`),
  CONSTRAINT `fk_pipeline_stage_clinic` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pipeline_stage_created_by` FOREIGN KEY (`created_by`) REFERENCES `user` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_pipeline_stage_pipeline` FOREIGN KEY (`pipeline_id`) REFERENCES `pipeline` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `pipeline_stage` WRITE;
/*!40000 ALTER TABLE `pipeline_stage` DISABLE KEYS */;
INSERT INTO `pipeline_stage` VALUES ('4c0a2245-5e06-11f1-8123-8cec4bbbf9f1','clinic-010','4c08fbd2-5e06-11f1-8123-8cec4bbbf9f1','New','bg-blue-500',1,'open',0,NULL,'2026-06-01 22:07:36','2026-06-01 22:07:36',NULL),('4c0a2287-5e06-11f1-8123-8cec4bbbf9f1','clinic-009','4c08fbb7-5e06-11f1-8123-8cec4bbbf9f1','New','bg-blue-500',1,'open',0,NULL,'2026-06-01 22:07:36','2026-06-01 22:07:36',NULL),('4c0a2298-5e06-11f1-8123-8cec4bbbf9f1','clinic-008','4c08fb99-5e06-11f1-8123-8cec4bbbf9f1','New','bg-blue-500',1,'open',0,NULL,'2026-06-01 22:07:36','2026-06-01 22:07:36',NULL),('4c0a22a8-5e06-11f1-8123-8cec4bbbf9f1','clinic-007','4c08fb7c-5e06-11f1-8123-8cec4bbbf9f1','New','bg-blue-500',1,'open',0,NULL,'2026-06-01 22:07:36','2026-06-01 22:07:36',NULL),('4c0a22b6-5e06-11f1-8123-8cec4bbbf9f1','clinic-006','4c08fb5c-5e06-11f1-8123-8cec4bbbf9f1','New','bg-blue-500',1,'open',0,NULL,'2026-06-01 22:07:36','2026-06-01 22:07:36',NULL),('4c0a22c2-5e06-11f1-8123-8cec4bbbf9f1','clinic-005','4c08fb3c-5e06-11f1-8123-8cec4bbbf9f1','New','bg-blue-500',1,'open',0,NULL,'2026-06-01 22:07:36','2026-06-01 22:07:36',NULL),('4c0a22e1-5e06-11f1-8123-8cec4bbbf9f1','clinic-004','4c08fb0d-5e06-11f1-8123-8cec4bbbf9f1','New','bg-blue-500',1,'open',0,NULL,'2026-06-01 22:07:36','2026-06-01 22:07:36',NULL),('4c0a22ef-5e06-11f1-8123-8cec4bbbf9f1','clinic-003','4c08fae9-5e06-11f1-8123-8cec4bbbf9f1','New','bg-blue-500',1,'open',0,NULL,'2026-06-01 22:07:36','2026-06-01 22:07:36',NULL),('4c0a22fb-5e06-11f1-8123-8cec4bbbf9f1','clinic-002','4c08fac1-5e06-11f1-8123-8cec4bbbf9f1','New','bg-blue-500',1,'open',0,NULL,'2026-06-01 22:07:36','2026-06-01 22:07:36',NULL),('4c0a2308-5e06-11f1-8123-8cec4bbbf9f1','clinic-001','4c08fa3e-5e06-11f1-8123-8cec4bbbf9f1','New','bg-blue-500',1,'open',0,NULL,'2026-06-01 22:07:36','2026-06-01 22:07:36',NULL),('4c0a2318-5e06-11f1-8123-8cec4bbbf9f1','clinic-010','4c08fbd2-5e06-11f1-8123-8cec4bbbf9f1','Contacted','bg-cyan-500',2,'open',0,NULL,'2026-06-01 22:07:36','2026-06-01 22:07:36',NULL),('4c0a2325-5e06-11f1-8123-8cec4bbbf9f1','clinic-009','4c08fbb7-5e06-11f1-8123-8cec4bbbf9f1','Contacted','bg-cyan-500',2,'open',0,NULL,'2026-06-01 22:07:36','2026-06-01 22:07:36',NULL),('4c0a2333-5e06-11f1-8123-8cec4bbbf9f1','clinic-008','4c08fb99-5e06-11f1-8123-8cec4bbbf9f1','Contacted','bg-cyan-500',2,'open',0,NULL,'2026-06-01 22:07:36','2026-06-01 22:07:36',NULL),('4c0a233f-5e06-11f1-8123-8cec4bbbf9f1','clinic-007','4c08fb7c-5e06-11f1-8123-8cec4bbbf9f1','Contacted','bg-cyan-500',2,'open',0,NULL,'2026-06-01 22:07:36','2026-06-01 22:07:36',NULL),('4c0a235e-5e06-11f1-8123-8cec4bbbf9f1','clinic-006','4c08fb5c-5e06-11f1-8123-8cec4bbbf9f1','Contacted','bg-cyan-500',2,'open',0,NULL,'2026-06-01 22:07:36','2026-06-01 22:07:36',NULL),('4c0a236b-5e06-11f1-8123-8cec4bbbf9f1','clinic-005','4c08fb3c-5e06-11f1-8123-8cec4bbbf9f1','Contacted','bg-cyan-500',2,'open',0,NULL,'2026-06-01 22:07:36','2026-06-01 22:07:36',NULL),('4c0a2377-5e06-11f1-8123-8cec4bbbf9f1','clinic-004','4c08fb0d-5e06-11f1-8123-8cec4bbbf9f1','Contacted','bg-cyan-500',2,'open',0,NULL,'2026-06-01 22:07:36','2026-06-01 22:07:36',NULL),('4c0a2383-5e06-11f1-8123-8cec4bbbf9f1','clinic-003','4c08fae9-5e06-11f1-8123-8cec4bbbf9f1','Contacted','bg-cyan-500',2,'open',0,NULL,'2026-06-01 22:07:36','2026-06-01 22:07:36',NULL),('4c0a2390-5e06-11f1-8123-8cec4bbbf9f1','clinic-002','4c08fac1-5e06-11f1-8123-8cec4bbbf9f1','Contacted','bg-cyan-500',2,'open',0,NULL,'2026-06-01 22:07:36','2026-06-01 22:07:36',NULL),('4c0a239c-5e06-11f1-8123-8cec4bbbf9f1','clinic-001','4c08fa3e-5e06-11f1-8123-8cec4bbbf9f1','Contacted','bg-cyan-500',2,'open',0,NULL,'2026-06-01 22:07:36','2026-06-01 22:07:36',NULL),('4c0a23ab-5e06-11f1-8123-8cec4bbbf9f1','clinic-010','4c08fbd2-5e06-11f1-8123-8cec4bbbf9f1','Qualified','bg-violet-500',3,'open',0,NULL,'2026-06-01 22:07:36','2026-06-01 22:07:36',NULL),('4c0a23b7-5e06-11f1-8123-8cec4bbbf9f1','clinic-009','4c08fbb7-5e06-11f1-8123-8cec4bbbf9f1','Qualified','bg-violet-500',3,'open',0,NULL,'2026-06-01 22:07:36','2026-06-01 22:07:36',NULL),('4c0a23d6-5e06-11f1-8123-8cec4bbbf9f1','clinic-008','4c08fb99-5e06-11f1-8123-8cec4bbbf9f1','Qualified','bg-violet-500',3,'open',0,NULL,'2026-06-01 22:07:36','2026-06-01 22:07:36',NULL),('4c0a23e2-5e06-11f1-8123-8cec4bbbf9f1','clinic-007','4c08fb7c-5e06-11f1-8123-8cec4bbbf9f1','Qualified','bg-violet-500',3,'open',0,NULL,'2026-06-01 22:07:36','2026-06-01 22:07:36',NULL),('4c0a23ee-5e06-11f1-8123-8cec4bbbf9f1','clinic-006','4c08fb5c-5e06-11f1-8123-8cec4bbbf9f1','Qualified','bg-violet-500',3,'open',0,NULL,'2026-06-01 22:07:36','2026-06-01 22:07:36',NULL),('4c0a23fa-5e06-11f1-8123-8cec4bbbf9f1','clinic-005','4c08fb3c-5e06-11f1-8123-8cec4bbbf9f1','Qualified','bg-violet-500',3,'open',0,NULL,'2026-06-01 22:07:36','2026-06-01 22:07:36',NULL),('4c0a2407-5e06-11f1-8123-8cec4bbbf9f1','clinic-004','4c08fb0d-5e06-11f1-8123-8cec4bbbf9f1','Qualified','bg-violet-500',3,'open',0,NULL,'2026-06-01 22:07:36','2026-06-01 22:07:36',NULL),('4c0a2413-5e06-11f1-8123-8cec4bbbf9f1','clinic-003','4c08fae9-5e06-11f1-8123-8cec4bbbf9f1','Qualified','bg-violet-500',3,'open',0,NULL,'2026-06-01 22:07:36','2026-06-01 22:07:36',NULL),('4c0a241f-5e06-11f1-8123-8cec4bbbf9f1','clinic-002','4c08fac1-5e06-11f1-8123-8cec4bbbf9f1','Qualified','bg-violet-500',3,'open',0,NULL,'2026-06-01 22:07:36','2026-06-01 22:07:36',NULL),('4c0a242b-5e06-11f1-8123-8cec4bbbf9f1','clinic-001','4c08fa3e-5e06-11f1-8123-8cec4bbbf9f1','Qualified','bg-violet-500',3,'open',0,NULL,'2026-06-01 22:07:36','2026-06-01 22:07:36',NULL),('4c0a2468-5e06-11f1-8123-8cec4bbbf9f1','clinic-010','4c08fbd2-5e06-11f1-8123-8cec4bbbf9f1','Consult Booked','bg-amber-500',4,'open',0,NULL,'2026-06-01 22:07:36','2026-06-01 22:07:36',NULL),('4c0a2476-5e06-11f1-8123-8cec4bbbf9f1','clinic-009','4c08fbb7-5e06-11f1-8123-8cec4bbbf9f1','Consult Booked','bg-amber-500',4,'open',0,NULL,'2026-06-01 22:07:36','2026-06-01 22:07:36',NULL),('4c0a2482-5e06-11f1-8123-8cec4bbbf9f1','clinic-008','4c08fb99-5e06-11f1-8123-8cec4bbbf9f1','Consult Booked','bg-amber-500',4,'open',0,NULL,'2026-06-01 22:07:36','2026-06-01 22:07:36',NULL),('4c0a248e-5e06-11f1-8123-8cec4bbbf9f1','clinic-007','4c08fb7c-5e06-11f1-8123-8cec4bbbf9f1','Consult Booked','bg-amber-500',4,'open',0,NULL,'2026-06-01 22:07:36','2026-06-01 22:07:36',NULL),('4c0a249a-5e06-11f1-8123-8cec4bbbf9f1','clinic-006','4c08fb5c-5e06-11f1-8123-8cec4bbbf9f1','Consult Booked','bg-amber-500',4,'open',0,NULL,'2026-06-01 22:07:36','2026-06-01 22:07:36',NULL),('4c0a24a6-5e06-11f1-8123-8cec4bbbf9f1','clinic-005','4c08fb3c-5e06-11f1-8123-8cec4bbbf9f1','Consult Booked','bg-amber-500',4,'open',0,NULL,'2026-06-01 22:07:36','2026-06-01 22:07:36',NULL),('4c0a24b3-5e06-11f1-8123-8cec4bbbf9f1','clinic-004','4c08fb0d-5e06-11f1-8123-8cec4bbbf9f1','Consult Booked','bg-amber-500',4,'open',0,NULL,'2026-06-01 22:07:36','2026-06-01 22:07:36',NULL),('4c0a24be-5e06-11f1-8123-8cec4bbbf9f1','clinic-003','4c08fae9-5e06-11f1-8123-8cec4bbbf9f1','Consult Booked','bg-amber-500',4,'open',0,NULL,'2026-06-01 22:07:36','2026-06-01 22:07:36',NULL),('4c0a24dc-5e06-11f1-8123-8cec4bbbf9f1','clinic-002','4c08fac1-5e06-11f1-8123-8cec4bbbf9f1','Consult Booked','bg-amber-500',4,'open',0,NULL,'2026-06-01 22:07:36','2026-06-01 22:07:36',NULL),('4c0a24e9-5e06-11f1-8123-8cec4bbbf9f1','clinic-001','4c08fa3e-5e06-11f1-8123-8cec4bbbf9f1','Consult Booked','bg-amber-500',4,'open',0,NULL,'2026-06-01 22:07:36','2026-06-01 22:07:36',NULL),('4c0a24f6-5e06-11f1-8123-8cec4bbbf9f1','clinic-010','4c08fbd2-5e06-11f1-8123-8cec4bbbf9f1','Consult Attended','bg-orange-500',5,'open',0,NULL,'2026-06-01 22:07:36','2026-06-01 22:07:36',NULL),('4c0a2503-5e06-11f1-8123-8cec4bbbf9f1','clinic-009','4c08fbb7-5e06-11f1-8123-8cec4bbbf9f1','Consult Attended','bg-orange-500',5,'open',0,NULL,'2026-06-01 22:07:36','2026-06-01 22:07:36',NULL),('4c0a250f-5e06-11f1-8123-8cec4bbbf9f1','clinic-008','4c08fb99-5e06-11f1-8123-8cec4bbbf9f1','Consult Attended','bg-orange-500',5,'open',0,NULL,'2026-06-01 22:07:36','2026-06-01 22:07:36',NULL),('4c0a251a-5e06-11f1-8123-8cec4bbbf9f1','clinic-007','4c08fb7c-5e06-11f1-8123-8cec4bbbf9f1','Consult Attended','bg-orange-500',5,'open',0,NULL,'2026-06-01 22:07:36','2026-06-01 22:07:36',NULL),('4c0a2526-5e06-11f1-8123-8cec4bbbf9f1','clinic-006','4c08fb5c-5e06-11f1-8123-8cec4bbbf9f1','Consult Attended','bg-orange-500',5,'open',0,NULL,'2026-06-01 22:07:36','2026-06-01 22:07:36',NULL),('4c0a2532-5e06-11f1-8123-8cec4bbbf9f1','clinic-005','4c08fb3c-5e06-11f1-8123-8cec4bbbf9f1','Consult Attended','bg-orange-500',5,'open',0,NULL,'2026-06-01 22:07:36','2026-06-01 22:07:36',NULL),('4c0a2550-5e06-11f1-8123-8cec4bbbf9f1','clinic-004','4c08fb0d-5e06-11f1-8123-8cec4bbbf9f1','Consult Attended','bg-orange-500',5,'open',0,NULL,'2026-06-01 22:07:36','2026-06-01 22:07:36',NULL),('4c0a255c-5e06-11f1-8123-8cec4bbbf9f1','clinic-003','4c08fae9-5e06-11f1-8123-8cec4bbbf9f1','Consult Attended','bg-orange-500',5,'open',0,NULL,'2026-06-01 22:07:36','2026-06-01 22:07:36',NULL),('4c0a2568-5e06-11f1-8123-8cec4bbbf9f1','clinic-002','4c08fac1-5e06-11f1-8123-8cec4bbbf9f1','Consult Attended','bg-orange-500',5,'open',0,NULL,'2026-06-01 22:07:36','2026-06-01 22:07:36',NULL),('4c0a2574-5e06-11f1-8123-8cec4bbbf9f1','clinic-001','4c08fa3e-5e06-11f1-8123-8cec4bbbf9f1','Consult Attended','bg-orange-500',5,'open',0,NULL,'2026-06-01 22:07:36','2026-06-01 22:07:36',NULL),('4c0a2581-5e06-11f1-8123-8cec4bbbf9f1','clinic-010','4c08fbd2-5e06-11f1-8123-8cec4bbbf9f1','Sold','bg-emerald-500',6,'won',1,NULL,'2026-06-01 22:07:36','2026-06-01 22:07:36',NULL),('4c0a258f-5e06-11f1-8123-8cec4bbbf9f1','clinic-009','4c08fbb7-5e06-11f1-8123-8cec4bbbf9f1','Sold','bg-emerald-500',6,'won',1,NULL,'2026-06-01 22:07:36','2026-06-01 22:07:36',NULL),('4c0a259b-5e06-11f1-8123-8cec4bbbf9f1','clinic-008','4c08fb99-5e06-11f1-8123-8cec4bbbf9f1','Sold','bg-emerald-500',6,'won',1,NULL,'2026-06-01 22:07:36','2026-06-01 22:07:36',NULL),('4c0a25a7-5e06-11f1-8123-8cec4bbbf9f1','clinic-007','4c08fb7c-5e06-11f1-8123-8cec4bbbf9f1','Sold','bg-emerald-500',6,'won',1,NULL,'2026-06-01 22:07:36','2026-06-01 22:07:36',NULL),('4c0a25c7-5e06-11f1-8123-8cec4bbbf9f1','clinic-006','4c08fb5c-5e06-11f1-8123-8cec4bbbf9f1','Sold','bg-emerald-500',6,'won',1,NULL,'2026-06-01 22:07:36','2026-06-01 22:07:36',NULL),('4c0a25d4-5e06-11f1-8123-8cec4bbbf9f1','clinic-005','4c08fb3c-5e06-11f1-8123-8cec4bbbf9f1','Sold','bg-emerald-500',6,'won',1,NULL,'2026-06-01 22:07:36','2026-06-01 22:07:36',NULL),('4c0a25e0-5e06-11f1-8123-8cec4bbbf9f1','clinic-004','4c08fb0d-5e06-11f1-8123-8cec4bbbf9f1','Sold','bg-emerald-500',6,'won',1,NULL,'2026-06-01 22:07:36','2026-06-01 22:07:36',NULL),('4c0a25ec-5e06-11f1-8123-8cec4bbbf9f1','clinic-003','4c08fae9-5e06-11f1-8123-8cec4bbbf9f1','Sold','bg-emerald-500',6,'won',1,NULL,'2026-06-01 22:07:36','2026-06-01 22:07:36',NULL),('4c0a25f7-5e06-11f1-8123-8cec4bbbf9f1','clinic-002','4c08fac1-5e06-11f1-8123-8cec4bbbf9f1','Sold','bg-emerald-500',6,'won',1,NULL,'2026-06-01 22:07:36','2026-06-01 22:07:36',NULL),('4c0a2603-5e06-11f1-8123-8cec4bbbf9f1','clinic-001','4c08fa3e-5e06-11f1-8123-8cec4bbbf9f1','Sold','bg-emerald-500',6,'won',1,NULL,'2026-06-01 22:07:36','2026-06-01 22:07:36',NULL),('4c0a2610-5e06-11f1-8123-8cec4bbbf9f1','clinic-010','4c08fbd2-5e06-11f1-8123-8cec4bbbf9f1','Lost','bg-red-500',7,'lost',1,NULL,'2026-06-01 22:07:36','2026-06-01 22:07:36',NULL),('4c0a261c-5e06-11f1-8123-8cec4bbbf9f1','clinic-009','4c08fbb7-5e06-11f1-8123-8cec4bbbf9f1','Lost','bg-red-500',7,'lost',1,NULL,'2026-06-01 22:07:36','2026-06-01 22:07:36',NULL),('4c0a263a-5e06-11f1-8123-8cec4bbbf9f1','clinic-008','4c08fb99-5e06-11f1-8123-8cec4bbbf9f1','Lost','bg-red-500',7,'lost',1,NULL,'2026-06-01 22:07:36','2026-06-01 22:07:36',NULL),('4c0a2647-5e06-11f1-8123-8cec4bbbf9f1','clinic-007','4c08fb7c-5e06-11f1-8123-8cec4bbbf9f1','Lost','bg-red-500',7,'lost',1,NULL,'2026-06-01 22:07:36','2026-06-01 22:07:36',NULL),('4c0a2653-5e06-11f1-8123-8cec4bbbf9f1','clinic-006','4c08fb5c-5e06-11f1-8123-8cec4bbbf9f1','Lost','bg-red-500',7,'lost',1,NULL,'2026-06-01 22:07:36','2026-06-01 22:07:36',NULL),('4c0a265e-5e06-11f1-8123-8cec4bbbf9f1','clinic-005','4c08fb3c-5e06-11f1-8123-8cec4bbbf9f1','Lost','bg-red-500',7,'lost',1,NULL,'2026-06-01 22:07:36','2026-06-01 22:07:36',NULL),('4c0a266a-5e06-11f1-8123-8cec4bbbf9f1','clinic-004','4c08fb0d-5e06-11f1-8123-8cec4bbbf9f1','Lost','bg-red-500',7,'lost',1,NULL,'2026-06-01 22:07:36','2026-06-01 22:07:36',NULL),('4c0a2675-5e06-11f1-8123-8cec4bbbf9f1','clinic-003','4c08fae9-5e06-11f1-8123-8cec4bbbf9f1','Lost','bg-red-500',7,'lost',1,NULL,'2026-06-01 22:07:36','2026-06-01 22:07:36',NULL),('4c0a2681-5e06-11f1-8123-8cec4bbbf9f1','clinic-002','4c08fac1-5e06-11f1-8123-8cec4bbbf9f1','Lost','bg-red-500',7,'lost',1,NULL,'2026-06-01 22:07:36','2026-06-01 22:07:36',NULL),('4c0a268c-5e06-11f1-8123-8cec4bbbf9f1','clinic-001','4c08fa3e-5e06-11f1-8123-8cec4bbbf9f1','Lost','bg-red-500',7,'lost',1,NULL,'2026-06-01 22:07:36','2026-06-01 22:07:36',NULL);
/*!40000 ALTER TABLE `pipeline_stage` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `recovery_attempt`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `recovery_attempt` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `appointment_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `attempt_date` datetime NOT NULL,
  `method` enum('Email','SMS','Call','InPerson') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `outcome` enum('Rebooked','Declined','NoResponse','Converted') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_clinic_id` (`clinic_id`),
  KEY `idx_appointment_id` (`appointment_id`),
  KEY `idx_attempt_date` (`attempt_date`),
  KEY `idx_deleted_at` (`deleted_at`),
  CONSTRAINT `recovery_attempt_ibfk_1` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `recovery_attempt_ibfk_2` FOREIGN KEY (`appointment_id`) REFERENCES `appointment` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `recovery_attempt` WRITE;
/*!40000 ALTER TABLE `recovery_attempt` DISABLE KEYS */;
INSERT INTO `recovery_attempt` VALUES ('recovery-001','clinic-001','appt-004','2026-05-01 12:00:00','Call','NoResponse','No answer on provided phone number','2026-04-24 13:22:43','2026-04-24 13:22:43',NULL),('recovery-002','clinic-001','appt-004','2026-05-01 13:00:00','Email','NoResponse','Follow-up email sent to patient, no response yet','2026-04-24 13:22:43','2026-04-24 13:22:43',NULL),('recovery-003','clinic-002','appt-005','2026-04-26 14:00:00','Call','Converted','Patient confirmed appointment and attended','2026-04-24 13:22:43','2026-04-24 13:22:43',NULL),('recovery-004','clinic-002','appt-006','2026-05-01 10:00:00','SMS','NoResponse','Reminder SMS sent, awaiting response','2026-04-24 13:22:43','2026-04-24 13:22:43',NULL),('recovery-005','clinic-003','appt-007','2026-04-25 16:00:00','Call','Converted','Patient attended appointment successfully','2026-04-24 13:22:43','2026-04-24 13:22:43',NULL),('recovery-006','clinic-003','appt-008','2026-05-02 09:00:00','Email','NoResponse','Appointment reminder email sent','2026-04-24 13:22:43','2026-04-24 13:22:43',NULL),('recovery-007','clinic-004','appt-009','2026-04-24 11:00:00','Call','Converted','Patient confirmed attendance','2026-04-24 13:22:43','2026-04-24 13:22:43',NULL),('recovery-008','clinic-004','appt-010','2026-05-03 10:00:00','SMS','NoResponse','Reminder sent, awaiting confirmation','2026-04-24 13:22:43','2026-04-24 13:22:43',NULL),('recovery-009','clinic-001','appt-001','2026-04-27 09:00:00','Email','NoResponse','Pre-appointment information sent','2026-04-24 13:22:43','2026-04-24 13:22:43',NULL),('recovery-010','clinic-002','appt-005','2026-04-28 14:00:00','Email','NoResponse','Post-appointment follow-up sent','2026-04-24 13:22:43','2026-04-24 13:22:43',NULL);
/*!40000 ALTER TABLE `recovery_attempt` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `report_share`;
DROP TABLE IF EXISTS `report`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `report` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `filters` json DEFAULT NULL,
  `data` json DEFAULT NULL,
  `workflow_status` enum('draft','in_review','approved','published') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft',
  `internal_notes` text COLLATE utf8mb4_unicode_ci,
  `client_commentary` text COLLATE utf8mb4_unicode_ci,
  `ai_draft_summary` text COLLATE utf8mb4_unicode_ci,
  `approved_by` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `published_at` timestamp NULL DEFAULT NULL,
  `created_by` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `created_by` (`created_by`),
  KEY `idx_clinic_id` (`clinic_id`),
  KEY `idx_type` (`type`),
  KEY `idx_report_workflow_status` (`workflow_status`),
  KEY `idx_deleted_at` (`deleted_at`),
  CONSTRAINT `report_ibfk_1` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `report_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `report` WRITE;
/*!40000 ALTER TABLE `report` DISABLE KEYS */;
INSERT INTO `report` VALUES ('report-001','clinic-001','Monthly Performance Report','performance','April 2026 clinic performance metrics','{\"month\": \"2026-04\"}','{\"revenue\": 8500, \"no_shows\": 3, \"completed\": 42, \"total_appointments\": 45}','draft',NULL,NULL,NULL,NULL,NULL,NULL,'user-001','2026-04-24 13:23:30','2026-04-24 13:23:30',NULL),('report-002','clinic-001','No-Show Analysis','no_show','Analysis of no-show patterns and recovery','{\"period\": \"monthly\"}','{\"main_reason\": \"Forgot appointment\", \"recovery_rate\": 0.67, \"total_no_shows\": 3}','draft',NULL,NULL,NULL,NULL,NULL,NULL,'user-001','2026-04-24 13:23:30','2026-04-24 13:23:30',NULL),('report-003','clinic-001','Patient Satisfaction','satisfaction','Patient satisfaction survey results','{\"rating_min\": 3}','{\"avg_rating\": 4.4, \"total_reviews\": 10, \"positive_feedback\": 9}','draft',NULL,NULL,NULL,NULL,NULL,NULL,'user-001','2026-04-24 13:23:30','2026-04-24 13:23:30',NULL),('report-004','clinic-002','Revenue Report','financial','April 2026 revenue and expenses','{\"month\": \"2026-04\"}','{\"expenses\": 3500, \"net_profit\": 8500, \"total_revenue\": 12000}','draft',NULL,NULL,NULL,NULL,NULL,NULL,'user-004','2026-04-24 13:23:30','2026-04-24 13:23:30',NULL),('report-005','clinic-002','Patient Demographics','demographics','Patient demographics analysis','{\"status\": \"active\"}','{\"age_range\": \"25-65\", \"gender_split\": \"45% M, 55% F\", \"total_patients\": 250}','draft',NULL,NULL,NULL,NULL,NULL,NULL,'user-004','2026-04-24 13:23:30','2026-04-24 13:23:30',NULL),('report-006','clinic-003','Treatment Outcomes','clinical','Treatment success rates and outcomes','{\"outcome\": \"Success\"}','{\"success_rate\": 0.92, \"recovery_rate\": 0.88, \"avg_treatment_duration\": \"6 weeks\"}','draft',NULL,NULL,NULL,NULL,NULL,NULL,'user-006','2026-04-24 13:23:30','2026-04-24 13:23:30',NULL),('report-007','clinic-003','Marketing ROI','marketing','Marketing campaign ROI analysis','{\"status\": \"active\"}','{\"roi\": 2.25, \"conversions\": 45, \"total_spend\": 2000}','draft',NULL,NULL,NULL,NULL,NULL,NULL,'user-006','2026-04-24 13:23:30','2026-04-24 13:23:30',NULL),('report-008','clinic-004','Appointment Trends','operational','Appointment booking and completion trends','{\"period\": \"monthly\"}','{\"avg_wait_time\": \"3 days\", \"bookings_trend\": \"up 15%\", \"cancellation_rate\": 0.08}','draft',NULL,NULL,NULL,NULL,NULL,NULL,'user-008','2026-04-24 13:23:30','2026-04-24 13:23:30',NULL),('report-009','clinic-004','Staff Performance','hr','Staff performance metrics','{\"period\": \"monthly\"}','{\"total_staff\": 8, \"satisfaction_score\": 4.2, \"avg_appointments_per_staff\": 5.6}','draft',NULL,NULL,NULL,NULL,NULL,NULL,'user-008','2026-04-24 13:23:30','2026-04-24 13:23:30',NULL),('report-010','clinic-005','Quarterly Summary','summary','Q2 2026 quarterly summary','{\"quarter\": \"Q2\"}','{\"revenue\": 35000, \"growth_rate\": 0.12, \"total_patients\": 320}','draft',NULL,NULL,NULL,NULL,NULL,NULL,'user-010','2026-04-24 13:23:30','2026-04-24 13:23:30',NULL);
/*!40000 ALTER TABLE `report` ENABLE KEYS */;
UNLOCK TABLES;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `report_share` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `report_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `token_hash` char(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_by` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `last_accessed_at` timestamp NULL DEFAULT NULL,
  `revoked_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_report_share_token_hash` (`token_hash`),
  KEY `idx_report_share_report` (`report_id`),
  KEY `idx_report_share_clinic` (`clinic_id`),
  KEY `idx_report_share_deleted` (`deleted_at`),
  KEY `fk_report_share_created_by` (`created_by`),
  CONSTRAINT `fk_report_share_clinic` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_report_share_created_by` FOREIGN KEY (`created_by`) REFERENCES `user` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_report_share_report` FOREIGN KEY (`report_id`) REFERENCES `report` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `report_share` WRITE;
/*!40000 ALTER TABLE `report_share` DISABLE KEYS */;
/*!40000 ALTER TABLE `report_share` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `review`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `review` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `contact_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `rating` int DEFAULT NULL,
  `comment` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `source` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_clinic_id` (`clinic_id`),
  KEY `idx_contact_id` (`contact_id`),
  KEY `idx_rating` (`rating`),
  KEY `idx_deleted_at` (`deleted_at`),
  CONSTRAINT `review_ibfk_1` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `review_ibfk_2` FOREIGN KEY (`contact_id`) REFERENCES `contact` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `review` WRITE;
/*!40000 ALTER TABLE `review` DISABLE KEYS */;
INSERT INTO `review` VALUES ('review-001','clinic-001','contact-001',5,'Excellent service! Staff was very professional and caring.','google','published','2026-04-24 13:23:13','2026-04-24 13:23:13',NULL),('review-002','clinic-001','contact-002',4,'Good treatment and helpful advice. Would recommend.','trustpilot','published','2026-04-24 13:23:13','2026-04-24 13:23:13',NULL),('review-003','clinic-001','contact-003',5,'Outstanding results! Pain completely gone after treatment.','google','published','2026-04-24 13:23:13','2026-04-24 13:23:13',NULL),('review-004','clinic-001','contact-004',3,'Decent service but had to wait a long time.','trustpilot','published','2026-04-24 13:23:13','2026-04-24 13:23:13',NULL),('review-005','clinic-002','contact-005',5,'Very professional team. Great experience overall.','google','published','2026-04-24 13:23:13','2026-04-24 13:23:13',NULL),('review-006','clinic-002','contact-006',4,'Good treatment plan and follow-up care.','trustpilot','published','2026-04-24 13:23:13','2026-04-24 13:23:13',NULL),('review-007','clinic-003','contact-007',5,'Excellent sports medicine expertise. Highly recommended.','google','published','2026-04-24 13:23:13','2026-04-24 13:23:13',NULL),('review-008','clinic-003','contact-008',4,'Good pain management support. Very helpful staff.','trustpilot','published','2026-04-24 13:23:13','2026-04-24 13:23:13',NULL),('review-009','clinic-004','contact-009',5,'Fantastic mental health support. Changed my life!','google','published','2026-04-24 13:23:13','2026-04-24 13:23:13',NULL),('review-010','clinic-004','contact-010',5,'Excellent therapy sessions. Highly professional.','trustpilot','published','2026-04-24 13:23:13','2026-04-24 13:23:13',NULL);
/*!40000 ALTER TABLE `review` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `role`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `role` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `display_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `permissions` json DEFAULT NULL,
  `is_system` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_clinic_role` (`clinic_id`,`name`),
  KEY `idx_clinic_id` (`clinic_id`),
  KEY `idx_role_name` (`name`),
  KEY `idx_deleted_at` (`deleted_at`),
  CONSTRAINT `role_ibfk_1` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `role` WRITE;
/*!40000 ALTER TABLE `role` DISABLE KEYS */;
INSERT INTO `role` VALUES ('role-001','clinic-001','SUPER_ADMIN','Super admin with full access',NULL,'{\"manage_roles\": true, \"manage_users\": true, \"view_all_clinics\": true}',0,'2026-04-24 13:22:11','2026-04-24 13:22:11',NULL),('role-002','clinic-001','CLINIC_ADMIN','Clinic admin',NULL,'{\"manage_roles\": true, \"manage_users\": true, \"view_reports\": true}',0,'2026-04-24 13:22:11','2026-04-24 13:22:11',NULL),('role-003','clinic-001','CLINICIAN','Clinician',NULL,'{\"edit_contacts\": true, \"view_contacts\": true, \"create_appointments\": true}',0,'2026-04-24 13:22:11','2026-04-24 13:22:11',NULL),('role-004','clinic-001','RECEPTIONIST','Receptionist',NULL,'{\"view_contacts\": true, \"manage_calendar\": true, \"create_appointments\": true}',0,'2026-04-24 13:22:11','2026-04-24 13:22:11',NULL),('role-005','clinic-002','SUPER_ADMIN','Super admin with full access',NULL,'{\"manage_roles\": true, \"manage_users\": true, \"view_all_clinics\": true}',0,'2026-04-24 13:22:11','2026-04-24 13:22:11',NULL),('role-006','clinic-002','CLINIC_ADMIN','Clinic admin',NULL,'{\"manage_roles\": true, \"manage_users\": true, \"view_reports\": true}',0,'2026-04-24 13:22:11','2026-04-24 13:22:11',NULL),('role-007','clinic-003','CLINICIAN','Clinician',NULL,'{\"edit_contacts\": true, \"view_contacts\": true, \"create_appointments\": true}',0,'2026-04-24 13:22:11','2026-04-24 13:22:11',NULL),('role-008','clinic-003','RECEPTIONIST','Receptionist',NULL,'{\"view_contacts\": true, \"manage_calendar\": true, \"create_appointments\": true}',0,'2026-04-24 13:22:11','2026-04-24 13:22:11',NULL),('role-009','clinic-004','SUPER_ADMIN','Super admin with full access',NULL,'{\"manage_roles\": true, \"manage_users\": true, \"view_all_clinics\": true}',0,'2026-04-24 13:22:11','2026-04-24 13:22:11',NULL),('role-010','clinic-004','CLINIC_ADMIN','Clinic admin',NULL,'{\"manage_roles\": true, \"manage_users\": true, \"view_reports\": true}',0,'2026-04-24 13:22:11','2026-04-24 13:22:11',NULL),('role-clinic-admin',NULL,'CLINIC_ADMIN',NULL,'Clinic Admin',NULL,1,'2026-06-01 22:07:33','2026-06-01 22:07:33',NULL),('role-clinician',NULL,'CLINICIAN',NULL,'Clinician',NULL,1,'2026-06-01 22:07:33','2026-06-01 22:07:33',NULL),('role-patient',NULL,'patient',NULL,'Patient',NULL,1,'2026-06-01 22:07:33','2026-06-01 22:07:33',NULL),('role-read-only',NULL,'READ_ONLY',NULL,'Read Only',NULL,1,'2026-06-01 22:07:33','2026-06-01 22:07:33',NULL),('role-receptionist',NULL,'RECEPTIONIST',NULL,'Receptionist',NULL,1,'2026-06-01 22:07:33','2026-06-01 22:07:33',NULL),('role-super-admin',NULL,'SUPER_ADMIN',NULL,'Super Admin',NULL,1,'2026-06-01 22:07:33','2026-06-01 22:07:33',NULL);
/*!40000 ALTER TABLE `role` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `role_permission`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `role_permission` (
  `role_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `permission_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`role_id`,`permission_id`),
  KEY `idx_role_permission_permission` (`permission_id`),
  CONSTRAINT `fk_role_permission_permission` FOREIGN KEY (`permission_id`) REFERENCES `permission` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_role_permission_role` FOREIGN KEY (`role_id`) REFERENCES `role` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `role_permission` WRITE;
/*!40000 ALTER TABLE `role_permission` DISABLE KEYS */;
INSERT INTO `role_permission` VALUES
('role-001','perm-client-accounts-read','2026-06-05 00:00:00'),
('role-001','perm-client-accounts-write','2026-06-05 00:00:00'),
('role-001','perm-sops-read','2026-06-05 00:00:00'),
('role-001','perm-sops-write','2026-06-05 00:00:00'),
('role-001','perm-strategy-logs-read','2026-06-05 00:00:00'),
('role-001','perm-strategy-logs-write','2026-06-05 00:00:00'),
('role-002','perm-client-accounts-read','2026-06-05 00:00:00'),
('role-002','perm-client-accounts-write','2026-06-05 00:00:00'),
('role-002','perm-sops-read','2026-06-05 00:00:00'),
('role-002','perm-sops-write','2026-06-05 00:00:00'),
('role-002','perm-strategy-logs-read','2026-06-05 00:00:00'),
('role-002','perm-strategy-logs-write','2026-06-05 00:00:00'),
('role-005','perm-client-accounts-read','2026-06-05 00:00:00'),
('role-005','perm-client-accounts-write','2026-06-05 00:00:00'),
('role-005','perm-sops-read','2026-06-05 00:00:00'),
('role-005','perm-sops-write','2026-06-05 00:00:00'),
('role-005','perm-strategy-logs-read','2026-06-05 00:00:00'),
('role-005','perm-strategy-logs-write','2026-06-05 00:00:00'),
('role-006','perm-client-accounts-read','2026-06-05 00:00:00'),
('role-006','perm-client-accounts-write','2026-06-05 00:00:00'),
('role-006','perm-sops-read','2026-06-05 00:00:00'),
('role-006','perm-sops-write','2026-06-05 00:00:00'),
('role-006','perm-strategy-logs-read','2026-06-05 00:00:00'),
('role-006','perm-strategy-logs-write','2026-06-05 00:00:00'),
('role-009','perm-client-accounts-read','2026-06-05 00:00:00'),
('role-009','perm-client-accounts-write','2026-06-05 00:00:00'),
('role-009','perm-sops-read','2026-06-05 00:00:00'),
('role-009','perm-sops-write','2026-06-05 00:00:00'),
('role-009','perm-strategy-logs-read','2026-06-05 00:00:00'),
('role-009','perm-strategy-logs-write','2026-06-05 00:00:00'),
('role-010','perm-client-accounts-read','2026-06-05 00:00:00'),
('role-010','perm-client-accounts-write','2026-06-05 00:00:00'),
('role-010','perm-sops-read','2026-06-05 00:00:00'),
('role-010','perm-sops-write','2026-06-05 00:00:00'),
('role-010','perm-strategy-logs-read','2026-06-05 00:00:00'),
('role-010','perm-strategy-logs-write','2026-06-05 00:00:00'),
('role-clinic-admin','perm-client-accounts-read','2026-06-05 00:00:00'),
('role-clinic-admin','perm-client-accounts-write','2026-06-05 00:00:00'),
('role-clinic-admin','perm-sops-read','2026-06-05 00:00:00'),
('role-clinic-admin','perm-sops-write','2026-06-05 00:00:00'),
('role-clinic-admin','perm-strategy-logs-read','2026-06-05 00:00:00'),
('role-clinic-admin','perm-strategy-logs-write','2026-06-05 00:00:00'),
('role-read-only','perm-client-accounts-read','2026-06-05 00:00:00'),
('role-read-only','perm-sops-read','2026-06-05 00:00:00'),
('role-read-only','perm-strategy-logs-read','2026-06-05 00:00:00'),
('role-super-admin','perm-client-accounts-read','2026-06-05 00:00:00'),
('role-super-admin','perm-client-accounts-write','2026-06-05 00:00:00'),
('role-super-admin','perm-sops-read','2026-06-05 00:00:00'),
('role-super-admin','perm-sops-write','2026-06-05 00:00:00'),
('role-super-admin','perm-strategy-logs-read','2026-06-05 00:00:00'),
('role-super-admin','perm-strategy-logs-write','2026-06-05 00:00:00');
INSERT INTO `role_permission` VALUES
('role-001','perm-internal-tasks-read','2026-06-05 00:00:00'),
('role-001','perm-internal-tasks-write','2026-06-05 00:00:00'),
('role-002','perm-internal-tasks-read','2026-06-05 00:00:00'),
('role-002','perm-internal-tasks-write','2026-06-05 00:00:00'),
('role-005','perm-internal-tasks-read','2026-06-05 00:00:00'),
('role-005','perm-internal-tasks-write','2026-06-05 00:00:00'),
('role-006','perm-internal-tasks-read','2026-06-05 00:00:00'),
('role-006','perm-internal-tasks-write','2026-06-05 00:00:00'),
('role-009','perm-internal-tasks-read','2026-06-05 00:00:00'),
('role-009','perm-internal-tasks-write','2026-06-05 00:00:00'),
('role-010','perm-internal-tasks-read','2026-06-05 00:00:00'),
('role-010','perm-internal-tasks-write','2026-06-05 00:00:00'),
('role-clinic-admin','perm-internal-tasks-read','2026-06-05 00:00:00'),
('role-clinic-admin','perm-internal-tasks-write','2026-06-05 00:00:00'),
('role-read-only','perm-internal-tasks-read','2026-06-05 00:00:00'),
('role-super-admin','perm-internal-tasks-read','2026-06-05 00:00:00'),
('role-super-admin','perm-internal-tasks-write','2026-06-05 00:00:00');
INSERT INTO `role_permission` VALUES ('role-clinic-admin','perm-appointments-delete','2026-06-01 22:07:33'),('role-clinic-admin','perm-appointments-read','2026-06-01 22:07:33'),('role-clinic-admin','perm-appointments-write','2026-06-01 22:07:33'),('role-clinic-admin','perm-audit-read','2026-06-01 22:07:33'),('role-clinic-admin','perm-billing-read','2026-06-01 22:07:33'),('role-clinic-admin','perm-billing-write','2026-06-01 22:07:33'),('role-clinic-admin','perm-calls-read','2026-06-01 22:07:33'),('role-clinic-admin','perm-calls-write','2026-06-01 22:07:33'),('role-clinic-admin','perm-contacts-delete','2026-06-01 22:07:33'),('role-clinic-admin','perm-contacts-read','2026-06-01 22:07:33'),('role-clinic-admin','perm-contacts-write','2026-06-01 22:07:33'),('role-clinic-admin','perm-events-read','2026-06-01 22:07:33'),('role-clinic-admin','perm-events-write','2026-06-01 22:07:33'),('role-clinic-admin','perm-marketing-read','2026-06-01 22:07:33'),('role-clinic-admin','perm-marketing-write','2026-06-01 22:07:33'),('role-clinic-admin','perm-reports-read','2026-06-01 22:07:33'),('role-clinic-admin','perm-reports-write','2026-06-01 22:07:33'),('role-clinic-admin','perm-settings-read','2026-06-01 22:07:33'),('role-clinic-admin','perm-settings-write','2026-06-01 22:07:33'),('role-clinic-admin','perm-team-read','2026-06-01 22:07:33'),('role-clinic-admin','perm-team-write','2026-06-01 22:07:33'),('role-clinic-admin','perm-webhooks-read','2026-06-01 22:07:33'),('role-clinic-admin','perm-webhooks-write','2026-06-01 22:07:33'),('role-clinician','perm-appointments-read','2026-06-01 22:07:33'),('role-clinician','perm-appointments-write','2026-06-01 22:07:33'),('role-clinician','perm-calls-read','2026-06-01 22:07:33'),('role-clinician','perm-calls-write','2026-06-01 22:07:33'),('role-clinician','perm-contacts-read','2026-06-01 22:07:33'),('role-clinician','perm-contacts-write','2026-06-01 22:07:33'),('role-clinician','perm-events-read','2026-06-01 22:07:33'),('role-clinician','perm-reports-read','2026-06-01 22:07:33'),('role-patient','perm-contacts-read','2026-06-01 22:07:33'),('role-patient','perm-contacts-write','2026-06-01 22:07:33'),('role-read-only','perm-appointments-read','2026-06-01 22:07:33'),('role-read-only','perm-audit-read','2026-06-01 22:07:33'),('role-read-only','perm-billing-read','2026-06-01 22:07:33'),('role-read-only','perm-calls-read','2026-06-01 22:07:33'),('role-read-only','perm-contacts-read','2026-06-01 22:07:33'),('role-read-only','perm-events-read','2026-06-01 22:07:33'),('role-read-only','perm-marketing-read','2026-06-01 22:07:33'),('role-read-only','perm-reports-read','2026-06-01 22:07:33'),('role-read-only','perm-settings-read','2026-06-01 22:07:33'),('role-read-only','perm-team-read','2026-06-01 22:07:33'),('role-read-only','perm-webhooks-read','2026-06-01 22:07:33'),('role-receptionist','perm-appointments-read','2026-06-01 22:07:33'),('role-receptionist','perm-appointments-write','2026-06-01 22:07:33'),('role-receptionist','perm-calls-read','2026-06-01 22:07:33'),('role-receptionist','perm-calls-write','2026-06-01 22:07:33'),('role-receptionist','perm-contacts-read','2026-06-01 22:07:33'),('role-receptionist','perm-contacts-write','2026-06-01 22:07:33'),('role-super-admin','perm-all','2026-06-01 22:07:33');
/*!40000 ALTER TABLE `role_permission` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `schema_migration`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `schema_migration` (
  `filename` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `checksum_sha256` char(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `applied_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`filename`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `schema_migration` WRITE;
/*!40000 ALTER TABLE `schema_migration` DISABLE KEYS */;
/*!40000 ALTER TABLE `schema_migration` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `sla_breach`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sla_breach` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `contact_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `target_minutes` int NOT NULL DEFAULT '5',
  `deadline_at` datetime NOT NULL,
  `breached_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `first_response_at` datetime DEFAULT NULL,
  `status` enum('open','resolved') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'open',
  `resolved_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_sla_breach_contact` (`contact_id`),
  KEY `idx_sla_breach_clinic_status` (`clinic_id`,`status`,`breached_at`),
  CONSTRAINT `fk_sla_breach_clinic` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_sla_breach_contact` FOREIGN KEY (`contact_id`) REFERENCES `contact` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `sla_breach` WRITE;
/*!40000 ALTER TABLE `sla_breach` DISABLE KEYS */;
/*!40000 ALTER TABLE `sla_breach` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `sms`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sms` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `contact_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `message` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `direction` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `call_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `call_followup` tinyint(1) NOT NULL DEFAULT '0',
  `provider_message_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `provider_response` longtext COLLATE utf8mb4_unicode_ci,
  `provider_error` longtext COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  KEY `idx_clinic_id` (`clinic_id`),
  KEY `idx_contact_id` (`contact_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_deleted_at` (`deleted_at`),
  KEY `idx_sms_call_id` (`call_id`),
  CONSTRAINT `sms_ibfk_1` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `sms_ibfk_2` FOREIGN KEY (`contact_id`) REFERENCES `contact` (`id`) ON DELETE CASCADE,
  CONSTRAINT `sms_ibfk_3` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `sms` WRITE;
/*!40000 ALTER TABLE `sms` DISABLE KEYS */;
INSERT INTO `sms` VALUES ('sms-001','clinic-001','contact-001','user-002','Hi John, reminder: your appointment is tomorrow at 09:00 in Room A. Please reply to confirm.','outbound','sent','2026-04-24 13:22:59','2026-04-24 13:22:59',NULL,NULL,0,NULL,NULL,NULL),('sms-002','clinic-001','contact-002','user-002','Jane, your follow-up appointment is on 2026-04-29 at 10:00. See you soon!','outbound','sent','2026-04-24 13:22:59','2026-04-24 13:22:59',NULL,NULL,0,NULL,NULL,NULL),('sms-003','clinic-001','contact-003','user-002','Robert, great progress! Keep doing your exercises daily. Next appointment: 2026-05-05.','outbound','sent','2026-04-24 13:22:59','2026-04-24 13:22:59',NULL,NULL,0,NULL,NULL,NULL),('sms-004','clinic-001','contact-004','user-002','Patricia, we missed you on 2026-05-01. Please reschedule your appointment. Reply ASAP.','outbound','sent','2026-04-24 13:22:59','2026-04-24 13:22:59',NULL,NULL,0,NULL,NULL,NULL),('sms-005','clinic-002','contact-005','user-005','Michael, welcome to Manchester Health Centre! Your appointment is 2026-04-27 at 09:30.','outbound','sent','2026-04-24 13:22:59','2026-04-24 13:22:59',NULL,NULL,0,NULL,NULL,NULL),('sms-006','clinic-002','contact-006','user-005','Sarah, your treatment plan is ready. Please review the details sent via email.','outbound','sent','2026-04-24 13:22:59','2026-04-24 13:22:59',NULL,NULL,0,NULL,NULL,NULL),('sms-007','clinic-003','contact-007','user-007','David, your sports injury assessment is complete. Recovery plan attached in email.','outbound','sent','2026-04-24 13:22:59','2026-04-24 13:22:59',NULL,NULL,0,NULL,NULL,NULL),('sms-008','clinic-003','contact-008','user-007','Emma, reminder: pain management session on 2026-05-03 at 13:00. Confirm attendance.','outbound','sent','2026-04-24 13:22:59','2026-04-24 13:22:59',NULL,NULL,0,NULL,NULL,NULL),('sms-009','clinic-004','contact-009','user-008','Christopher, your consultation is today at 11:00 in Room 1. See you soon!','outbound','sent','2026-04-24 13:22:59','2026-04-24 13:22:59',NULL,NULL,0,NULL,NULL,NULL),('sms-010','clinic-004','contact-010','user-009','Lisa, therapy session reminder: 2026-05-04 at 16:00 in Room 2. Please confirm.','outbound','sent','2026-04-24 13:22:59','2026-04-24 13:22:59',NULL,NULL,0,NULL,NULL,NULL);
/*!40000 ALTER TABLE `sms` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `sop`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sop` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'General',
  `content` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `owner` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('draft','published','archived') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft',
  `created_by` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_sop_clinic` (`clinic_id`),
  KEY `idx_sop_search` (`clinic_id`,`status`,`category`,`deleted_at`),
  KEY `fk_sop_user` (`created_by`),
  CONSTRAINT `fk_sop_clinic` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_sop_user` FOREIGN KEY (`created_by`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `sop` WRITE;
/*!40000 ALTER TABLE `sop` DISABLE KEYS */;
/*!40000 ALTER TABLE `sop` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `strategy_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `strategy_log` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `client_account_profile_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `log_month` date NOT NULL,
  `log_type` enum('strategy','meeting') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'strategy',
  `meeting_notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `seo_plan` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `ppc_plan` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `landing_page_plan` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `kpi_notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `decisions` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `next_actions` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `owner_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_by` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `updated_by` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `archived_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_strategy_log_clinic` (`clinic_id`),
  KEY `idx_strategy_log_profile` (`client_account_profile_id`),
  KEY `idx_strategy_log_owner` (`owner_id`),
  KEY `idx_strategy_log_filter` (`clinic_id`,`client_account_profile_id`,`log_month`,`owner_id`,`log_type`,`archived_at`),
  KEY `fk_strategy_log_created_by` (`created_by`),
  KEY `fk_strategy_log_updated_by` (`updated_by`),
  CONSTRAINT `fk_strategy_log_clinic` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_strategy_log_created_by` FOREIGN KEY (`created_by`) REFERENCES `user` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_strategy_log_owner` FOREIGN KEY (`owner_id`) REFERENCES `user` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_strategy_log_profile` FOREIGN KEY (`client_account_profile_id`) REFERENCES `client_account_profile` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_strategy_log_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `strategy_log` WRITE;
/*!40000 ALTER TABLE `strategy_log` DISABLE KEYS */;
/*!40000 ALTER TABLE `strategy_log` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `subscription_plan`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `subscription_plan` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `price` decimal(12,2) DEFAULT NULL,
  `billing_cycle` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `max_users` int DEFAULT NULL,
  `max_contacts` int DEFAULT NULL,
  `features` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`),
  KEY `idx_deleted_at` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `subscription_plan` WRITE;
/*!40000 ALTER TABLE `subscription_plan` DISABLE KEYS */;
INSERT INTO `subscription_plan` VALUES ('plan-001','Starter','Perfect for small clinics',99.00,'monthly',5,500,'[\"CRM\", \"Booking\", \"Basic Reports\"]','2026-04-24 13:23:20','2026-04-24 13:23:20',NULL),('plan-002','Professional','For growing clinics',299.00,'monthly',20,5000,'[\"CRM\", \"Booking\", \"Advanced Reports\", \"Marketing\", \"Integrations\"]','2026-04-24 13:23:20','2026-04-24 13:23:20',NULL),('plan-003','Enterprise','For large clinic networks',999.00,'monthly',100,50000,'[\"All Features\", \"Multi-Location\", \"API Access\", \"Dedicated Support\"]','2026-04-24 13:23:20','2026-04-24 13:23:20',NULL),('plan-004','Starter Plus','Enhanced starter plan',149.00,'monthly',10,1000,'[\"CRM\", \"Booking\", \"Reports\", \"Email Marketing\"]','2026-04-24 13:23:20','2026-04-24 13:23:20',NULL),('plan-005','Professional Plus','Enhanced professional plan',399.00,'monthly',30,10000,'[\"All Professional Features\", \"Advanced Analytics\", \"AI Agents\"]','2026-04-24 13:23:20','2026-04-24 13:23:20',NULL),('plan-006','Basic','Entry level plan',49.00,'monthly',3,200,'[\"CRM\", \"Basic Booking\"]','2026-04-24 13:23:20','2026-04-24 13:23:20',NULL),('plan-007','Growth','For expanding clinics',499.00,'monthly',50,20000,'[\"All Professional Features\", \"Multi-Location\", \"Custom Reports\"]','2026-04-24 13:23:20','2026-04-24 13:23:20',NULL),('plan-008','Premium','Premium features package',599.00,'monthly',75,30000,'[\"All Features\", \"Priority Support\", \"Custom Integrations\"]','2026-04-24 13:23:20','2026-04-24 13:23:20',NULL),('plan-009','Elite','Top tier plan',1499.00,'monthly',200,100000,'[\"All Features\", \"White Label\", \"Dedicated Account Manager\"]','2026-04-24 13:23:20','2026-04-24 13:23:20',NULL),('plan-010','Trial','Free trial plan',0.00,'monthly',2,50,'[\"Limited CRM\", \"Limited Booking\", \"Basic Features\"]','2026-04-24 13:23:20','2026-04-24 13:23:20',NULL);
/*!40000 ALTER TABLE `subscription_plan` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `task`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `task` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_internal` tinyint(1) NOT NULL DEFAULT '0',
  `title` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `priority` enum('low','medium','high') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'medium',
  `status` enum('pending','completed') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `category` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `board_key` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `service_type` enum('ppc','seo','gbp','website','landing_pages','cro','strategy','other') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `client_account_profile_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `client_account_service_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `contact_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `due_label` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `due_date` date DEFAULT NULL,
  `assigned_to` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `assigned_user_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `proof_reference` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `workflow_month` date DEFAULT NULL,
  `template_key` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `recurrence_rule` json DEFAULT NULL,
  `completed_at` timestamp NULL DEFAULT NULL,
  `archived_at` timestamp NULL DEFAULT NULL,
  `needs_qa` tinyint(1) NOT NULL DEFAULT '0',
  `qa_checklist` json DEFAULT NULL,
  `approval_status` enum('not_required','pending','approved','rejected','needs_changes') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'not_required',
  `reviewer_user_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `completion_proof_reference` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `missed_task` tinyint(1) NOT NULL DEFAULT '0',
  `escalation_flag` tinyint(1) NOT NULL DEFAULT '0',
  `freelancer_team_score` decimal(5,2) DEFAULT NULL,
  `qa_updated_at` timestamp NULL DEFAULT NULL,
  `created_by` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_task_clinic` (`clinic_id`),
  KEY `idx_task_internal_board` (`clinic_id`,`is_internal`,`board_key`,`status`,`archived_at`),
  KEY `idx_task_internal_due` (`clinic_id`,`is_internal`,`due_date`,`status`,`archived_at`),
  KEY `idx_task_client_account` (`client_account_profile_id`),
  KEY `idx_task_client_service` (`client_account_service_id`),
  KEY `idx_task_assigned_user` (`assigned_user_id`),
  KEY `idx_task_internal_qa` (`clinic_id`,`is_internal`,`needs_qa`,`approval_status`,`archived_at`),
  KEY `idx_task_internal_flags` (`clinic_id`,`is_internal`,`missed_task`,`escalation_flag`,`archived_at`),
  KEY `idx_task_reviewer_user` (`reviewer_user_id`),
  KEY `fk_task_user` (`created_by`),
  CONSTRAINT `fk_task_assigned_user` FOREIGN KEY (`assigned_user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_task_client_account_profile` FOREIGN KEY (`client_account_profile_id`) REFERENCES `client_account_profile` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_task_client_account_service` FOREIGN KEY (`client_account_service_id`) REFERENCES `client_account_service` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_task_clinic` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_task_reviewer_user` FOREIGN KEY (`reviewer_user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_task_user` FOREIGN KEY (`created_by`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `task` WRITE;
/*!40000 ALTER TABLE `task` DISABLE KEYS */;
/*!40000 ALTER TABLE `task` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `insight`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `insight` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` varchar(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `severity` enum('low','medium','high','critical') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'medium',
  `title` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `summary` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `recommended_action` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `source_type` varchar(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `source_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `source_contact_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `action_task_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('open','in_progress','resolved','archived') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'open',
  `assigned_to` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `due_date` date DEFAULT NULL,
  `generated_from` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `dedupe_key` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `metadata` json DEFAULT NULL,
  `created_by` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `resolved_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_insight_clinic_status` (`clinic_id`,`status`,`deleted_at`),
  KEY `idx_insight_clinic_type` (`clinic_id`,`type`),
  KEY `idx_insight_source` (`clinic_id`,`source_type`,`source_id`),
  KEY `idx_insight_dedupe` (`clinic_id`,`dedupe_key`),
  KEY `idx_insight_assigned_to` (`assigned_to`),
  KEY `idx_insight_source_contact` (`source_contact_id`),
  KEY `idx_insight_action_task` (`action_task_id`),
  CONSTRAINT `fk_insight_action_task` FOREIGN KEY (`action_task_id`) REFERENCES `task` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_insight_assigned_to` FOREIGN KEY (`assigned_to`) REFERENCES `user` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_insight_clinic` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_insight_created_by` FOREIGN KEY (`created_by`) REFERENCES `user` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_insight_source_contact` FOREIGN KEY (`source_contact_id`) REFERENCES `contact` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `insight` WRITE;
/*!40000 ALTER TABLE `insight` DISABLE KEYS */;
/*!40000 ALTER TABLE `insight` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `monthly_action_plan`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `monthly_action_plan` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `plan_month` date NOT NULL,
  `status` enum('draft','active','completed','archived') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft',
  `title` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `summary` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `focus_metric` varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_by` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_monthly_action_plan_clinic_month` (`clinic_id`,`plan_month`,`deleted_at`),
  KEY `idx_monthly_action_plan_status` (`clinic_id`,`status`,`deleted_at`),
  KEY `fk_monthly_action_plan_created_by` (`created_by`),
  CONSTRAINT `fk_monthly_action_plan_clinic` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_monthly_action_plan_created_by` FOREIGN KEY (`created_by`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `monthly_action_plan` WRITE;
/*!40000 ALTER TABLE `monthly_action_plan` DISABLE KEYS */;
/*!40000 ALTER TABLE `monthly_action_plan` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `monthly_action_plan_item`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `monthly_action_plan_item` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `plan_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `task_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `insight_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `source_type` varchar(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `source_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `title` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `recommended_action` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `priority` enum('low','medium','high') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'medium',
  `status` enum('planned','in_progress','completed','skipped') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'planned',
  `sort_order` int NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_monthly_action_plan_item_plan_status` (`plan_id`,`status`,`deleted_at`),
  KEY `idx_monthly_action_plan_item_clinic` (`clinic_id`,`deleted_at`),
  KEY `idx_monthly_action_plan_item_task` (`task_id`),
  KEY `idx_monthly_action_plan_item_insight` (`insight_id`),
  KEY `idx_monthly_action_plan_item_source` (`clinic_id`,`source_type`,`source_id`),
  CONSTRAINT `fk_monthly_action_plan_item_clinic` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_monthly_action_plan_item_insight` FOREIGN KEY (`insight_id`) REFERENCES `insight` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_monthly_action_plan_item_plan` FOREIGN KEY (`plan_id`) REFERENCES `monthly_action_plan` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_monthly_action_plan_item_task` FOREIGN KEY (`task_id`) REFERENCES `task` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `monthly_action_plan_item` WRITE;
/*!40000 ALTER TABLE `monthly_action_plan_item` DISABLE KEYS */;
/*!40000 ALTER TABLE `monthly_action_plan_item` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tokens` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `active_clinic_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `token_hash` char(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `token_type` enum('access','refresh','api','reset_password','email_verify','2fa') COLLATE utf8mb4_unicode_ci NOT NULL,
  `expires_at` datetime NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `used_at` datetime DEFAULT NULL,
  `revoked` tinyint(1) NOT NULL DEFAULT '0',
  `replaced_by_token_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_token_hash` (`token_hash`),
  KEY `idx_tokens_user_type_revoked` (`user_id`,`token_type`,`revoked`),
  KEY `idx_tokens_active_clinic` (`active_clinic_id`),
  KEY `idx_tokens_replaced_by` (`replaced_by_token_id`),
  CONSTRAINT `fk_tokens_active_clinic` FOREIGN KEY (`active_clinic_id`) REFERENCES `clinic` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_tokens_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `tokens` WRITE;
/*!40000 ALTER TABLE `tokens` DISABLE KEYS */;
/*!40000 ALTER TABLE `tokens` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `treatment`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `treatment` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `contact_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `date` date NOT NULL,
  `outcome` enum('Success','PartialSuccess','Failed') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `clinician_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `next_review_date` date DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_clinic_id` (`clinic_id`),
  KEY `idx_contact_id` (`contact_id`),
  KEY `idx_clinician_id` (`clinician_id`),
  KEY `idx_deleted_at` (`deleted_at`),
  CONSTRAINT `treatment_ibfk_1` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `treatment_ibfk_2` FOREIGN KEY (`contact_id`) REFERENCES `contact` (`id`) ON DELETE CASCADE,
  CONSTRAINT `treatment_ibfk_3` FOREIGN KEY (`clinician_id`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `treatment` WRITE;
/*!40000 ALTER TABLE `treatment` DISABLE KEYS */;
INSERT INTO `treatment` VALUES ('treat-001','clinic-001','contact-001','Lower back pain treatment - stretching and strengthening','2026-04-20',NULL,'user-002','2026-05-10','2026-04-24 13:22:35','2026-04-24 13:22:35',NULL),('treat-002','clinic-001','contact-002','Lumbar pain management program','2026-04-15',NULL,'user-002','2026-05-05','2026-04-24 13:22:35','2026-04-24 13:22:35',NULL),('treat-003','clinic-001','contact-003','Post-injury rehabilitation','2026-03-01','Success','user-002',NULL,'2026-04-24 13:22:35','2026-04-24 13:22:35',NULL),('treat-004','clinic-001','contact-004','Preventative wellness program','2026-04-01',NULL,'user-002','2026-06-01','2026-04-24 13:22:35','2026-04-24 13:22:35',NULL),('treat-005','clinic-002','contact-005','Shoulder pain treatment - rotator cuff','2026-04-18',NULL,'user-005','2026-05-08','2026-04-24 13:22:35','2026-04-24 13:22:35',NULL),('treat-006','clinic-002','contact-006','Sports injury recovery program','2026-04-19',NULL,'user-005','2026-05-09','2026-04-24 13:22:35','2026-04-24 13:22:35',NULL),('treat-007','clinic-003','contact-007','Hamstring strain rehabilitation','2026-04-22',NULL,'user-007','2026-05-12','2026-04-24 13:22:35','2026-04-24 13:22:35',NULL),('treat-008','clinic-003','contact-008','Chronic pain management program','2026-02-01',NULL,'user-007','2026-05-01','2026-04-24 13:22:35','2026-04-24 13:22:35',NULL),('treat-009','clinic-004','contact-009','Anxiety and stress management','2026-04-21',NULL,'user-008','2026-05-11','2026-04-24 13:22:35','2026-04-24 13:22:35',NULL),('treat-010','clinic-004','contact-010','Therapy and counselling','2026-04-01',NULL,'user-009','2026-05-15','2026-04-24 13:22:35','2026-04-24 13:22:35',NULL);
/*!40000 ALTER TABLE `treatment` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `treatment_catalog`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `treatment_catalog` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `category` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Other',
  `duration_minutes` int DEFAULT NULL,
  `price_cents` int DEFAULT NULL,
  `average_value_cents` int DEFAULT NULL,
  `margin_percent` decimal(5,2) DEFAULT NULL,
  `priority` int NOT NULL DEFAULT '0',
  `is_high_ticket` tinyint(1) NOT NULL DEFAULT '0',
  `status` enum('active','inactive') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `created_by` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_treatment_catalog_name` (`clinic_id`,`name`),
  KEY `idx_treatment_catalog_clinic` (`clinic_id`),
  KEY `idx_treatment_catalog_category` (`clinic_id`,`category`),
  KEY `idx_treatment_catalog_priority` (`clinic_id`,`priority`),
  KEY `idx_treatment_catalog_status` (`status`),
  KEY `idx_treatment_catalog_deleted` (`deleted_at`),
  KEY `fk_treatment_catalog_created_by` (`created_by`),
  CONSTRAINT `fk_treatment_catalog_clinic` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_treatment_catalog_created_by` FOREIGN KEY (`created_by`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `treatment_catalog` WRITE;
/*!40000 ALTER TABLE `treatment_catalog` DISABLE KEYS */;
/*!40000 ALTER TABLE `treatment_catalog` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `treatment_plan`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `treatment_plan` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `contact_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `avatar` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `treatment` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `total_value` decimal(12,2) NOT NULL DEFAULT '0.00',
  `paid` decimal(12,2) NOT NULL DEFAULT '0.00',
  `outstanding` decimal(12,2) NOT NULL DEFAULT '0.00',
  `status` enum('active','completed','draft','archived') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft',
  `sessions` int NOT NULL DEFAULT '1',
  `sessions_completed` int NOT NULL DEFAULT '0',
  `next_session` date DEFAULT NULL,
  `practitioner` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_by` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_treatment_plan_clinic` (`clinic_id`),
  KEY `fk_treatment_plan_user` (`created_by`),
  CONSTRAINT `fk_treatment_plan_clinic` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_treatment_plan_user` FOREIGN KEY (`created_by`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `treatment_plan` WRITE;
/*!40000 ALTER TABLE `treatment_plan` DISABLE KEYS */;
/*!40000 ALTER TABLE `treatment_plan` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `treatment_plan_item`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `treatment_plan_item` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `treatment_plan_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `sort_order` int NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_treatment_plan_item_plan` (`treatment_plan_id`),
  CONSTRAINT `fk_treatment_plan_item_plan` FOREIGN KEY (`treatment_plan_id`) REFERENCES `treatment_plan` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `treatment_plan_item` WRITE;
/*!40000 ALTER TABLE `treatment_plan_item` DISABLE KEYS */;
/*!40000 ALTER TABLE `treatment_plan_item` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `usage_meter`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `usage_meter` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `metric_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `current_usage` int DEFAULT '0',
  `limit_value` int DEFAULT NULL,
  `period_start` date DEFAULT NULL,
  `period_end` date DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_clinic_metric` (`clinic_id`,`metric_name`),
  KEY `idx_clinic_id` (`clinic_id`),
  KEY `idx_deleted_at` (`deleted_at`),
  CONSTRAINT `usage_meter_ibfk_1` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `usage_meter` WRITE;
/*!40000 ALTER TABLE `usage_meter` DISABLE KEYS */;
INSERT INTO `usage_meter` VALUES ('usage-001','clinic-001','ai_agent_runs',45,1000,'2026-04-01','2026-04-30','2026-04-24 13:23:30','2026-04-24 13:23:30',NULL),('usage-002','clinic-001','api_calls',1200,5000,'2026-04-01','2026-04-30','2026-04-24 13:23:30','2026-04-24 13:23:30',NULL),('usage-003','clinic-001','storage_gb',15,100,'2026-04-01','2026-04-30','2026-04-24 13:23:30','2026-04-24 13:23:30',NULL),('usage-004','clinic-002','ai_agent_runs',78,1000,'2026-04-01','2026-04-30','2026-04-24 13:23:30','2026-04-24 13:23:30',NULL),('usage-005','clinic-002','api_calls',2100,5000,'2026-04-01','2026-04-30','2026-04-24 13:23:30','2026-04-24 13:23:30',NULL),('usage-006','clinic-003','ai_agent_runs',32,500,'2026-04-01','2026-04-30','2026-04-24 13:23:30','2026-04-24 13:23:30',NULL),('usage-007','clinic-003','api_calls',890,3000,'2026-04-01','2026-04-30','2026-04-24 13:23:30','2026-04-24 13:23:30',NULL),('usage-008','clinic-004','ai_agent_runs',56,500,'2026-04-01','2026-04-30','2026-04-24 13:23:30','2026-04-24 13:23:30',NULL),('usage-009','clinic-004','storage_gb',22,50,'2026-04-01','2026-04-30','2026-04-24 13:23:30','2026-04-24 13:23:30',NULL),('usage-010','clinic-005','ai_agent_runs',23,500,'2026-04-01','2026-04-30','2026-04-24 13:23:30','2026-04-24 13:23:30',NULL);
/*!40000 ALTER TABLE `usage_meter` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `user`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `first_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `last_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `role` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'user',
  `two_factor_enabled` tinyint(1) NOT NULL DEFAULT '0',
  `two_factor_secret` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `two_factor_backup_codes` json DEFAULT NULL,
  `email_verified_at` timestamp NULL DEFAULT NULL,
  `failed_login_count` int NOT NULL DEFAULT '0',
  `locked_until` datetime DEFAULT NULL,
  `status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'active',
  `is_active` tinyint(1) DEFAULT '1',
  `last_login` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  KEY `idx_clinic_id` (`clinic_id`),
  KEY `idx_user_locked_until` (`locked_until`),
  KEY `idx_deleted_at` (`deleted_at`),
  CONSTRAINT `user_ibfk_1` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `user` WRITE;
/*!40000 ALTER TABLE `user` DISABLE KEYS */;
INSERT INTO `user` VALUES ('user-001','clinic-001',' admin@wellnessclinic.co.uk ','$2b$12$hash1','Sarah','Johnson','07700 900001','SUPER_ADMIN',0,NULL,NULL,NULL,0,NULL,'active',1,NULL,'2026-04-24 13:22:11','2026-04-24 13:22:11',NULL),('user-002','clinic-001',' clinician1@wellnessclinic.co.uk ','$2b$12$hash2','James','Smith','07700 900002','CLINICIAN',0,NULL,NULL,NULL,0,NULL,'active',1,NULL,'2026-04-24 13:22:11','2026-04-24 13:22:11',NULL),('user-003','clinic-001',' receptionist1@wellnessclinic.co.uk ','$2b$12$hash3','Emma','Brown','07700 900003','RECEPTIONIST',0,NULL,NULL,NULL,0,NULL,'active',1,NULL,'2026-04-24 13:22:11','2026-04-24 13:22:11',NULL),('user-004','clinic-002',' admin@manchesterhc.co.uk ','$2b$12$hash4','Michael','Wilson','07700 900004','SUPER_ADMIN',0,NULL,NULL,NULL,0,NULL,'active',1,NULL,'2026-04-24 13:22:11','2026-04-24 13:22:11',NULL),('user-005','clinic-002',' clinician1@manchesterhc.co.uk ','$2b$12$hash5','Lisa','Davis','07700 900005','CLINICIAN',0,NULL,NULL,NULL,0,NULL,'active',1,NULL,'2026-04-24 13:22:11','2026-04-24 13:22:11',NULL),('user-006','clinic-003',' admin@edinburghphysio.co.uk ','$2b$12$hash6','Robert','Miller','07700 900006','CLINIC_ADMIN',0,NULL,NULL,NULL,0,NULL,'active',1,NULL,'2026-04-24 13:22:11','2026-04-24 13:22:11',NULL),('user-007','clinic-003',' clinician2@edinburghphysio.co.uk ','$2b$12$hash7','Jennifer','Taylor','07700 900007','CLINICIAN',0,NULL,NULL,NULL,0,NULL,'active',1,NULL,'2026-04-24 13:22:11','2026-04-24 13:22:11',NULL),('user-008','clinic-004',' admin@bristolwellness.co.uk ','$2b$12$hash8','David','Anderson','07700 900008','SUPER_ADMIN',0,NULL,NULL,NULL,0,NULL,'active',1,NULL,'2026-04-24 13:22:11','2026-04-24 13:22:11',NULL),('user-009','clinic-004',' receptionist2@bristolwellness.co.uk ','$2b$12$hash9','Sophie','Thomas','07700 900009','RECEPTIONIST',0,NULL,NULL,NULL,0,NULL,'active',1,NULL,'2026-04-24 13:22:11','2026-04-24 13:22:11',NULL),('user-010','clinic-005',' admin@leedsrehab.co.uk ','$2b$12$hash10','Christopher','Jackson','07700 900010','SUPER_ADMIN',0,NULL,NULL,NULL,0,NULL,'active',1,NULL,'2026-04-24 13:22:11','2026-04-24 13:22:11',NULL);
/*!40000 ALTER TABLE `user` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `clinic_membership`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `clinic_membership` (
  `user_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `is_primary` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`,`clinic_id`),
  KEY `idx_clinic_membership_clinic` (`clinic_id`,`status`),
  KEY `idx_clinic_membership_user_status` (`user_id`,`status`),
  CONSTRAINT `fk_clinic_membership_clinic` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_clinic_membership_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

INSERT INTO `clinic_membership` (`user_id`,`clinic_id`,`role`,`status`,`is_primary`)
SELECT `id`, `clinic_id`, `role`, 'active', 1 FROM `user` WHERE `deleted_at` IS NULL;
DROP TABLE IF EXISTS `user_location`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_location` (
  `user_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `location_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`,`location_id`),
  KEY `fk_ul_location` (`location_id`),
  CONSTRAINT `fk_ul_location` FOREIGN KEY (`location_id`) REFERENCES `clinic_location` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ul_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `user_location` WRITE;
/*!40000 ALTER TABLE `user_location` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_location` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `user_preference`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_preference` (
  `user_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `theme` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT 'system',
  `language` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT 'en',
  `notifications_enabled` tinyint(1) DEFAULT '1',
  `email_notifications` tinyint(1) DEFAULT '1',
  `sms_notifications` tinyint(1) DEFAULT '0',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`),
  CONSTRAINT `user_preference_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `user_preference` WRITE;
/*!40000 ALTER TABLE `user_preference` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_preference` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `webhook_endpoint`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `webhook_endpoint` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `url` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `events` json NOT NULL,
  `secret_hash` char(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_webhook_endpoint_clinic` (`clinic_id`),
  KEY `idx_webhook_endpoint_active` (`is_active`),
  KEY `idx_webhook_endpoint_deleted` (`deleted_at`),
  KEY `fk_webhook_endpoint_created_by` (`created_by`),
  CONSTRAINT `fk_webhook_endpoint_clinic` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_webhook_endpoint_created_by` FOREIGN KEY (`created_by`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `webhook_endpoint` WRITE;
/*!40000 ALTER TABLE `webhook_endpoint` DISABLE KEYS */;
/*!40000 ALTER TABLE `webhook_endpoint` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS ` call `;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE ` call ` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinic_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `contact_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `twilio_call_sid` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `twilio_account_sid` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `twilio_parent_call_sid` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `from_number` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `to_number` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tracking_number` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `source` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `direction` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `call_status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `outcome` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `outcome_updated_by` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `outcome_updated_at` datetime DEFAULT NULL,
  `disposition` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `answered_by` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `missed_call` tinyint(1) NOT NULL DEFAULT '0',
  `missed_recovery_status` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `missed_recovery_at` datetime DEFAULT NULL,
  `started_at` datetime DEFAULT NULL,
  `ended_at` datetime DEFAULT NULL,
  `duration` int DEFAULT NULL,
  `recording_url` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `recording_sid` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `recording_status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `recording_duration` int DEFAULT NULL,
  `recording_source` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `transcript` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `ai_summary` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `sentiment` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `booking_intent` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `treatment_mentioned` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `quality_score` int DEFAULT NULL,
  `summary_generated_at` datetime DEFAULT NULL,
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `webhook_payload` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_call_twilio_call_sid` (`twilio_call_sid`),
  KEY `idx_clinic_id` (`clinic_id`),
  KEY `idx_contact_id` (`contact_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_call_outcome` (`clinic_id`,`outcome`),
  KEY `idx_call_disposition` (`clinic_id`,`disposition`),
  KEY `idx_call_recovery` (`clinic_id`,`missed_recovery_status`),
  KEY `idx_call_outcome_updated_by` (`outcome_updated_by`),
  KEY `idx_call_tracking_number` (`clinic_id`,`tracking_number`),
  KEY `idx_call_missed` (`clinic_id`,`missed_call`,`created_at`),
  KEY `idx_call_recording_sid` (`recording_sid`),
  KEY `idx_call_intelligence` (`clinic_id`,`sentiment`,`booking_intent`),
  KEY `idx_deleted_at` (`deleted_at`),
  CONSTRAINT `fk_call_outcome_updated_by` FOREIGN KEY (`outcome_updated_by`) REFERENCES `user` (`id`) ON DELETE SET NULL,
  CONSTRAINT ` call _ibfk_1` FOREIGN KEY (`clinic_id`) REFERENCES `clinic` (`id`) ON DELETE RESTRICT,
  CONSTRAINT ` call _ibfk_2` FOREIGN KEY (`contact_id`) REFERENCES `contact` (`id`) ON DELETE CASCADE,
  CONSTRAINT ` call _ibfk_3` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES ` call ` WRITE;
/*!40000 ALTER TABLE ` call ` DISABLE KEYS */;
INSERT INTO ` call ` VALUES ('call-001','clinic-001','contact-001','user-002',NULL,NULL,NULL,NULL,NULL,NULL,'Call log','inbound',NULL,'existing_patient',NULL,NULL,'booked',NULL,0,NULL,NULL,NULL,NULL,300,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Patient called to confirm appointment',NULL,'2026-04-24 13:22:59','2026-06-01 22:07:36',NULL),('call-002','clinic-001','contact-002','user-002',NULL,NULL,NULL,NULL,NULL,NULL,'Call log','outbound',NULL,'existing_patient',NULL,NULL,'none',NULL,0,NULL,NULL,NULL,NULL,600,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Follow-up call regarding treatment progress',NULL,'2026-04-24 13:22:59','2026-06-01 22:07:36',NULL),('call-003','clinic-001','contact-003','user-002',NULL,NULL,NULL,NULL,NULL,NULL,'Call log','inbound',NULL,'existing_patient',NULL,NULL,'none',NULL,0,NULL,NULL,NULL,NULL,450,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Patient called with questions about exercises',NULL,'2026-04-24 13:22:59','2026-06-01 22:07:36',NULL),('call-004','clinic-001','contact-004','user-002',NULL,NULL,NULL,NULL,NULL,NULL,'Call log','outbound',NULL,'existing_patient',NULL,NULL,'none',NULL,0,NULL,NULL,NULL,NULL,180,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'No-show follow-up call',NULL,'2026-04-24 13:22:59','2026-06-01 22:07:36',NULL),('call-005','clinic-002','contact-005','user-005',NULL,NULL,NULL,NULL,NULL,NULL,'Call log','inbound',NULL,'existing_patient',NULL,NULL,'none',NULL,0,NULL,NULL,NULL,NULL,420,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Patient inquiry about treatment options',NULL,'2026-04-24 13:22:59','2026-06-01 22:07:36',NULL),('call-006','clinic-002','contact-006','user-005',NULL,NULL,NULL,NULL,NULL,NULL,'Call log','outbound',NULL,'existing_patient',NULL,NULL,'none',NULL,0,NULL,NULL,NULL,NULL,540,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Treatment plan discussion',NULL,'2026-04-24 13:22:59','2026-06-01 22:07:36',NULL),('call-007','clinic-003','contact-007','user-007',NULL,NULL,NULL,NULL,NULL,NULL,'Call log','inbound',NULL,'existing_patient',NULL,NULL,'booked',NULL,0,NULL,NULL,NULL,NULL,360,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Patient called regarding appointment time',NULL,'2026-04-24 13:22:59','2026-06-01 22:07:36',NULL),('call-008','clinic-003','contact-008','user-007',NULL,NULL,NULL,NULL,NULL,NULL,'Call log','outbound',NULL,'existing_patient',NULL,NULL,'none',NULL,0,NULL,NULL,NULL,NULL,480,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Pain management check-in',NULL,'2026-04-24 13:22:59','2026-06-01 22:07:36',NULL),('call-009','clinic-004','contact-009','user-008',NULL,NULL,NULL,NULL,NULL,NULL,'Call log','inbound',NULL,'existing_patient',NULL,NULL,'none',NULL,0,NULL,NULL,NULL,NULL,240,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'New patient inquiry',NULL,'2026-04-24 13:22:59','2026-06-01 22:07:36',NULL),('call-010','clinic-004','contact-010','user-009',NULL,NULL,NULL,NULL,NULL,NULL,'Call log','outbound',NULL,'existing_patient',NULL,NULL,'none',NULL,0,NULL,NULL,NULL,NULL,600,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Therapy progress discussion',NULL,'2026-04-24 13:22:59','2026-06-01 22:07:36',NULL);
/*!40000 ALTER TABLE ` call ` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

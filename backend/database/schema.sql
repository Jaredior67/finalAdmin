-- ============================================================
-- FixIt PDAS - Database Schema
-- Facility/Maintenance Job Request Management System
-- ISAT U Dumangas
--
-- HOW TO IMPORT (XAMPP / phpMyAdmin):
--   1. Start Apache + MySQL in the XAMPP Control Panel.
--   2. Open http://localhost/phpmyadmin
--   3. Click "Import" (or "SQL" tab), choose this file, click "Go".
--      This file creates the database itself, so you do NOT need
--      to create "fixit_pdas" manually first.
-- ============================================================

CREATE DATABASE IF NOT EXISTS `fixit_pdas`
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE `fixit_pdas`;

-- ------------------------------------------------------------
-- users
-- All active system accounts (already approved).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
  `id`             INT AUTO_INCREMENT PRIMARY KEY,
  `first_name`     VARCHAR(100) NOT NULL,
  `middle_name`    VARCHAR(100) DEFAULT NULL,
  `last_name`      VARCHAR(100) NOT NULL,
  `email`          VARCHAR(150) NOT NULL UNIQUE,
  `password_hash`  VARCHAR(255) NOT NULL,
  `role`           ENUM('admin','faculty','staff','maintenance') NOT NULL,
  `department`     VARCHAR(150) DEFAULT NULL,
  `contact_number` VARCHAR(30)  DEFAULT NULL,
  `gender`         VARCHAR(30)  DEFAULT NULL,
  `address`        TEXT         DEFAULT NULL,
  `birthday`       DATE         DEFAULT NULL,
  `age`            INT          DEFAULT NULL,
  `id_photo_url`   VARCHAR(500) DEFAULT NULL,
  `status`         ENUM('active','inactive') NOT NULL DEFAULT 'active',
  `created_at`     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- registration_requests
-- Self-service sign-ups awaiting admin approval/rejection.
-- Approving a row here creates the matching row in `users`.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `registration_requests` (
  `id`               INT AUTO_INCREMENT PRIMARY KEY,
  `first_name`       VARCHAR(100) NOT NULL,
  `middle_name`      VARCHAR(100) DEFAULT NULL,
  `last_name`        VARCHAR(100) NOT NULL,
  `email`            VARCHAR(150) NOT NULL UNIQUE,
  `password_hash`    VARCHAR(255) NOT NULL,
  `role`             ENUM('faculty','staff') NOT NULL,
  `department`       VARCHAR(150) DEFAULT NULL,
  `contact_number`   VARCHAR(30)  DEFAULT NULL,
  `gender`           VARCHAR(30)  DEFAULT NULL,
  `address`          TEXT         DEFAULT NULL,
  `birthday`         DATE         DEFAULT NULL,
  `age`              INT          DEFAULT NULL,
  `id_photo_url`     VARCHAR(500) DEFAULT NULL,
  `status`           ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `rejection_reason` VARCHAR(255) DEFAULT NULL,
  `reviewed_by`      INT DEFAULT NULL,
  `reviewed_at`      TIMESTAMP NULL DEFAULT NULL,
  `created_at`       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_regreq_reviewer` FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- campus_locations
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `campus_locations` (
  `id`          INT AUTO_INCREMENT PRIMARY KEY,
  `building`    VARCHAR(150) NOT NULL,
  `floor`       VARCHAR(50)  DEFAULT NULL,
  `room`        VARCHAR(100) DEFAULT NULL,
  `description` VARCHAR(255) DEFAULT NULL,
  `created_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- job_requests  (a.k.a. "requisitions")
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `job_requests` (
  `id`                            INT AUTO_INCREMENT PRIMARY KEY,
  `ticket_no`                     VARCHAR(30) NOT NULL UNIQUE,
  `requester_id`                  INT NOT NULL,
  `location_id`                   INT DEFAULT NULL,
  `category`                      ENUM('electrical','plumbing','carpentry','ict','janitorial','other') NOT NULL DEFAULT 'other',
  `description`                   TEXT NOT NULL,
  `urgency_level`                 ENUM('Low Risk','Medium Risk','High Risk') NOT NULL DEFAULT 'Medium Risk',
  `request_type`                  ENUM('Standard Request','Urgent Request') NOT NULL DEFAULT 'Standard Request',
  `is_standard_form_filled`       BOOLEAN NOT NULL DEFAULT TRUE,
  `immediate_supervisor`          VARCHAR(150) DEFAULT NULL,
  `status`                        ENUM('Pending','Under Review','Awaiting Signatures','Approved','Ongoing','Completed','Rejected') NOT NULL DEFAULT 'Pending',
  `assigned_to`                   INT DEFAULT NULL,
  `approved_by`                   INT DEFAULT NULL,
  `scheduled_date`                DATE DEFAULT NULL,
  `completed_at`                  DATETIME DEFAULT NULL,
  `is_archived`                   BOOLEAN NOT NULL DEFAULT FALSE,
  `archived_at`                   DATETIME DEFAULT NULL,
  `is_replacement_flagged`        BOOLEAN NOT NULL DEFAULT FALSE,
  `replacement_reason`            TEXT DEFAULT NULL,
  `replacement_item_specs`        TEXT DEFAULT NULL,
  `replacement_procurement_status` VARCHAR(100) DEFAULT NULL,
  `created_at`                    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`                    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_jr_requester` FOREIGN KEY (`requester_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_jr_location`  FOREIGN KEY (`location_id`)  REFERENCES `campus_locations`(`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_jr_assignee`  FOREIGN KEY (`assigned_to`)  REFERENCES `users`(`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_jr_approver`  FOREIGN KEY (`approved_by`)  REFERENCES `users`(`id`) ON DELETE SET NULL,
  INDEX `idx_jr_status` (`status`),
  INDEX `idx_jr_requester` (`requester_id`),
  INDEX `idx_jr_assignee` (`assigned_to`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- job_request_status_history
-- Audit trail of status transitions, useful for defense Q&A.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `job_request_status_history` (
  `id`             INT AUTO_INCREMENT PRIMARY KEY,
  `job_request_id` INT NOT NULL,
  `from_status`    VARCHAR(50) DEFAULT NULL,
  `to_status`      VARCHAR(50) NOT NULL,
  `changed_by`     INT DEFAULT NULL,
  `remarks`        VARCHAR(255) DEFAULT NULL,
  `created_at`     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_hist_job`  FOREIGN KEY (`job_request_id`) REFERENCES `job_requests`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_hist_user` FOREIGN KEY (`changed_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- evaluations (ISO/IEC 25010 Quality Characteristics)
-- Post-completion feedback on a job request.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `evaluations` (
  `id`                     INT AUTO_INCREMENT PRIMARY KEY,
  `job_request_id`         INT NOT NULL,
  `evaluated_by`           INT NOT NULL,
  `functional_suitability` TINYINT NOT NULL,
  `usability`              TINYINT NOT NULL,
  `reliability`            TINYINT NOT NULL,
  `performance_efficiency` TINYINT NOT NULL,
  `comments`               TEXT DEFAULT NULL,
  `created_at`             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_eval_job`  FOREIGN KEY (`job_request_id`) REFERENCES `job_requests`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_eval_user` FOREIGN KEY (`evaluated_by`)   REFERENCES `users`(`id`) ON DELETE CASCADE,
  CONSTRAINT `chk_eval_fs`  CHECK (`functional_suitability` BETWEEN 1 AND 5),
  CONSTRAINT `chk_eval_us`  CHECK (`usability` BETWEEN 1 AND 5),
  CONSTRAINT `chk_eval_rel` CHECK (`reliability` BETWEEN 1 AND 5),
  CONSTRAINT `chk_eval_pe`  CHECK (`performance_efficiency` BETWEEN 1 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- preventive_maintenance_schedules
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `preventive_maintenance_schedules` (
  `id`             INT AUTO_INCREMENT PRIMARY KEY,
  `title`          VARCHAR(255) NOT NULL,
  `category`       VARCHAR(100) NOT NULL,
  `scheduled_date` DATE NOT NULL,
  `time_window`    VARCHAR(100) DEFAULT '08:00 AM - 12:00 PM',
  `location`       VARCHAR(255) NOT NULL,
  `assigned_to`    INT DEFAULT NULL,
  `in_charge_name` VARCHAR(150) DEFAULT NULL,
  `status`         ENUM('Scheduled','In Progress','Completed','Cancelled') NOT NULL DEFAULT 'Scheduled',
  `created_at`     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_pms_assigned` FOREIGN KEY (`assigned_to`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- messages / message_replies
-- Simple internal messaging between users.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `messages` (
  `id`           INT AUTO_INCREMENT PRIMARY KEY,
  `sender_id`    INT NOT NULL,
  `recipient_id` INT DEFAULT NULL,
  `subject`      VARCHAR(255) NOT NULL,
  `body`         TEXT NOT NULL,
  `is_read`      BOOLEAN NOT NULL DEFAULT FALSE,
  `created_at`   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_msg_sender`    FOREIGN KEY (`sender_id`)    REFERENCES `users`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_msg_recipient` FOREIGN KEY (`recipient_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `message_replies` (
  `id`         INT AUTO_INCREMENT PRIMARY KEY,
  `message_id` INT NOT NULL,
  `sender_id`  INT NOT NULL,
  `body`       TEXT NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_reply_message` FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_reply_sender`  FOREIGN KEY (`sender_id`)  REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- documents
-- Files attached to a job request (photos, reports, etc.)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `documents` (
  `id`             INT AUTO_INCREMENT PRIMARY KEY,
  `job_request_id` INT DEFAULT NULL,
  `uploaded_by`    INT NOT NULL,
  `file_name`      VARCHAR(255) NOT NULL,
  `file_path`      VARCHAR(500) NOT NULL,
  `file_type`      VARCHAR(100) DEFAULT NULL,
  `created_at`     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_doc_job`  FOREIGN KEY (`job_request_id`) REFERENCES `job_requests`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_doc_user` FOREIGN KEY (`uploaded_by`)    REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- notifications
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `notifications` (
  `id`         INT AUTO_INCREMENT PRIMARY KEY,
  `user_id`    INT NOT NULL,
  `title`      VARCHAR(255) NOT NULL,
  `message`    TEXT NOT NULL,
  `link`       VARCHAR(255) DEFAULT NULL,
  `is_read`    BOOLEAN NOT NULL DEFAULT FALSE,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_notif_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  INDEX `idx_notif_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

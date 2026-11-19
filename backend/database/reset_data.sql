-- ============================================================
-- FixIt PDAS — Full Transactional Data Reset
-- ============================================================
-- PURPOSE: Clear ALL requests, notifications, messages,
--          archived tickets, audit logs, and recent activity
--          for every role, so the system starts fresh.
--
-- PRESERVED (NOT TOUCHED):
--   • users                         — all accounts survive
--   • registration_requests         — pending signups survive
--   • campus_locations              — QR location tags survive
--
-- RESET TO ZERO:
--   • ticket_sequences              — next ticket will be 0001
--   • tracking_sequences            — next tracking no = 0001
--
-- HOW TO RUN (phpMyAdmin):
--   1. Open http://localhost/phpmyadmin
--   2. Select the "fixit_pdas" database
--   3. Click "SQL" tab, paste this file, click "Go"
-- ============================================================

USE `fixit_pdas`;

-- Disable FK checks so we can truncate in any order
SET FOREIGN_KEY_CHECKS = 0;

-- ── Transactional tables ────────────────────────────────────

-- Audit trail
TRUNCATE TABLE `audit_log`;

-- Approval/status history
TRUNCATE TABLE `job_request_status_history`;

-- Post-completion evaluations/ratings
TRUNCATE TABLE `evaluations`;

-- Attached documents (photos, reports)
TRUNCATE TABLE `documents`;

-- Internal messages & replies
TRUNCATE TABLE `message_replies`;
TRUNCATE TABLE `messages`;

-- All notifications for every role
TRUNCATE TABLE `notifications`;

-- Preventive maintenance schedules (calendar events)
TRUNCATE TABLE `preventive_maintenance_schedules`;

-- All job requests (active + archived)
TRUNCATE TABLE `job_requests`;

-- Reset ticket number counters -> next ticket will be 0001
TRUNCATE TABLE `ticket_sequences`;
TRUNCATE TABLE `tracking_sequences`;

-- Re-enable FK checks
SET FOREIGN_KEY_CHECKS = 1;

-- Confirmation: all should be 0 except users_preserved and locations_preserved
SELECT
  (SELECT COUNT(*) FROM `job_requests`)                     AS job_requests,
  (SELECT COUNT(*) FROM `notifications`)                    AS notifications,
  (SELECT COUNT(*) FROM `messages`)                         AS messages,
  (SELECT COUNT(*) FROM `message_replies`)                  AS message_replies,
  (SELECT COUNT(*) FROM `audit_log`)                        AS audit_log,
  (SELECT COUNT(*) FROM `job_request_status_history`)       AS status_history,
  (SELECT COUNT(*) FROM `evaluations`)                      AS evaluations,
  (SELECT COUNT(*) FROM `preventive_maintenance_schedules`) AS pm_schedules,
  (SELECT COUNT(*) FROM `ticket_sequences`)                 AS ticket_seq,
  (SELECT COUNT(*) FROM `tracking_sequences`)               AS tracking_seq,
  (SELECT COUNT(*) FROM `users`)                            AS users_preserved,
  (SELECT COUNT(*) FROM `campus_locations`)                 AS locations_preserved;

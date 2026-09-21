-- ============================================================
-- FixIt PDAS - Seed Data
-- Run AFTER schema.sql. Safe to import via phpMyAdmin's Import tab.
--
-- NOTE: The default admin account is NOT created here, because
-- passwords must be bcrypt-hashed (SQL can't do that safely).
-- After setting up the backend, run:
--     cd backend
--     npm install
--     npm run seed:admin
-- This creates an admin login using ADMIN_EMAIL / ADMIN_PASSWORD
-- from your .env file. See backend/.env.example.
-- ============================================================

USE `fixit_pdas`;

INSERT INTO `campus_locations` (`building`, `floor`, `room`, `description`) VALUES
('Main Building',        'Ground Floor', 'Room 101', 'Registrar Office'),
('Main Building',        'Ground Floor', 'Room 102', 'Admissions Office'),
('Main Building',        '2nd Floor',    'Room 201', 'Faculty Room A'),
('Main Building',        '2nd Floor',    'Room 202', 'Faculty Room B'),
('Engineering Building',  'Ground Floor', 'Lab 1',    'Electronics Laboratory'),
('Engineering Building',  '2nd Floor',    'Lab 2',    'Computer Laboratory'),
('Library Building',      'Ground Floor', NULL,       'Main Library'),
('Gymnasium',             'Ground Floor', NULL,       'Sports & Events Hall'),
('Administration Building','Ground Floor', 'PDAS Office', 'Physical Development and Auxiliary Services Office');

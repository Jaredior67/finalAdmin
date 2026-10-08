import React, { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { useToast } from '../components/ui/Toast';
import {
  apiRegister,
  apiGetUsers,
  apiGetMessageParticipants,
  apiGetPendingRegistrations,
  apiGetRejectedRegistrations,
  apiApproveRegistration,
  apiRejectRegistration,
  apiCreateUser,
  apiUpdateUser,
  apiSetUserStatus,
  apiRemoveUser,
  apiCreatePreventiveSchedule,
  apiDeletePreventiveSchedule,
  apiGetNotifications,
  apiMarkNotificationRead,
  apiMarkAllNotificationsRead,
  apiDeleteNotification,
  apiClearAllNotifications,
  apiGetCampusLocations,
  apiAddCampusLocation,
  apiUpdateCampusLocation,
  apiDeleteCampusLocation,
} from '../backend/api';
import { submitOrQueue } from '../utils/outbox';

const DataContext = createContext();

/* A campus location with a purely numeric id came from `campus_locations` in
   the database; the seeded campus list and anything registered offline use
   string ids such as "loc-adm-15". Only the string rows belong in the
   localStorage cache — otherwise a row the admin deleted would be re-created
   from a stale copy on the next reload. */
export const isServerBackedLocation = (loc) => /^\d+$/.test(String(loc?.id ?? ''));

export const isNotificationForUser = (n, user, roleFlags = {}) => {
  if (!n || !user) return false;

  const { isAdmin, isMaintenance, isFacultyOrStaff } = roleFlags;

  // 1. Direct recipient match by user ID
  if (n.recipientUserId && n.recipientUserId === user.id) {
    return true;
  }

  // Admins should be able to monitor the full system, not just their own
  // role-specific queue, while still respecting direct user notifications.
  if (isAdmin && !n.recipientUserId) {
    return true;
  }

  // 2. Explicit targetRole or targetRoles matching
  const targetRoles = Array.isArray(n.targetRoles)
    ? n.targetRoles
    : n.targetRole
      ? [n.targetRole]
      : [];

  const normalizedTargetRoles = targetRoles.map(role => String(role || '').toLowerCase());

  if (targetRoles.length > 0) {
    if (normalizedTargetRoles.includes('all')) return true;
    if (isAdmin && normalizedTargetRoles.some(role => ['admin', 'faculty', 'staff', 'faculty_staff', 'maintenance', 'technician'].includes(role))) return true;
    if (isFacultyOrStaff && normalizedTargetRoles.some(role => ['faculty_staff', 'faculty', 'staff', 'faculty/staff'].includes(role))) return true;
    if (isMaintenance && normalizedTargetRoles.some(role => ['maintenance', 'technician'].includes(role))) return true;
    return false;
  }

  // 3. Fallback matching for legacy or untagged notifications based on title heuristics
  const title = String(n.title || '');
  if (isAdmin) {
    return (
      title.includes('New Account Registration') ||
      title.includes('Requisition') ||
      title.includes('Request') ||
      title.includes('URGENT Facility Ticket') ||
      title.includes('Form Filed') ||
      title.includes('Maintenance Flag') ||
      title.includes('Irreparable Item') ||
      title.includes('Evaluation Submitted') ||
      title.includes('Archived') ||
      title.includes('User Account Removed') ||
      title.includes('Password Change') ||
      title.includes('Registered')
    );
  }

  if (isFacultyOrStaff) {
    return (
      title.includes('Account Verified') ||
      title.includes('Registration Rejected') ||
      title.includes('Urgent Filing') ||
      title.includes('Under Review') ||
      title.includes('Awaiting Signatures') ||
      title.includes('Approved') ||
      title.includes('Disapproved') ||
      title.includes('Ticket Status') ||
      title.includes('Service Evaluation') ||
      title.includes('Signatures Confirmed') ||
      title.includes('Replacement Status') ||
      title.includes('Scheduled')
    );
  }

  if (isMaintenance) {
    return (
      title.includes('Maintenance Account Created') ||
      title.includes('Assigned') ||
      title.includes('Dispatched') ||
      title.includes('Ticket Status') ||
      title.includes('Signatures Confirmed') ||
      title.includes('Action Taken') ||
      title.includes('Replacement Status') ||
      title.includes('Scheduled')
    );
  }

  return false;
};

export const INITIAL_SAMPLE_NOTIFICATIONS = [
  {
    id: 'notif-init-01',
    title: 'New Account Registration',
    text: 'Dr. Elena Ramos (Faculty - BSIT Department) submitted ID for verification',
    time: '15m ago',
    unread: true,
    targetRole: 'admin'
  },
  {
    id: 'notif-init-02',
    title: 'Urgent request, standard form pending',
    text: 'REQ-2026-002 (Precision AC Unit Thermal Alert) filed by Dr. Elena Ramos',
    time: '1h ago',
    unread: true,
    targetRole: 'admin'
  },
  {
    id: 'notif-init-03',
    title: 'Account Verified by Admin',
    text: 'Dr. Elena Ramos (Faculty) account verified and approved. Access granted.',
    time: '1d ago',
    unread: false,
    targetRole: 'faculty_staff'
  },
  {
    id: 'notif-init-04',
    title: 'Request Accepted — Awaiting Signatures',
    text: 'REQ-2026-001 accepted. Print QF-PDAS-DC-01 and collect wet-ink signatures.',
    time: '30m ago',
    unread: true,
    targetRole: 'faculty_staff'
  },
  {
    id: 'notif-init-05',
    title: 'Task Assigned to Technician',
    text: 'REQ-2026-001 (Ceiling Fan & Outlet Sparks Repair) dispatched to Mark Villanueva',
    time: '20m ago',
    unread: true,
    targetRoles: ['maintenance', 'faculty_staff']
  },
  {
    id: 'notif-init-06',
    title: 'Maintenance Flag: Follow-up Scheduled',
    text: 'REQ-2026-003 was flagged by Mark Villanueva. Proposed follow-up on site tomorrow.',
    time: '45m ago',
    unread: true,
    targetRole: 'admin'
  }
];

export const INITIAL_OFFICES = [
  'Office of the Campus Administrator',
  'Office of Instruction',
  'Extension Services Office',
  'Research Services Office',
  'Office of the Bids and Awards Committee (BAC)',
  'Office of the Legal Affairs Coordinator',
  'Human Resource Management Office (HRMO)',
  'Records Section',
  "Cashier's Office",
  'Office of the Registrar and Admission',
  'Finance Management Services Office/Budget Office',
  'Accounting Office',
  'Planning Development and Auxiliary Services Office',
  "Librarian's Office",
  'Supply and Property Management Office',
  'Sports Coordinator Office',
  'Cultural Coordinator Office',
  'External Affairs / National and International Affairs Office',
  'Office of Alumni Affairs and Relations',
  'Office of Gender and Development (GAD)',
  'Office of the Management Information System (MIS)',
  'Public Information and Communications Office (PICO)/Publication Office',
  'Office of the BSIT Coordinator',
  'Office of the BSHM Coordinator',
  'Office of the BIT Coordinator',
  'Office of the BTVTED Coordinator',
  'Office of the BSE Coordinator',
  'Quality Assurance Office',
  'Medical/Dental Clinic',
  'Office of Guidance and Counseling Center',
  'Office of the Integrated Income and Resource Generation Program',
  'Office of the National Service Training Program (NSTP) Coordinator',
  'Safety, Security, Environment and Disaster Risk Reduction Management Office',
  "Office of the Parents' Affairs and Relations",
  'Industry Linkages and Development Office',
  'Office of Student Affairs and Services (OSAS)',
  'Office of the Scholarship Coordinator',
  'Office of the Student Republic'
];

export const INITIAL_DEPARTMENTS = [
  'BSIT',
  'BSHM',
  'BIT',
  'BTVTED',
  'BSE'
];

// QF-PDAS-DC-01 Tracking Number sequence (QF-PDAS-DC-01).
// Tracking numbers are issued when the work order is assigned, after final approval.
// Admin can edit prefix / start / end / next below (see Settings → Tracking Numbers).
export const DEFAULT_TRACKING_CONFIG = {
  prefix: 'REQ-2026-',
  next: 5,
  start: 1,
  end: 9999,
  pad: 3,
};

export const formatTrackingNumber = (cfg, num) => {
  const pad = Math.max(1, Math.min(6, Number(cfg?.pad) || 3));
  return `${cfg?.prefix ?? 'REQ-2026-'}${String(num).padStart(pad, '0')}`;
};

export const INITIAL_CAMPUS_LOCATIONS = [
  // 1. Administration Building
  { id: 'loc-adm-01', building: 'Administration Building', bldgShort: 'Admin', floor: '2nd Floor', room: 'Office of the Campus Administrator', qrCodeRef: 'ISATU-ADM-ADMIN-OFFICE' },
  { id: 'loc-adm-02', building: 'Administration Building', bldgShort: 'Admin', floor: '2nd Floor', room: 'Office of Instruction', qrCodeRef: 'ISATU-ADM-INSTRUCTION' },
  { id: 'loc-adm-03', building: 'Administration Building', bldgShort: 'Admin', floor: '2nd Floor', room: 'Office of the Bids and Awards Committee (BAC)', qrCodeRef: 'ISATU-ADM-BAC' },
  { id: 'loc-adm-04', building: 'Administration Building', bldgShort: 'Admin', floor: '2nd Floor', room: 'Office of the Legal Affairs Coordinator', qrCodeRef: 'ISATU-ADM-LEGAL' },
  { id: 'loc-adm-05', building: 'Administration Building', bldgShort: 'Admin', floor: '2nd Floor', room: 'Extension Services Office', qrCodeRef: 'ISATU-ADM-EXTENSION' },
  { id: 'loc-adm-06', building: 'Administration Building', bldgShort: 'Admin', floor: '2nd Floor', room: 'Research Services Office', qrCodeRef: 'ISATU-ADM-RESEARCH' },
  { id: 'loc-adm-07', building: 'Administration Building', bldgShort: 'Admin', floor: '2nd Floor', room: 'Quality Assurance Office', qrCodeRef: 'ISATU-ADM-QA' },
  { id: 'loc-adm-08', building: 'Administration Building', bldgShort: 'Admin', floor: '2nd Floor', room: 'External Affairs / National and International Affairs Office', qrCodeRef: 'ISATU-ADM-EXT-AFFAIRS' },
  { id: 'loc-adm-09', building: 'Administration Building', bldgShort: 'Admin', floor: '2nd Floor', room: 'Office of Alumni Affairs and Relations', qrCodeRef: 'ISATU-ADM-ALUMNI' },
  { id: 'loc-adm-10', building: 'Administration Building', bldgShort: 'Admin', floor: '2nd Floor', room: 'Office of Gender and Development (GAD)', qrCodeRef: 'ISATU-ADM-GAD' },
  { id: 'loc-adm-11', building: 'Administration Building', bldgShort: 'Admin', floor: '2nd Floor', room: 'Public Information and Communications Office (PICO)/Publication Office', qrCodeRef: 'ISATU-ADM-PICO' },
  { id: 'loc-adm-12', building: 'Administration Building', bldgShort: 'Admin', floor: '2nd Floor', room: "Office of the Parents' Affairs and Relations", qrCodeRef: 'ISATU-ADM-PARENTS' },
  { id: 'loc-adm-13', building: 'Administration Building', bldgShort: 'Admin', floor: '2nd Floor', room: 'Industry Linkages and Development Office', qrCodeRef: 'ISATU-ADM-LINKAGES' },
  { id: 'loc-adm-14', building: 'Administration Building', bldgShort: 'Admin', floor: '2nd Floor', room: 'Executive Conference Room', qrCodeRef: 'ISATU-ADM-CONF' },
  { id: 'loc-adm-15', building: 'Administration Building', bldgShort: 'Admin', floor: 'Ground Floor', room: 'Planning Development and Auxiliary Services Office', qrCodeRef: 'ISATU-ADM-PDAS' },
  { id: 'loc-adm-16', building: 'Administration Building', bldgShort: 'Admin', floor: 'Ground Floor', room: 'Human Resource Management Office (HRMO)', qrCodeRef: 'ISATU-ADM-HRMO' },
  { id: 'loc-adm-17', building: 'Administration Building', bldgShort: 'Admin', floor: 'Ground Floor', room: 'Records Section', qrCodeRef: 'ISATU-ADM-RECORDS' },
  { id: 'loc-adm-18', building: 'Administration Building', bldgShort: 'Admin', floor: 'Ground Floor', room: "Cashier's Office", qrCodeRef: 'ISATU-ADM-CASHIER' },
  { id: 'loc-adm-19', building: 'Administration Building', bldgShort: 'Admin', floor: 'Ground Floor', room: 'Office of the Registrar and Admission', qrCodeRef: 'ISATU-ADM-REGISTRAR' },
  { id: 'loc-adm-20', building: 'Administration Building', bldgShort: 'Admin', floor: 'Ground Floor', room: 'Finance Management Services Office/Budget Office', qrCodeRef: 'ISATU-ADM-BUDGET' },
  { id: 'loc-adm-21', building: 'Administration Building', bldgShort: 'Admin', floor: 'Ground Floor', room: 'Accounting Office', qrCodeRef: 'ISATU-ADM-ACCOUNTING' },
  { id: 'loc-adm-22', building: 'Administration Building', bldgShort: 'Admin', floor: 'Ground Floor', room: 'Supply and Property Management Office', qrCodeRef: 'ISATU-ADM-SUPPLY' },

  // 2. Technology Building
  { id: 'loc-tech-01', building: 'Technology Building', bldgShort: 'Tech', floor: 'Ground Floor', room: 'Office of the Management Information System (MIS)', qrCodeRef: 'ISATU-TECH-MIS' },
  { id: 'loc-tech-02', building: 'Technology Building', bldgShort: 'Tech', floor: 'Ground Floor', room: 'Office of the BSIT Coordinator', qrCodeRef: 'ISATU-TECH-BSIT' },
  { id: 'loc-tech-03', building: 'Technology Building', bldgShort: 'Tech', floor: 'Ground Floor', room: 'Office of the BIT Coordinator', qrCodeRef: 'ISATU-TECH-BIT' },
  { id: 'loc-tech-04', building: 'Technology Building', bldgShort: 'Tech', floor: 'Ground Floor', room: 'Office of the BTVTED Coordinator', qrCodeRef: 'ISATU-TECH-BTVTED' },
  { id: 'loc-tech-05', building: 'Technology Building', bldgShort: 'Tech', floor: 'Ground Floor', room: 'Computer Laboratory 1', qrCodeRef: 'ISATU-TECH-COMPLAB-1' },
  { id: 'loc-tech-06', building: 'Technology Building', bldgShort: 'Tech', floor: 'Ground Floor', room: 'Electronics & Circuits Workshop', qrCodeRef: 'ISATU-TECH-WORKSHOP' },
  { id: 'loc-tech-07', building: 'Technology Building', bldgShort: 'Tech', floor: '2nd Floor', room: 'Computer Laboratory 2', qrCodeRef: 'ISATU-TECH-COMPLAB-2' },
  { id: 'loc-tech-08', building: 'Technology Building', bldgShort: 'Tech', floor: '2nd Floor', room: 'IT Cisco & Networking Lab', qrCodeRef: 'ISATU-TECH-CISCO' },
  { id: 'loc-tech-09', building: 'Technology Building', bldgShort: 'Tech', floor: '2nd Floor', room: 'Room 201 Lecture Hall', qrCodeRef: 'ISATU-TECH-201' },
  { id: 'loc-tech-10', building: 'Technology Building', bldgShort: 'Tech', floor: '3rd Floor', room: 'Drafting & CAD Technology Room', qrCodeRef: 'ISATU-TECH-DRAFTING' },
  { id: 'loc-tech-11', building: 'Technology Building', bldgShort: 'Tech', floor: '3rd Floor', room: 'Room 301 Lecture Room', qrCodeRef: 'ISATU-TECH-301' },

  // 3. Science Building
  { id: 'loc-sci-01', building: 'Science Building', bldgShort: 'Science', floor: 'Ground Floor', room: 'Office of the BSE Coordinator', qrCodeRef: 'ISATU-SCI-BSE' },
  { id: 'loc-sci-02', building: 'Science Building', bldgShort: 'Science', floor: 'Ground Floor', room: 'Chemistry & Biology Laboratory', qrCodeRef: 'ISATU-SCI-CHEMLAB' },
  { id: 'loc-sci-03', building: 'Science Building', bldgShort: 'Science', floor: 'Ground Floor', room: 'Physics & General Science Laboratory', qrCodeRef: 'ISATU-SCI-PHYSICS' },
  { id: 'loc-sci-04', building: 'Science Building', bldgShort: 'Science', floor: 'Ground Floor', room: 'Room 101 Lecture Room', qrCodeRef: 'ISATU-SCI-101' },
  { id: 'loc-sci-05', building: 'Science Building', bldgShort: 'Science', floor: '2nd Floor', room: 'Room 201 Lecture Room', qrCodeRef: 'ISATU-SCI-201' },
  { id: 'loc-sci-06', building: 'Science Building', bldgShort: 'Science', floor: '2nd Floor', room: 'Faculty Room', qrCodeRef: 'ISATU-SCI-FACULTY' },

  // 4. HRT Rooms
  { id: 'loc-hrt-01', building: 'HRT Rooms', bldgShort: 'HRT', floor: 'Ground Floor', room: 'Office of the BSHM Coordinator', qrCodeRef: 'ISATU-HRT-BSHM' },
  { id: 'loc-hrt-02', building: 'HRT Rooms', bldgShort: 'HRT', floor: 'Ground Floor', room: 'Commercial Kitchen & Food Laboratory', qrCodeRef: 'ISATU-HRT-KITCHEN' },
  { id: 'loc-hrt-03', building: 'HRT Rooms', bldgShort: 'HRT', floor: 'Ground Floor', room: 'Dining & Beverage Management Room', qrCodeRef: 'ISATU-HRT-DINING' },
  { id: 'loc-hrt-04', building: 'HRT Rooms', bldgShort: 'HRT', floor: '2nd Floor', room: 'Mock Hotel & Housekeeping Suite', qrCodeRef: 'ISATU-HRT-HOTEL' },
  { id: 'loc-hrt-05', building: 'HRT Rooms', bldgShort: 'HRT', floor: '2nd Floor', room: 'HRT Lecture Room 201', qrCodeRef: 'ISATU-HRT-201' },

  // 5. Multi-purpose Hall
  { id: 'loc-mph-01', building: 'Multi-purpose Hall', bldgShort: 'MPH', floor: 'Main Hall', room: 'Sports Coordinator Office', qrCodeRef: 'ISATU-MPH-SPORTS' },
  { id: 'loc-mph-02', building: 'Multi-purpose Hall', bldgShort: 'MPH', floor: 'Main Hall', room: 'Cultural Coordinator Office', qrCodeRef: 'ISATU-MPH-CULTURAL' },
  { id: 'loc-mph-03', building: 'Multi-purpose Hall', bldgShort: 'MPH', floor: 'Main Hall', room: 'Main Gymnasium & Auditorium Stage', qrCodeRef: 'ISATU-MPH-MAIN' },
  { id: 'loc-mph-04', building: 'Multi-purpose Hall', bldgShort: 'MPH', floor: 'Main Hall', room: 'Bleachers & Electrical Control Panel', qrCodeRef: 'ISATU-MPH-PANEL' },
  { id: 'loc-mph-05', building: 'Multi-purpose Hall', bldgShort: 'MPH', floor: 'Stage Area', room: 'Audio-Visual & Lighting Control Booth', qrCodeRef: 'ISATU-MPH-AV' },

  // 6. Student Center
  { id: 'loc-sc-01', building: 'Student Center', bldgShort: 'SC', floor: 'Ground Floor', room: 'Office of Student Affairs and Services (OSAS)', qrCodeRef: 'ISATU-SC-OSAS' },
  { id: 'loc-sc-02', building: 'Student Center', bldgShort: 'SC', floor: 'Ground Floor', room: 'Office of the Scholarship Coordinator', qrCodeRef: 'ISATU-SC-SCHOLARSHIP' },
  { id: 'loc-sc-03', building: 'Student Center', bldgShort: 'SC', floor: 'Ground Floor', room: 'Office of the Student Republic', qrCodeRef: 'ISATU-SC-REPUBLIC' },
  { id: 'loc-sc-04', building: 'Student Center', bldgShort: 'SC', floor: 'Ground Floor', room: 'Office of Guidance and Counseling Center', qrCodeRef: 'ISATU-SC-GUIDANCE' },
  { id: 'loc-sc-05', building: 'Student Center', bldgShort: 'SC', floor: 'Ground Floor', room: 'Medical/Dental Clinic', qrCodeRef: 'ISATU-SC-CLINIC' },
  { id: 'loc-sc-06', building: 'Student Center', bldgShort: 'SC', floor: 'Ground Floor', room: 'Safety, Security, Environment and Disaster Risk Reduction Management Office', qrCodeRef: 'ISATU-SC-SAFETY' },
  { id: 'loc-sc-07', building: 'Student Center', bldgShort: 'SC', floor: '2nd Floor', room: 'Office of the Integrated Income and Resource Generation Program', qrCodeRef: 'ISATU-SC-INCOME' },
  { id: 'loc-sc-08', building: 'Student Center', bldgShort: 'SC', floor: '2nd Floor', room: 'Office of the National Service Training Program (NSTP) Coordinator', qrCodeRef: 'ISATU-SC-NSTP' },
  { id: 'loc-sc-09', building: 'Student Center', bldgShort: 'SC', floor: '2nd Floor', room: 'Student Organization & Activities Center', qrCodeRef: 'ISATU-SC-ORGS' },

  // 7. Library
  { id: 'loc-lib-01', building: 'Library', bldgShort: 'Library', floor: '1st Floor', room: "Librarian's Office", qrCodeRef: 'ISATU-LIB-OFFICE' },
  { id: 'loc-lib-02', building: 'Library', bldgShort: 'Library', floor: '1st Floor', room: 'Circulation & Help Desk', qrCodeRef: 'ISATU-LIB-CIRC' },
  { id: 'loc-lib-03', building: 'Library', bldgShort: 'Library', floor: '1st Floor', room: 'General Reference & Reading Hall', qrCodeRef: 'ISATU-LIB-READING' },
  { id: 'loc-lib-04', building: 'Library', bldgShort: 'Library', floor: '2nd Floor', room: 'E-Library & Digital Research Center', qrCodeRef: 'ISATU-LIB-ELIB' },
  { id: 'loc-lib-05', building: 'Library', bldgShort: 'Library', floor: '2nd Floor', room: 'Periodicals & Archive Wing', qrCodeRef: 'ISATU-LIB-ARCHIVE' },

  // 8. Canteen
  { id: 'loc-can-01', building: 'Canteen', bldgShort: 'Canteen', floor: 'Ground Floor', room: 'Main Canteen Dining & Food Stall Area', qrCodeRef: 'ISATU-CAN-MAIN' },
  { id: 'loc-can-02', building: 'Canteen', bldgShort: 'Canteen', floor: 'Ground Floor', room: 'Kitchen & Food Preparation Section', qrCodeRef: 'ISATU-CAN-KITCHEN' },

  // 9. GuardHouse
  { id: 'loc-gh-01', building: 'GuardHouse', bldgShort: 'Guard', floor: 'Ground Floor', room: 'Main Campus Gate Security Post & CCTV Desk', qrCodeRef: 'ISATU-GH-MAIN' }
];






const INITIAL_MESSAGES = [
  {
    id: 'msg_001',
    sender: 'Engr. Carlos Mendoza (MIS)',
    senderAvatar: 'C',
    role: 'Department Head',
    subject: 'Follow-up: Server Room Inverter AC Repair',
    controlNo: 'REQ-2026-002',
    time: '1:34 PM',
    unread: true,
    preview: 'Director, technician Mark has assessed the precision AC. Replacement compressor unit is needed...',
    thread: [
      { sender: 'Engr. Carlos Mendoza', text: 'Good day Director! Request REQ-2026-002 has been filed for the server room cooling unit.', time: '09:15 AM' },
      { sender: 'PDAS Director', text: 'Approved immediately under urgent status. Lead technician Mark is dispatched.', time: '09:32 AM' },
      { sender: 'Engr. Carlos Mendoza', text: 'Director, technician Mark checked the thermal sensor. Replacement compressor unit is needed due to burnt coils. Replacement flag raised.', time: '1:34 PM' }
    ]
  },
  {
    id: 'msg_002',
    sender: 'Dr. Elena Ramos (CEA)',
    senderAvatar: 'E',
    role: 'Dean / Requester',
    subject: 'Room 302 Wiring Safety Concern',
    controlNo: 'REQ-2026-001',
    time: 'Yesterday',
    unread: false,
    preview: 'Thank you for prioritizing this. We have temporarily moved electronics classes to Room 204.',
    thread: [
      { sender: 'Dr. Elena Ramos', text: 'Good day Director. Filed REQ-2026-001 for room 302 outlet sparks.', time: 'Yesterday 10:20 AM' },
      { sender: 'PDAS Director', text: 'Noted Dean Ramos. We are scheduling the electrical team for a complete circuit load analysis today.', time: 'Yesterday 11:05 AM' },
      { sender: 'Dr. Elena Ramos', text: 'Thank you for prioritizing this. We have temporarily moved electronics classes to Room 204.', time: 'Yesterday 11:30 AM' }
    ]
  }
];

/* Read a localStorage value and parse it, falling back to a default.
 *
 * Six of the initialisers below used a bare
 * `JSON.parse(localStorage.getItem(key) || fallback)`. That expression throws if
 * the stored value is not valid JSON — a half-written value, a value from an
 * older schema, or anything typed into devtools. Because these run in useState
 * initialisers, the throw happens while rendering DataProvider, so it takes
 * down EVERY screen for EVERY role. A cache read must never be able to brick
 * the app. */
const readJson = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    try { localStorage.removeItem(key); } catch { /* private browsing */ }
    return fallback;
  }
};

/* The campus calendar stores its dates as local YYYY-MM-DD strings, so every
   "today" comparison has to be built the same way. toISOString() converts to
   UTC first, which is a different calendar day for the eight hours after
   midnight at UTC+8 — the time zone this system actually runs in. */
export const toLocalISODate = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export const DataProvider = ({ children }) => {
  const { currentUser, isAdmin, isMaintenance, isFacultyOrStaff } = useAuth();
  const { toast } = useToast();
  const [offices, setOffices] = useState(() => readJson('fixit_pdas_offices_v5', INITIAL_OFFICES));
  const [departments, setDepartments] = useState(() => readJson('fixit_pdas_departments_v5', INITIAL_DEPARTMENTS));
  // Requisitions come from MySQL on login and are never faked: there is no
  // sample set to fall back on, because a fabricated ticket is indistinguishable
  // from a real one once it is on screen. If the server is unreachable the list
  // stays empty and the failure is visible, which is the honest outcome.
  const [requisitions, setRequisitions] = useState([]);
  const [isLoadingRequisitions, setIsLoadingRequisitions] = useState(false);

  // Same reasoning: an empty cache means no schedules on record. The previous
  // fallback rendered three fabricated campus inspections on a live system.
  const [calendarEvents, setCalendarEvents] = useState(() => readJson('fixit_pdas_calendar_v3', []));

  // users, pendingRegistrations, and rejectedRegistrations are now backed by
  // the real MySQL database via the backend API (see backend/api.js), not
  // localStorage. They're fetched below whenever an admin is signed in.
  const [users, setUsers] = useState([]);
  const [pendingRegistrations, setPendingRegistrations] = useState([]);
  const [rejectedRegistrations, setRejectedRegistrations] = useState([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [userDataError, setUserDataError] = useState(null);
  const [messageParticipants, setMessageParticipants] = useState([]);

  const refreshUserData = async () => {
    if (!isAdmin) return;
    setIsLoadingUsers(true);
    setUserDataError(null);
    try {
      const [usersData, pendingData, rejectedData] = await Promise.all([
        apiGetUsers(),
        apiGetPendingRegistrations(),
        apiGetRejectedRegistrations(),
      ]);
      setUsers(usersData);
      setPendingRegistrations(pendingData);
      setRejectedRegistrations(rejectedData);
    } catch (err) {
      setUserDataError(err.message || 'Failed to load user data.');
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => {
    refreshUserData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  /* Row totals, and the live page, come from the server.
     The endpoint returns { rows, total, limit, offset }. Previously it returned a
     bare array capped at 200 and every tab counter was computed from that
     window, so once the table outgrew it, tickets quietly vanished from the
     queues while the UI still showed a count. `totalRequisitions` is now the
     server's number rather than the length of whatever arrived. */
  const [requisitionTotal, setRequisitionTotal] = useState(0);
  const [statusCounts, setStatusCounts] = useState({});
  const [statusCountsLoaded, setStatusCountsLoaded] = useState(false);

  /* Pull the per-status counts alongside the list. They are scoped by the
     server exactly as the list is, so a number on a tile and a row in the table
     can never come from different sets. */
  const refreshStatusCounts = React.useCallback(async () => {
    if (!currentUser) return;
    try {
      const { apiGetJobRequestStats } = await import('../backend/api');
      const stats = await apiGetJobRequestStats({ archived: false });
      setStatusCounts(stats?.byStatus || {});
      setStatusCountsLoaded(true);
    } catch {
      // Leave the previous counts; the filtered fallbacks cover first paint.
    }
  }, [currentUser]);

  // ── Live Requisitions from MySQL ──────────────────────────────────────────
  /* Monotonic id for the list read below. A refresh that is already in flight
     when a write commits read the server *before* that write, so applying its
     rows afterwards undoes the write — the "next refreshRequisitions()
     silently reverted it" bug this file already documents. Newest start wins. */
  const refreshSeqRef = React.useRef(0);

  const refreshRequisitions = React.useCallback(async () => {
    if (!currentUser) return;
    const seq = ++refreshSeqRef.current;
    setIsLoadingRequisitions(true);
    try {
      const { apiGetJobRequests } = await import('../backend/api');
      /* Two pages, active and archived, fetched together.
         The endpoint defaults to `is_archived = 0` and nothing in the client
         ever passed `archived=true`, so a row left `requisitions` the moment it
         was archived. The Archived Requests page reads `r.isArchived === true`
         from this same array, so it could only ever have shown nothing, and a
         manual archive looked exactly like a delete with no way back —
         `ch3.md:115` requires archived records to stay retrievable. */
      const [activeResult, archivedResult] = await Promise.allSettled([
        apiGetJobRequests({ limit: 200 }),
        apiGetJobRequests({ limit: 200, archived: 'true' })
      ]);
      // A newer refresh started while this one was reading, so this response
      // is at best as fresh and at worst pre-commit. Dropping it here still
      // runs `finally`, which clears the loading flag.
      if (seq !== refreshSeqRef.current) return;
      const unwrap = (settled) => {
        if (settled.status !== 'fulfilled') return null;
        const page = settled.value;
        if (Array.isArray(page)) return { rows: page, total: page.length };
        return { rows: page?.rows || [], total: page?.total ?? (page?.rows || []).length };
      };
      const activePage = unwrap(activeResult);
      const archivedPage = unwrap(archivedResult);
      if (!activePage && !archivedPage) throw new Error('job request list unavailable');
      const activeRows = activePage?.rows || [];
      const rows = [...activeRows, ...(archivedPage?.rows || [])];
      const total = (activePage?.total ?? 0) + (archivedPage?.total ?? 0);
      setRequisitionTotal(total);

      if (rows.length > 0) {
        // Normalize DB shape to the shape the UI expects
        const normalized = rows.map(r => ({
          ...r,
          id_raw: r.id,
          id: r.ticket_no || r.id,
          ticket_no: r.ticket_no,
          title: r.title || r.category || 'Facility Service Request',
          description: r.description || '',
          controlNo: r.official_tracking_no || r.ticket_no || r.id,
          officialTrackingNo: r.official_tracking_no || '',
          date: (r.created_at || '').slice(0, 10),
          category: r.category ? (r.category.charAt(0).toUpperCase() + r.category.slice(1)) : 'Other',
          urgency: r.urgency_level || 'Medium Risk',
          status: r.status || 'Pending',
          location: [r.building, r.floor, r.room].filter(Boolean).join(' - ') || r.location || 'Campus Facilities',
          // The photo and the originating QR tag are stored snake_case on the
          // row and read camelCase everywhere in the UI — without the mapping
          // the attachment rendered for the person who filed it and vanished for
          // everyone who opened the ticket afterwards.
          photoUrl: r.photo_url || '',
          photoName: r.photo_name || '',
          qrCodeRef: r.qr_code_ref || '',
          locationId: r.location_id ?? null,
          requestedBy: r.requester_name || r.requestedBy || 'Requester',
          department: r.requester_dept || r.department || 'General',
          requesterEmail: r.requester_email || r.requesterEmail || '',
          requesterId: r.requester_id || r.requesterId,
          // The name for display, the id for writing. Keeping them apart is what
          // lets the assignment select offer accounts while the server stores a
          // foreign key — the two used to be one field, so a display string was
          // saved into assigned_to and the technician could not see the work.
          assignedTo: r.assignee_name || r.assignedTo || null,
          assignedToId: r.assigned_to ?? null,
          /* A DATE column, so the value is a calendar day and must not be
             shifted by a time zone. mysql2 hands DATE back as a JS Date at local
             midnight, and toISOString() converts that to UTC — which in UTC+8
             moves a scheduled 28 Sep back to 27 Sep, and the work order lands on
             the day before it was assigned. toLocalISODate() reads the local
             fields, which is what the date means. The string branch handles the
             case where the driver is configured to return a string. */
          scheduledDate: r.scheduled_date
            ? (typeof r.scheduled_date === 'string'
              ? r.scheduled_date.slice(0, 10)
              : toLocalISODate(new Date(r.scheduled_date)))
            : '',
          isArchived: !!r.is_archived,
          requesterApproved: !!r.requester_approved,
          requesterApprovedAt: r.requester_approved_at,
          immediateSupervisor: r.immediate_supervisor || '',
          supervisorApproved: !!r.supervisor_approved,
          supervisorApprovedAt: r.supervisor_approved_at,
          supervisorRemarks: r.supervisor_remarks || '',
          adminApproved: !!r.admin_approved,
          adminApprovedAt: r.admin_approved_at,
          adminRemarks: r.admin_remarks || '',
          adminFieldRemarks: r.admin_field_remarks,
          campusAdminApproved: !!r.campus_admin_approved,
          campusAdminApprovedAt: r.campus_admin_approved_at,
          campusAdminRemarks: r.campus_admin_remarks || '',
          approverName: r.approver_name || '',
          approverRole: r.approver_role || '',
          rejectionStage: r.rejection_stage || null,
          rejectionRemarks: r.rejection_remarks || '',
          replacementFlag: {
            isFlagged: !!r.is_replacement_flagged,
            reason: r.replacement_reason || '',
            itemSpecs: r.replacement_item_specs || '',
            procurementStatus: r.replacement_procurement_status || 'None',
          },
          timeline: r.history || r.timeline || [],
        }));
        setRequisitions(normalized);
      } else {
        setRequisitions([]);
      }
    } catch {
      // Backend offline — keep existing state (seed data or last fetch)
    } finally {
      setIsLoadingRequisitions(false);
    }
    // The tiles are counts, so they follow every refresh of the list. Folding
    // it in here means all ten call sites that already re-read the queue also
    // re-read the counts, with no risk of one being added and forgetting the
    // other. The counts are a second, smaller query, so this costs one extra
    // round trip per refresh rather than a second refresh.
    refreshStatusCounts();
  }, [currentUser, refreshStatusCounts]);

  useEffect(() => {
    refreshRequisitions();
  }, [refreshRequisitions]);

  /* Real-time status (objective 4). The list used to be read exactly once on
     mount, so a ticket somebody else approved stayed stale until a reload or a
     route change. Poll on the same 30-second cadence as the notification poll
     below — refreshRequisitions() re-reads the tile counts as well, so a number
     on a tile and the row under it can never come from different sets. Hidden
     tabs skip the tick so a window left in the background stops hitting the
     API, and visibilitychange catches up the moment the tab is looked at again. */
  useEffect(() => {
    if (!currentUser) return undefined;
    const sync = () => {
      if (document.hidden) return;
      refreshRequisitions();
    };
    const id = window.setInterval(sync, 30 * 1000);
    document.addEventListener('visibilitychange', sync);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', sync);
    };
  }, [currentUser, refreshRequisitions]);

  useEffect(() => {
    if (!currentUser) {
      setMessageParticipants([]);
      return undefined;
    }

    apiGetMessageParticipants()
      .then(setMessageParticipants)
      .catch(() => setMessageParticipants([]));
  }, [currentUser?.id]);

  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem('fixit_pdas_messages_v3');
    return saved ? JSON.parse(saved) : INITIAL_MESSAGES;
  });

  // Live notifications from MySQL — no localStorage fallback.
  // Polling keeps the bell badge in sync without requiring a page refresh.
  const [allNotifications, setAllNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notifPollRef = useRef(null);

  const fetchNotifications = React.useCallback(async () => {
    if (!currentUser) return;
    try {
      const result = await apiGetNotifications({ limit: 100 });
      const notifs = Array.isArray(result) ? result : (result.notifications || []);
      const mapped = notifs.map(n => ({
        id: n.id,
        title: n.title,
        text: n.message || n.text || '',
        time: n.created_at || n.time || '',
        unread: !n.is_read,
        link: n.link || null,
        // Keep recipientUserId so isNotificationForUser still works on any in-memory additions
        recipientUserId: n.user_id || currentUser.id,
      }));
      setAllNotifications(mapped);
      setUnreadCount(typeof result.unread_count === 'number' ? result.unread_count : mapped.filter(n => n.unread).length);
    } catch {
      // Offline or backend down — keep existing state, don't clear
    }
  }, [currentUser]);

  useEffect(() => {
    fetchNotifications();
    notifPollRef.current = setInterval(fetchNotifications, 30 * 1000); // 30-second poll
    return () => clearInterval(notifPollRef.current);
  }, [fetchNotifications]);

  // Notifications are persisted in MySQL — no localStorage sync needed.

  // ── Daily Preventive Maintenance Reminders ─────────────────────────────────
  // Fires on mount (login) and every 60 minutes. Sends a notification for each
  // calendar event scheduled today that hasn't already been reminded this session.
  useEffect(() => {
    if (!currentUser) return;

    const REMINDER_STORAGE_KEY = 'fixit_pdas_calendar_reminded_v1';

    const fireReminders = () => {
      // Local calendar date, not UTC. toISOString() is UTC, so between midnight
      // and 08:00 in UTC+8 it still returns YESTERDAY — meaning the daily
      // reminder never fired for the first eight hours of every single day,
      // while the server's equivalent (CURDATE()) did. The two disagreed, and
      // the campus time zone is the whole reason PreventiveCalendar stores
      // `date` as a local YYYY-MM-DD string in the first place.
      const today = toLocalISODate(new Date());
      const todayEvents = calendarEvents.filter(ev => ev.date === today);
      if (todayEvents.length === 0) return;

      // Load already-reminded set from sessionStorage (resets each browser session)
      let reminded = [];
      try {
        reminded = JSON.parse(sessionStorage.getItem(REMINDER_STORAGE_KEY) || '[]');
      } catch { reminded = []; }

      const newReminders = [];

      todayEvents.forEach(ev => {
        const key = `${today}-${ev.id}`;
        if (reminded.includes(key)) return; // already reminded this session

        newReminders.push({
          id: `reminder-${ev.id}-${Date.now()}`,
          title: 'Preventive maintenance today',
          text: `${ev.title} — ${ev.time} at ${ev.location}. In-charge: ${ev.inCharge}.`,
          time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          unread: true,
          targetRoles: ['admin', 'maintenance']
        });

        reminded.push(key);
      });

      if (newReminders.length > 0) {
        sessionStorage.setItem(REMINDER_STORAGE_KEY, JSON.stringify(reminded));
        setAllNotifications(prev => [...newReminders, ...prev]);
      }
    };

    // Fire immediately on login / mount
    fireReminders();

    // Then re-check every 60 minutes (in case user keeps the app open all day)
    const interval = setInterval(fireReminders, 60 * 60 * 1000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, calendarEvents]);

  const notifications = useMemo(() => {
    if (!currentUser) return [];
    return allNotifications.filter(n => isNotificationForUser(n, currentUser, { isAdmin, isMaintenance, isFacultyOrStaff }));
  }, [allNotifications, currentUser, isAdmin, isMaintenance, isFacultyOrStaff]);

  const setNotifications = (updater) => {
    setAllNotifications(prev => {
      if (typeof updater === 'function') {
        return updater(prev);
      }
      return updater;
    });
  };

  const markAllNotificationsRead = async () => {
    try {
      await apiMarkAllNotificationsRead();
    } catch { /* best-effort */ }
    setAllNotifications(prev => prev.map(n => ({ ...n, unread: false })));
    setUnreadCount(0);
  };

  const markNotificationRead = async (id) => {
    try {
      await apiMarkNotificationRead(id);
    } catch { /* best-effort */ }
    setAllNotifications(prev => prev.map(n => (n.id === id ? { ...n, unread: false } : n)));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const deleteNotification = async (id) => {
    try {
      await apiDeleteNotification(id);
    } catch { /* best-effort */ }
    setAllNotifications(prev => {
      const n = prev.find(x => x.id === id);
      if (n?.unread) setUnreadCount(c => Math.max(0, c - 1));
      return prev.filter(x => x.id !== id);
    });
    toast('Notification deleted.', 'info');
  };

  const clearAllNotifications = async () => {
    try {
      await apiClearAllNotifications();
    } catch { /* best-effort */ }
    setAllNotifications([]);
    setUnreadCount(0);
    toast('All notifications cleared.', 'info');
  };

  const [evaluations, setEvaluations] = useState(() => readJson('fixit_pdas_evaluations_v3', []));

  // QF-PDAS-DC-01 Tracking Number sequence config (admin-editable).
  const [trackingConfig, setTrackingConfig] = useState(() => {
    const saved = readJson('fixit_pdas_tracking_config_v1', null);
    if (saved && typeof saved === 'object') return { ...DEFAULT_TRACKING_CONFIG, ...saved };
    return { ...DEFAULT_TRACKING_CONFIG };
  });

  const [campusLocations, setCampusLocations] = useState(() => readJson('fixit_pdas_campus_locations_v5', INITIAL_CAMPUS_LOCATIONS));

  /* The registry has a server copy — `campus_locations`, exposed by
     lookupRoutes — and nothing ever read or wrote it, so the table sat empty
     and every `job_requests.location_id` resolved to NULL. Pull it in once and
     merge: a database row replaces the local entry carrying the same tag. */
  useEffect(() => {
    let live = true;
    apiGetCampusLocations()
      .then((rows) => {
        if (!live || !Array.isArray(rows) || rows.length === 0) return;
        setCampusLocations((prev) => {
          const merged = new Map();
          const keyOf = (building, floor, room, tag) => tag || [building, floor, room].join('|');
          prev.forEach((loc) => {
            merged.set(keyOf(loc.building, loc.floor, loc.room, loc.qrCodeRef), loc);
          });
          rows.forEach((row) => {
            merged.set(keyOf(row.building, row.floor, row.room, row.qr_code), {
              id: row.id,
              building: row.building || '',
              bldgShort: (row.building || '').split(' ')[0] || 'BLDG',
              floor: row.floor || '',
              room: row.room || '',
              qrCodeRef: row.qr_code || '',
              description: row.description || ''
            });
          });
          return Array.from(merged.values());
        });
      })
      .catch(() => { /* offline — the local list stands on its own */ });
    return () => { live = false; };
  }, []);

  // Persist the local-only rows. Database rows are read back on the next load.
  useEffect(() => {
    localStorage.setItem(
      'fixit_pdas_campus_locations_v5',
      JSON.stringify(campusLocations.filter((loc) => !isServerBackedLocation(loc)))
    );
  }, [campusLocations]);

  useEffect(() => {
    localStorage.setItem('fixit_pdas_offices_v5', JSON.stringify(offices));
  }, [offices]);

  useEffect(() => {
    localStorage.setItem('fixit_pdas_departments_v5', JSON.stringify(departments));
  }, [departments]);

  // Requisitions are stored in MySQL — no localStorage sync needed.

  // The approval history is read-only now (the page reads `audit_log`), so
  // there is nothing to mirror back to localStorage on every change.

  useEffect(() => {
    localStorage.setItem('fixit_pdas_calendar_v3', JSON.stringify(calendarEvents));
  }, [calendarEvents]);

  useEffect(() => {
    localStorage.setItem('fixit_pdas_messages_v3', JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    localStorage.setItem('fixit_pdas_evaluations_v3', JSON.stringify(evaluations));
  }, [evaluations]);

  useEffect(() => {
    localStorage.setItem('fixit_pdas_tracking_config_v1', JSON.stringify(trackingConfig));
  }, [trackingConfig]);

  // ── Tracking Number helpers (Final Approval only) ──────────────────────────
  // Returns next tracking number WITHOUT consuming it, or null when exhausted.
  const peekNextTrackingNumber = () => {
    const cfg = trackingConfig;
    if (Number(cfg.next) > Number(cfg.end)) return null;
    if (Number(cfg.next) < Number(cfg.start)) return formatTrackingNumber(cfg, cfg.start);
    return formatTrackingNumber(cfg, cfg.next);
  };

  // Consumes + returns next tracking number, or null when range exhausted.
  // Skips numbers already used by existing requisitions.
  const generateNextTrackingNumber = () => {
    let cfg = { ...trackingConfig };
    if (Number(cfg.next) < Number(cfg.start)) cfg.next = cfg.start;
    const used = new Set(requisitions.map(r => r.controlNo).filter(Boolean));
    let guard = 0;
    while (guard < 10000) {
      if (Number(cfg.next) > Number(cfg.end)) return null;
      const candidate = formatTrackingNumber(cfg, cfg.next);
      cfg.next = Number(cfg.next) + 1;
      if (!used.has(candidate)) {
        setTrackingConfig(cfg);
        return candidate;
      }
      guard += 1;
    }
    return null;
  };

  const updateTrackingConfig = (patch) => {
    const next = { ...trackingConfig, ...patch };
    next.start = Math.max(0, Number(next.start) || 0);
    next.end = Math.max(next.start, Number(next.end) || next.start);
    next.next = Math.min(Math.max(Number(next.next) || next.start, next.start), next.end + 1);
    next.pad = Math.max(1, Math.min(6, Number(next.pad) || 3));
    if (typeof next.prefix !== 'string' || !next.prefix) next.prefix = DEFAULT_TRACKING_CONFIG.prefix;
    setTrackingConfig(next);
    return next;
  };

  // Admin manual override of a single ticket's tracking number.
  const updateRequisitionTrackingNo = (reqId, newNo) => {
    const clean = String(newNo || '').trim();
    if (!clean) return false;
    const duplicate = requisitions.some(r => r.controlNo === clean && r.id !== reqId && r.controlNo !== reqId);
    if (duplicate) return false;
    setRequisitions(prev => prev.map(r => (r.id === reqId || r.controlNo === reqId)
      ? { ...r, controlNo: clean, timeline: [...(r.timeline || []), { status: 'Tracking Updated', timestamp: new Date().toLocaleString(), actor: 'PDAS Admin', note: `Tracking number set to ${clean}.` }] }
      : r));
    return true;
  };

  // Generic save for overlay-edited QF-PDAS-DC-01 fields (before print).
  const updateRequisitionForm = (reqId, patch) => {
    if (!patch || typeof patch !== 'object') return false;
    setRequisitions(prev => prev.map(r => {
      if (r.id === reqId || r.controlNo === reqId) {
        return {
          ...r,
          ...patch,
          scopeOfWorks: patch.scopeOfWorks || r.scopeOfWorks,
          actionTaken: patch.actionTaken || r.actionTaken,
          finalAction: patch.finalAction || r.finalAction,
        };
      }
      return r;
    }));
    return true;
  };

  // Registration Flow — submits to registration_requests via the backend.
  // `idPhotoUrl` carries a downscaled base64 JPEG of the applicant's ISAT U ID;
  // the admin pending-registration view renders it directly. `consentAt` carries
  // the RA 10173 consent timestamp, without which the server refuses the request.
  const registerUser = async (regData) => {
    try {
      const result = await apiRegister(regData);
      // If the admin happens to be signed in and viewing this list live,
      // refresh so the new pending registration shows up immediately.
      if (isAdmin) refreshUserData();
      return { success: true, regId: result.id };
    } catch (err) {
      throw new Error(err.message || 'Registration could not be submitted.');
    }
  };

  const addOffice = (office) => {
    const value = office.trim();
    if (value && !offices.some(item => item.toLowerCase() === value.toLowerCase())) setOffices(prev => [...prev, value]);
  };

  const addDepartment = (department) => {
    const value = department.trim();
    if (value && !departments.some(item => item.toLowerCase() === value.toLowerCase())) setDepartments(prev => [...prev, value]);
  };

  const approveRegistration = async (regId) => {
    try {
      await apiApproveRegistration(regId);
      await refreshUserData();
    } catch (err) {
      setUserDataError(err.message || 'Failed to approve registration.');
      throw err;
    }
  };

  const rejectRegistration = async (regId, reason = 'Application details could not be verified by PDAS.') => {
    try {
      await apiRejectRegistration(regId, reason);
      await refreshUserData();
    } catch (err) {
      setUserDataError(err.message || 'Failed to reject registration.');
      throw err;
    }
  };

  // Maintenance Personnel Account Creation (Admin Only)
  const createMaintenanceUser = async (techData) => {
    try {
      const result = await apiCreateUser({
        firstName: techData.firstName,
        lastName: techData.lastName,
        email: techData.email,
        password: techData.password,
        role: 'Technician',
        department: 'PDAS Technical Crew Unit',
        phone: techData.phone,
      });
      await refreshUserData();
      return result;
    } catch (err) {
      setUserDataError(err.message || 'Failed to create maintenance account.');
      throw err;
    }
  };

  // Default QF-PDAS-DC-01 Scope of Works Template
  const createDefaultScopeOfWorks = (category, description = '') => ({
    drawingDesign: { checked: category === 'Drawing/Design', options: [], description: category === 'Drawing/Design' ? description : '', dateComplied: '' },
    physicalStructures: { checked: category === 'Physical Structures', options: [], description: category === 'Physical Structures' ? description : '', dateComplied: '' },
    electrical: { checked: category === 'Electrical', options: [], description: category === 'Electrical' ? description : '', dateComplied: '' },
    mechanical: { checked: category === 'Mechanical', options: [], description: category === 'Mechanical' ? description : '', dateComplied: '' },
    waterSanitary: { checked: category === 'Water/Sanitary', options: [], description: category === 'Water/Sanitary' ? description : '', dateComplied: '' },
    airConditioning: { checked: category === 'Air Conditioning', options: [], description: category === 'Air Conditioning' ? description : '', dateComplied: '' }
  });

  // Default QF-PDAS-DC-01 Action Taken Template
  const createDefaultActionTaken = () => ({
    endorsedDesignTeam: { checked: false, detailedPlan: false, powBoq: false, receivedBy: '', date: '' },
    endorsedGSMHead: { checked: false, workOrder: false, receivedBy: '', date: '' },
    returnedToClient: { checked: false, reason: '', receivedBy: '', date: '', remarks: '' },
    // No personal name is pre-filled. Offices are constants, people are data:
    // this line must come from the form or from `approved_by`, never from a
    // name baked into the source — neither appears anywhere in the papers, and
    // a printed official form would otherwise assert an approval nobody gave.
    pdasHeadName: '',
    pdasHeadTitle: 'Head, PDAS / Director, Planning Development and Auxiliary Services'
  });

  // Default QF-PDAS-DC-01 Final Action Template
  const createDefaultFinalAction = () => ({
    status: 'Pending',
    remarks: '',
    campusAdminName: '',
    campusAdminTitle: 'Campus Administrator',
    copyDistribution: '1 – PDAS, 1 – GSM, 1 – Client'
  });

  // Requisitions Workflow & 4-Party Approval Chain
  const addRequisition = async (newReq) => {
    const isDraft = Boolean(newReq.isDraft);
    const nowStr = new Date().toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const requestId = `REQ-${Date.now()}`;
    const isUrgent = newReq.requestType === 'Urgent Request' || newReq.urgency === 'High Risk' || newReq.urgency === 'Urgent';
    const urgency = newReq.urgency || (isUrgent ? 'High Risk' : 'Medium Risk');
    
    const initialStatus = isDraft
      ? 'Draft'
      : (newReq.immediateSupervisor ? 'Pending Supervisor Approval' : 'Pending');

    const entry = {
      id: requestId,
      controlNo: null,
      date: toLocalISODate(new Date()),
      status: initialStatus,
      urgency,
      requestType: newReq.requestType || (isUrgent ? 'Urgent Request' : 'Standard Request'),
      urgentPendingStandardForm: isUrgent && !newReq.isStandardFormFilled,
      urgentDeadline: isUrgent ? 'Within Today (24 Hours)' : null,
      immediateSupervisor: newReq.immediateSupervisor || '',
      requesterApproved: !isDraft,
      requesterApprovedAt: isDraft ? null : new Date().toISOString(),
      supervisorApproved: false,
      supervisorApprovedAt: null,
      supervisorRemarks: '',
      adminApproved: false,
      adminApprovedAt: null,
      adminRemarks: '',
      adminFieldRemarks: null,
      campusAdminApproved: false,
      campusAdminApprovedAt: null,
      campusAdminRemarks: '',
      officialTrackingNo: '',
      rejectionStage: null,
      rejectionRemarks: '',
      scopeOfWorks: newReq.scopeOfWorks || createDefaultScopeOfWorks(newReq.category, newReq.description),
      actionTaken: newReq.actionTaken || createDefaultActionTaken(),
      finalAction: newReq.finalAction || createDefaultFinalAction(),
      replacementFlag: {
        isFlagged: false,
        reason: '',
        itemSpecs: '',
        disposition: 'replacement',
        requestType: newReq.requestType || (isUrgent ? 'Urgent Request' : 'Standard Request'),
        pdasFormName: newReq.pdasFormName || '',
        flaggedBy: '',
        flaggedDate: '',
        procurementStatus: 'None'
      },
      maintenanceFlag: {
        type: '',
        reason: '',
        flaggedBy: '',
        flaggedDate: ''
      },
      isArchived: false,
      archivedAt: null,
      timeline: [
        {
          status: isDraft ? 'Draft Saved' : 'Submitted & Approved',
          timestamp: nowStr,
          actor: `${newReq.requestedBy || currentUser?.name || 'Requester'} (${newReq.requesterRole || 'Requester'})`,
          note: isDraft
            ? 'Request saved as draft.'
            : isUrgent && !newReq.isStandardFormFilled 
              ? 'Urgent High Risk Request submitted. Requester required to complete full form within the day.'
              : 'Job Request submitted and electronically approved.'
        }
      ],
      ...newReq
    };

    const payload = {
      // Sent verbatim. This used to be .toLowerCase()'d, which turned
      // 'Drawing/Design' into 'drawing/design' and 'Urgent Hazard' into
      // 'urgent hazard' — neither matched the server's allow-list, so both
      // were silently replaced with a default and the category was lost.
      category: newReq.category || 'Electrical',
      description: newReq.description || newReq.title || 'Maintenance Request',
      urgencyLevel: urgency,
      requestType: newReq.requestType || (isUrgent ? 'Urgent Request' : 'Standard Request'),
      isStandardFormFilled: Boolean(newReq.isStandardFormFilled),
      immediateSupervisor: newReq.immediateSupervisor || null,
      isDraft,
      // Without this the server stores location_id = NULL and every location
      // join in the app comes back empty.
      locationId: newReq.locationId || null,
      // The server resolves location_id from these when the id is absent or
      // stale, and registers a place that has never been catalogued.
      qrCodeRef: newReq.qrCodeRef || '',
      building: newReq.building || '',
      floor: newReq.floor || '',
      room: newReq.room || '',
      /* The photo the requester attached. It was produced by the overlay and
         stored on the local record, then dropped here — the request looked
         filed with a photo and the server never received one. */
      photoUrl: newReq.photoUrl || '',
      photoName: newReq.photoName || '',
    };

    /* Sends the request, or — when there is no connection, or the server has
       faulted — holds it in the local outbox under an idempotency key, so the
       retry cannot produce a second ticket. A 4xx is neither queued nor
       reported as filed. */
    const outcome = await submitOrQueue(payload);

    if (outcome.queued) {
      if (!outcome.stored) {
        toast('Not filed. There is no connection and this request could not be saved for later.', 'error');
        return null;
      }
      entry.id = 'Pending';
      entry.controlNo = 'Pending';
      entry.ticket_no = null;
      entry.status = initialStatus;
      entry.isQueued = true;
      toast('No connection. Saved on this device and sent when the connection is back.', 'info');
      return entry;
    }

    if (outcome.error) {
      /* The old code logged a warning and carried on to a success toast with a
         locally-invented ticket number. That is how a request the server had
         refused still looked filed. */
      toast(`Not filed. ${outcome.error.message}`, 'error');
      return null;
    }

    const res = outcome.result;
    if (res?.duplicate) {
      toast(`Already filed as ${res.ticketNo}.`, 'info');
    }
    if (res?.ticketNo) {
      entry.id = res.ticketNo;
      entry.controlNo = res.ticketNo;
      entry.ticket_no = res.ticketNo;
      entry.status = res.status || initialStatus;
    }

    setRequisitions(prev => [entry, ...prev.filter(r => r.id !== entry.id)]);
    await refreshRequisitions();
    await fetchNotifications();
    toast(isDraft ? `Draft saved as ${entry.id}.` : `${entry.id} filed.`);

    return entry;
  };

  // Step 3 (2): Immediate Supervisor Action
  const submitSupervisorAction = async (reqId, action, remarks = '') => {
    const target = requisitions.find(r => r.id === reqId || r.controlNo === reqId);
    const nowStr = new Date().toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const isApprove = action === 'approve';
    // A return is revise-and-resubmit, not a refusal — it must not land in the
    // terminal 'Rejected' state the way it used to.
    const nextStatus = isApprove ? 'Under Review' : 'Returned';

    try {
      const { apiSupervisorAction } = await import('../backend/api');
      const rawId = target?.id_raw || target?.id || reqId;
      await apiSupervisorAction(rawId, { action, remarks });
    } catch (e) {
      console.warn('API supervisor action fallback:', e.message);
    }

    setRequisitions(prev => prev.map(r => {
      if (r.id === reqId || r.controlNo === reqId) {
        return {
          ...r,
          status: nextStatus,
          supervisorApproved: isApprove,
          supervisorApprovedAt: isApprove ? new Date().toISOString() : null,
          supervisorRemarks: remarks,
          rejectionStage: isApprove ? null : 'supervisor',
          rejectionRemarks: isApprove ? null : remarks,
          timeline: [
            ...r.timeline,
            {
              status: isApprove ? 'Supervisor Approved' : 'Supervisor Returned',
              timestamp: nowStr,
              actor: 'Immediate Supervisor',
              note: remarks || (isApprove ? 'Electronically approved' : 'Returned for revision')
            }
          ]
        };
      }
      return r;
    }));

    toast(isApprove ? 'Approved by Immediate Supervisor and routed to PDAS Admin.' : 'Returned to requester with remarks.');
    refreshRequisitions();
    return true;
  };

  /* Step 3 (3): System Administrator Action.
   *
   * Server-authoritative. This used to catch the API error, log a warning, apply
   * the new status to local state anyway, and toast success — so a rejected
   * transition (terminal ticket, wrong stage) still looked like it worked, and
   * the next refreshRequisitions() silently reverted it. The server already
   * writes the status, the history row, the audit entry and both notifications
   * in one transaction, so there is nothing left to do locally except re-read. */
  const submitAdminAction = async (reqId, action, remarks = '', fieldRemarks = null) => {
    const target = requisitions.find(r => r.id === reqId || r.controlNo === reqId);
    const ref = target?.controlNo || target?.ticket_no || reqId;
    if (!target) return false;

    try {
      const { apiAdminAction } = await import('../backend/api');
      const rawId = target.id_raw || target.id || reqId;
      const result = await apiAdminAction(rawId, { action, remarks, fieldRemarks });
      await refreshRequisitions();
      toast(
        result?.message
          || (action === 'evaluate' ? 'Evaluation begun.'
            : action === 'approve' ? 'Endorsed to the Campus Administrator.'
            : 'Returned to the requester.'),
        'success'
      );
      return true;
    } catch (e) {
      // The server's own message is the useful one: it names the ticket's actual
      // status and what it may move to.
      toast(e.message || `Could not ${action} ${ref}.`, 'error');
      return false;
    }
  };

  /* Step 3 (4): Approver (Campus Administrator) Action.
   *
   * Server-authoritative for the same reason as submitAdminAction: the local
   * status flip was applied even when the call failed, so a refused approval
   * still reported "Final Approval granted!". */
  const submitApproverAction = async (reqId, action, remarks = '') => {
    const target = requisitions.find(r => r.id === reqId || r.controlNo === reqId);
    const ref = target?.controlNo || target?.ticket_no || reqId;
    if (!target) return false;

    try {
      const { apiApproverAction } = await import('../backend/api');
      const rawId = target.id_raw || target.id || reqId;
      const result = await apiApproverAction(rawId, { action, remarks });
      await refreshRequisitions();
      toast(
        result?.message
          || (action === 'approve'
            ? 'Approved. The request is back with PDAS for assignment.'
            : 'Disapproved. The request is back with PDAS.'),
        'success'
      );
      return true;
    } catch (e) {
      toast(e.message || `Could not ${action} ${ref}.`, 'error');
      return false;
    }
  };

  /* Move a request into PDAS review.
   *
   * This used to setRequisitions() and toast, without ever calling the server:
   * the status lived in the browser until the next refreshRequisitions() read
   * the unchanged row back, and the status-history row, the audit entry and the
   * requester's notification were never written at all. Same defect class as the
   * four dead write paths found earlier. The server owns this transition now. */
  const reviewRequisition = async (reqId, remarks = 'Ticket placed under PDAS review') => {
    const target = requisitions.find(r => r.id === reqId || r.controlNo === reqId);
    if (!target) return false;
    // reviewRequisition means the "evaluate" action, which is the one server
    // action whose target status is Under Review.
    const ok = await submitAdminAction(target.id, 'evaluate', remarks);
    if (!ok) toast(`${target.controlNo || target.id} was not moved under review.`, 'error');
    return ok;
  };

  /* PDAS endorsement: Pending/Under Review → Pending Final Approval.
   *
   * The approval-history row, the timeline entry and the notification below are
   * all written by the server inside the same transaction as the status change.
   * They used to be built here and pushed into local arrays, so the audit trail
   * the approver saw was fabricated by the browser and vanished on refresh.
   * The official tracking number is NOT minted at this step: it is issued later,
   * when the System Administrator assigns the work order — this version used to
   * invent it client-side via generateNextTrackingNumber(). */
  const approveRequisition = async (reqId, remarks = 'Endorsed by PDAS') => {
    const target = requisitions.find(r => r.id === reqId || r.controlNo === reqId);
    if (!target) return false;
    const ok = await submitAdminAction(target.id, 'approve', remarks);
    if (ok) notifyApproverQueue(target.controlNo || target.ticket_no || target.id);
    else toast(`${target.controlNo || target.id} was not endorsed.`, 'error');
    return ok;
  };

  const rejectRequisition = async (reqId, remarks = 'Returned to the requester for revision') => {
    const target = requisitions.find(r => r.id === reqId || r.controlNo === reqId);
    if (!target) return false;
    const ok = await submitAdminAction(target.id, 'reject', remarks);
    if (!ok) toast(`${target.controlNo || target.id} was not returned.`, 'error');
    return ok;
  };

  /* Issue a work order: assign approved work to maintenance personnel.
   *
   * Server-authoritative, like the action endpoints above. Two specific defects
   * in the previous version:
   *
   *   1. it caught the API error, logged a warning, and then set the local
   *      status to Ongoing anyway — so a rejected assignment (wrong stage, or a
   *      ticket already closed) reported success and the change vanished on the
   *      next refresh
   *   2. it passed assignedTo: techId, which was routinely null because the
   *      select's value was a display string like "Juan Cruz — Electrical". The
   *      server then stored NULL in assigned_to while the browser showed a name,
   *      and the technician could never see the work order, because
   *      canViewTicket() matches on assigned_to = user.id.
   *
   * The control number is issued by the server from tracking_sequences inside
   * the same transaction. The browser must not mint one: a client-generated
   * number is not atomic and two admins assigning at once would collide. */
  /* Notify campus administrators that a request is waiting on them.
   *
   * The notification list is keyed on role, and 'campus_admin' was missing from
   * the arrays used when the PDAS office endorsed a request — so the
   * "Pending Final Approval" notice was addressed to faculty and staff, and the
   * approver's bell stayed silent on exactly the step that needs them. */
  const notifyApproverQueue = (ref, extra = '') => {
    setNotifications(prev => [{
      id: `notif-${Date.now()}`,
      title: 'Awaiting final approval',
      text: `${ref} needs the Campus Administrator's decision.${extra ? ` ${extra}` : ''}`,
      time: 'Just now',
      unread: true,
      targetRoles: ['campus_admin', 'faculty_staff']
    }, ...prev]);
  };

  const assignTechnician = async (reqId, technician, techId = null, scheduledDate = null) => {
    const target = requisitions.find(r => r.id === reqId || r.controlNo === reqId);
    const ref = target?.controlNo || target?.ticket_no || reqId;
    if (!target) return false;

    // Accept either (id, name) or an object, so a caller cannot pass a display
    // string in the slot that the server stores as a foreign key.
    const person = typeof technician === 'object' && technician !== null ? technician : null;
    const resolvedId = techId ?? person?.id ?? null;
    const resolvedName = person?.name || (typeof technician === 'string' ? technician : '');

    if (!resolvedId) {
      toast('Select the maintenance person to assign. Their account id is required.', 'error');
      return false;
    }

    try {
      const { apiAssignTechnician } = await import('../backend/api');
      const rawId = target.id_raw || target.id || reqId;
      const result = await apiAssignTechnician(rawId, {
        assignedTo: resolvedId,
        assignedToName: resolvedName,
        scheduledDate: scheduledDate || undefined
      });
      await refreshRequisitions();
      toast(
        result?.officialTrackingNo
          ? `Assigned to ${resolvedName}. Control number ${result.officialTrackingNo}.`
          : (result?.message || `Assigned to ${resolvedName}.`),
        'success'
      );
      return true;
    } catch (e) {
      toast(e.message || `Could not assign ${ref}.`, 'error');
      return false;
    }
  };

  // Complete Standard Form Details for Urgent Requests
  const completeStandardFormForUrgent = (reqId, standardDetails) => {
    const target = requisitions.find(r => r.id === reqId || r.controlNo === reqId);
    if (!target) return;

    const nowStr = new Date().toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    setRequisitions(prev => prev.map(r => {
      if (r.id === reqId || r.controlNo === reqId) {
        return {
          ...r,
          urgentPendingStandardForm: false,
          immediateSupervisor: standardDetails.immediateSupervisor || r.immediateSupervisor,
          immediateSupervisorSignature: 'Signed',
          scopeOfWorks: standardDetails.scopeOfWorks || r.scopeOfWorks,
          // Persist the completed work description. The field is free text and
          // unbounded — do not truncate it.
          description: standardDetails.description || r.description,
          timeline: [
            ...r.timeline,
            {
              status: 'Standard Form Filed',
              timestamp: nowStr,
              actor: `${r.requestedBy} (${r.requesterRole || 'Requester'})`,
              note: 'Standard QF-PDAS-DC-01 Form details filed for urgent request.'
            }
          ]
        };
      }
      return r;
    }));

    setNotifications(prev => [
      {
        id: `notif-${Date.now()}`,
        title: 'Standard QF-PDAS-DC-01 Form Filed',
        text: `Full Standard Form filed for urgent ticket ${target.controlNo || target.id} by ${target.requestedBy}.`,
        time: 'Just now',
        unread: true,
        targetRole: 'admin'
      },
      ...prev
    ]);
  };

  // Update Action Taken (PDAS Director & Team)
  const updateActionTaken = (reqId, actionTakenData) => {
    const target = requisitions.find(r => r.id === reqId || r.controlNo === reqId);
    if (!target) return;

    const nowStr = new Date().toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    setRequisitions(prev => prev.map(r => {
      if (r.id === reqId || r.controlNo === reqId) {
        const updatedActionTaken = { ...r.actionTaken, ...actionTakenData };
        return {
          ...r,
          actionTaken: updatedActionTaken,
          timeline: [
            ...r.timeline,
            {
              status: 'Action Taken Updated',
              timestamp: nowStr,
              actor: currentUser?.name
                ? `${currentUser.name} (${currentUser.role || 'PDAS Admin'})`
                : 'PDAS Admin',
              note: 'Official Action Taken section updated on QF-PDAS-DC-01 form.'
            }
          ]
        };
      }
      return r;
    }));

    setNotifications(prev => [
      {
        id: `notif-${Date.now()}`,
        title: 'Action Taken Updated',
        text: `PDAS Action Taken section updated for ${target.controlNo || target.id}.`,
        time: 'Just now',
        unread: true,
        targetRoles: ['faculty_staff', 'maintenance']
      },
      ...prev
    ]);
  };

  // Update Final Action (Campus Administrator)
  /* Final Approver decision: Pending Final Approval → Approved or Rejected.
   *
   * Server-authoritative now. This used to set the status and build the
   * timeline, the approval-history row and the notification in the browser, and
   * mint the official control number client-side with generateNextTrackingNumber().
   * None of that reached MySQL: a refusal from the policy (a ticket not actually
   * awaiting approval, or one already closed) still showed "Final Approval
   * granted!" and vanished on the next read. The server now records the decision
   * and notifies PDAS inside its own transaction, so the request returns to the
   * admin's assignment queue for real. The control number is NOT minted here: it
   * is issued from tracking_sequences when the System Administrator assigns the
   * work order, i.e. after this final approval.
   *
   * Returns { ok, trackingNo } rather than a bare tracking number. The old
   * shape returned a string, and a null from "not found" was indistinguishable
   * from a successful approval that happened to have no number yet — so the
   * caller reported success on both. */
  const updateFinalAction = async (reqId, finalStatus, remarks = '') => {
    const target = requisitions.find(r => r.id === reqId || r.controlNo === reqId);
    if (!target) return { ok: false, trackingNo: null };

    const action = finalStatus === 'Approved' ? 'approve' : 'reject';
    try {
      const { apiApproverAction } = await import('../backend/api');
      const rawId = target.id_raw || target.id || reqId;
      const result = await apiApproverAction(rawId, { action, remarks });
      await refreshRequisitions();
      return { ok: true, trackingNo: result?.officialTrackingNo || target.controlNo || null };
    } catch (e) {
      toast(e.message || 'The final decision was not recorded.', 'error');
      return { ok: false, trackingNo: null };
    }
  };

  /* Status changes are a server-side decision.
     This used to mutate local state, invent a notification, and toast success
     without ever calling PUT /job-requests/:id/status — so a technician
     completing a work order, or an admin moving a ticket, changed nothing in
     MySQL. The next refreshRequisitions() wiped the change and the server's
     status history, audit log and notifications never happened.

     The server is now authoritative: it owns the transition policy, the
     terminal-state guard, the history row and the notifications. We call it,
     then re-read. A rejection is reported with the server's own message. */
  const updateRequisitionStatus = async (reqId, newStatus, actorName = 'Maintenance Staff', notes = '') => {
    const target = requisitions.find(r => r.id === reqId || r.controlNo === reqId);
    if (!target) {
      toast(`Request ${reqId} was not found.`, 'error');
      return false;
    }
    try {
      const { apiUpdateJobRequestStatus } = await import('../backend/api');
      const res = await apiUpdateJobRequestStatus(target.id ?? reqId, {
        status: newStatus,
        remarks: notes || `Status updated to ${newStatus}.`
      });
      await refreshRequisitions();
      toast(res?.message || `Request ${target.controlNo || reqId} updated to ${newStatus}.`);
      return true;
    } catch (err) {
      const reason = err?.message || 'The status change was rejected.';
      toast(`Could not update ${target.controlNo || reqId}: ${reason}`, 'error');
      return false;
    }
  };

  const raiseMaintenanceFlag = (reqId, flagData) => {
    const target = requisitions.find(r => r.id === reqId || r.controlNo === reqId);
    if (!target) return;

    const nowStr = new Date().toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const flaggedBy = flagData.flaggedBy || 'Maintenance Personnel';

    setRequisitions(prev =>
      prev.map(r => {
        if (r.id === reqId || r.controlNo === reqId) {
          const isDisposal = flagData.type === 'Disposal';
          return {
            ...r,
            maintenanceFlag: {
              type: flagData.type,
              reason: flagData.reason,
              scheduledWork: flagData.scheduledWork || '',
              scheduledDate: flagData.scheduledDate || '',
              scheduledTime: flagData.scheduledTime || '',
              flaggedBy,
              flaggedDate: nowStr
            },
            // Keep disposition marker on replacementFlag so the
            // For Replacement list can indicate Replacement vs Disposal.
            replacementFlag: {
              ...r.replacementFlag,
              ...(isDisposal ? { disposition: 'disposal', reason: flagData.reason, flaggedBy, flaggedDate: nowStr } : {})
            },
            status: flagData.type === 'Cannot Complete' ? 'Unable to Complete' : r.status,
            timeline: [
              ...r.timeline,
              {
                status: flagData.type,
                timestamp: nowStr,
                actor: flaggedBy,
                note: flagData.reason
              }
            ]
          };
        }
        return r;
      })
    );

    setNotifications(prev => [{
      id: `notif-${Date.now()}`,
      title: `Maintenance Flag: ${flagData.type}`,
      text: `${target.controlNo} was flagged by ${flaggedBy}.${flagData.scheduledDate ? ` Proposed follow-up: ${flagData.scheduledWork} on ${flagData.scheduledDate} at ${flagData.scheduledTime}.` : ''}`,
      time: 'Just now',
      unread: true,
      targetRole: 'admin'
    }, ...prev]);
    toast(`Maintenance flag recorded on request ${target.controlNo || reqId}.`, 'info');
  };

  // Replacement / Irreparable Item Flagging Workflow
  /* Flagging an irreparable item raises a procurement request and notifies the
     PDAS office — it is a server-side action with an audit row.

     This function was also broken in a way that was invisible until you used it:
     it referenced `target` in its notification text without ever defining it,
     so calling it threw a ReferenceError partway through, leaving the UI in a
     half-updated state. */
  const raiseReplacementFlag = async (reqId, flagData) => {
    const target = requisitions.find(r => r.id === reqId || r.controlNo === reqId);
    if (!target) {
      toast(`Request ${reqId} was not found.`, 'error');
      return false;
    }
    const nowStr = new Date().toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    try {
      const { apiFlagReplacement } = await import('../backend/api');
      await apiFlagReplacement(target.id ?? reqId, { reason: flagData.reason });
    } catch (err) {
      toast(`Could not flag ${target.controlNo || reqId}: ${err?.message || 'rejected by the server.'}`, 'error');
      return false;
    }

    setRequisitions(prev =>
      prev.map(r => {
        if (r.id === reqId || r.controlNo === reqId) {
          return {
            ...r,
            replacementFlag: {
              isFlagged: true,
              reason: flagData.reason,
              itemSpecs: flagData.itemSpecs,
              disposition: 'replacement',
              flaggedBy: flagData.flaggedBy || 'Maintenance Personnel',
              flaggedDate: nowStr,
              procurementStatus: 'Pending Purchase Request (PR)'
            },
            maintenanceFlag: {
              type: 'Replacement',
              reason: flagData.reason,
              flaggedBy: flagData.flaggedBy || 'Maintenance Personnel',
              flaggedDate: nowStr
            },
            timeline: [
              ...r.timeline,
              {
                status: 'Replacement Flagged',
                timestamp: nowStr,
                actor: flagData.flaggedBy || 'Maintenance Personnel',
                note: `Irreparable item reported: ${flagData.reason}. Recommends procurement of ${flagData.itemSpecs}.`
              }
            ]
          };
        }
        return r;
      })
    );
    toast(`${target.controlNo || reqId} flagged for replacement.`, 'info');
    return true;
  };

  /* Confirming the wet-ink hardcopy is the System Administrator's attestation
     that the signed QF-PDAS-DC-01 is on file. It does NOT grant final approval:
     it hands the request to the Approver, who is the only officer that may
     write 'Approved'. Sending it straight to 'Approved' skipped that level
     entirely — and the generic endpoint sets no approval flags, so nothing on
     the server noticed. */
  const confirmSignatures = async (reqId, remarks = 'Signed hardcopy received') => {
    const target = requisitions.find(r => r.id === reqId || r.controlNo === reqId);
    if (!target) {
      toast(`Request ${reqId} was not found.`, 'error');
      return false;
    }
    if (target.status !== 'Awaiting Signatures' && target.status !== 'Pending Final Approval') {
      toast(`${target.controlNo || reqId} is "${target.status}" — there are no signatures pending on it.`, 'error');
      return false;
    }

    try {
      const { apiUpdateJobRequestStatus } = await import('../backend/api');
      await apiUpdateJobRequestStatus(target.id ?? reqId, {
        status: 'Pending Final Approval',
        remarks
      });
      await refreshRequisitions();
      toast(`Signed form confirmed — request ${target.controlNo || reqId} is now awaiting final approval.`);
      return true;
    } catch (err) {
      toast(`Could not confirm signatures: ${err?.message || 'rejected by the server.'}`, 'error');
      return false;
    }
  };

  // Archive Requisition (non-destructive)
  /* Archiving is a server-side record change, not a local flag. This used to
     set isArchived in client state and toast success without ever calling
     PUT /job-requests/:id/archive, so an archived ticket was still in the live
     queue for every other user and came back on the next refresh. */
  const archiveRequisition = async (reqId) => {
    const target = requisitions.find(r => r.id === reqId || r.controlNo === reqId);
    if (!target) {
      toast(`Request ${reqId} was not found.`, 'error');
      return false;
    }
    try {
      const { apiArchiveJobRequest } = await import('../backend/api');
      const res = await apiArchiveJobRequest(target.id ?? reqId);
      await refreshRequisitions();
      toast(res?.message || `Request ${target.controlNo || reqId} archived.`, 'info');
      return true;
    } catch (err) {
      toast(`Could not archive ${target.controlNo || reqId}: ${err?.message || 'rejected by the server.'}`, 'error');
      return false;
    }
  };

  const unarchiveRequisition = async (reqId) => {
    const target = requisitions.find(r => r.id === reqId || r.controlNo === reqId);
    if (!target) {
      toast(`Request ${reqId} was not found.`, 'error');
      return false;
    }
    try {
      const { apiUnarchiveJobRequest } = await import('../backend/api');
      const res = await apiUnarchiveJobRequest(target.id ?? reqId);
      await refreshRequisitions();
      toast(res?.message || `Request ${target.controlNo || reqId} restored from archive.`, 'info');
      return true;
    } catch (err) {
      toast(`Could not restore ${target.controlNo || reqId}: ${err?.message || 'rejected by the server.'}`, 'error');
      return false;
    }
  };

  /* Evaluations are the ISO/IEC 25010 quality record, so they are persisted
     server-side. This used to push an object into local state and thank the
     user; nothing was written, the evaluation was gone on refresh, and the
     admin's aggregate quality figures were computed from whatever happened to
     still be in one browser's memory. */
  const submitEvaluation = async (reqId, evalData) => {
    const target = requisitions.find(r => r.id === reqId || r.controlNo === reqId);
    if (!target) {
      toast(`Request ${reqId} was not found.`, 'error');
      return null;
    }
    const nowStr = new Date().toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    const evalEntry = {
      id: `EVAL-${Date.now()}`,
      reqId,
      controlNo: target?.controlNo || reqId,
      category: target?.category || 'General',
      location: target?.location || 'Unknown',
      resolutionStatus: target?.status || 'Unknown',
      submittedBy: evalData.submittedBy || target?.requestedBy || 'Requester',
      submittedAt: nowStr,
      functionalSuitability: evalData.functionalSuitability,
      usability: evalData.usability,
      reliability: evalData.reliability,
      performanceEfficiency: evalData.performanceEfficiency,
      security: evalData.security,
      comments: evalData.comments || ''
    };

    try {
      const { apiSubmitEvaluation } = await import('../backend/api');
      await apiSubmitEvaluation({
        jobRequestId: target.id ?? reqId,
        functionalSuitability: evalData.functionalSuitability,
        usability: evalData.usability,
        reliability: evalData.reliability,
        performanceEfficiency: evalData.performanceEfficiency,
        security: evalData.security,
        comments: evalData.comments || ''
      });
    } catch (err) {
      toast(`Evaluation not saved: ${err?.message || 'rejected by the server.'}`, 'error');
      return null;
    }

    setEvaluations(prev => [evalEntry, ...prev]);
    toast(`Evaluation submitted for request ${target?.controlNo || reqId}. Thank you.`);
    return evalEntry;
  };

  const updateProcurementStatus = (reqId, procurementStatus) => {
    const target = requisitions.find(r => r.id === reqId || r.controlNo === reqId);
    setRequisitions(prev =>
      prev.map(r => {
        if (r.id === reqId || r.controlNo === reqId) {
          return {
            ...r,
            replacementFlag: {
              ...r.replacementFlag,
              procurementStatus
            }
          };
        }
        return r;
      })
    );
    if (target) {
      setNotifications(prev => [{
        id: `notif-${Date.now()}`,
        title: 'Replacement Status Updated',
        text: `${target.controlNo} replacement status changed to "${procurementStatus}".`,
        time: 'Just now',
        unread: true,
        targetRoles: ['maintenance', 'faculty_staff']
      }, ...prev]);
    }
  };

  const addCalendarEvent = async (eventData) => {
    const newEvent = {
      id: `CAL-${Date.now().toString().slice(-4)}`,
      status: 'Scheduled',
      ...eventData
    };
    setCalendarEvents(prev => [...prev, newEvent]);

    try {
      const created = await apiCreatePreventiveSchedule({
        title: eventData.title,
        category: eventData.category,
        scheduledDate: eventData.date,
        timeWindow: eventData.time,
        location: eventData.location,
        // The reminder job joins on this column. Sending the name alone left
        // assigned_to NULL, so no reminder was ever sent for any schedule.
        assignedTo: eventData.assignedTo || null,
        inChargeName: eventData.inCharge
      });
      // Remember the row's real id so the next read of the server list can
      // match this entry instead of showing the same schedule twice.
      if (created?.id) {
        setCalendarEvents(prev =>
          prev.map(ev => (ev.id === newEvent.id ? { ...ev, serverId: created.id } : ev))
        );
      }
    } catch {
      // Keep local state if backend is offline
    }

    setNotifications(prev => [
      {
        id: `notif-${Date.now()}`,
        title: 'Preventive Maintenance Scheduled',
        text: `${newEvent.title} on ${newEvent.date} (${newEvent.location})`,
        time: 'Just now',
        unread: true,
        targetRoles: ['maintenance', 'faculty_staff', 'admin']
      },
      ...prev
    ]);
  };

  /* Withdraw a schedule. A row that reached the server is deleted there first
     and only then dropped locally, so a failed delete surfaces as an error
     instead of a schedule that vanishes here and reappears on the next read. */
  const removeCalendarEvent = async (event) => {
    if (event?.serverId) {
      await apiDeletePreventiveSchedule(event.serverId);
    }
    setCalendarEvents(prev => prev.filter(ev => ev.id !== event.id));
  };

  const toggleUserStatus = async (userId) => {
    const target = users.find(u => u.id === userId);
    if (!target) return;
    const isCurrentlyActive = String(target.status || '').toLowerCase() === 'active';
    const newStatus = isCurrentlyActive ? 'Inactive' : 'Active';
    try {
      await apiSetUserStatus(userId, newStatus);
      await refreshUserData();
    } catch (err) {
      setUserDataError(err.message || 'Failed to update user status.');
      throw err;
    }
  };

  const updateUser = async (userId, updatedFields) => {
    try {
      await apiUpdateUser(userId, updatedFields);
      await refreshUserData();
    } catch (err) {
      setUserDataError(err.message || 'Failed to update user.');
      throw err;
    }
  };

  const removeUser = async (userId) => {
    const target = users.find(user => user.id === userId);
    if (!target || target.role === 'Admin' || target.userType === 'Admin') return false;
    try {
      await apiRemoveUser(userId);
      await refreshUserData();
      return true;
    } catch (err) {
      setUserDataError(err.message || 'Failed to remove user.');
      return false;
    }
  };

  const requestPasswordChange = (email) => {
    setNotifications(prev => [{
      id: `notif-${Date.now()}`,
      title: 'Password Change Request',
      text: `${email} requested a password reset.`,
      time: 'Just now',
      unread: true,
      targetRole: 'admin'
    }, ...prev]);
  };

  const sendMessage = (threadId, text, senderName = 'PDAS Director') => {
    setMessages(prev =>
      prev.map(m => {
        if (m.id === threadId) {
          return {
            ...m,
            unread: false,
            preview: text,
            time: 'Just now',
            thread: [...m.thread, { sender: senderName, text, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]
          };
        }
        return m;
      })
    );
  };

  const createMessageThread = ({ subject, recipient, controlNo = '', initialMessage, senderName = 'PDAS Director' }) => {
    const newThread = {
      id: `msg_${Date.now()}`,
      sender: recipient,
      role: 'Participant',
      controlNo: controlNo || 'GENERAL-INQ',
      subject: subject || 'General Maintenance Inquiry',
      time: 'Just now',
      unread: false,
      preview: initialMessage,
      thread: [
        {
          sender: senderName,
          text: initialMessage,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]
    };
    setMessages(prev => [newThread, ...prev]);
    return newThread;
  };

  // Campus Locations & QR Code Registry Management
  //
  // These three used to touch React state and localStorage only, which is why
  // `campus_locations` was empty on the server while the Print Labels page
  // looked fully populated. Each now mirrors to the API; if the call fails the
  // local change still stands, so the page keeps working offline.
  const addCampusLocation = (newLoc) => {
    const id = `loc-${Date.now()}`;
    const formatted = {
      id,
      building: newLoc.building?.trim() || 'General Building',
      bldgShort: newLoc.bldgShort?.trim() || (newLoc.building ? newLoc.building.split(' ')[0] : 'BLDG'),
      floor: newLoc.floor?.trim() || 'Ground Floor',
      room: newLoc.room?.trim() || 'Assigned Room',
      qrCodeRef: newLoc.qrCodeRef?.trim() || `ISATU-${(newLoc.bldgShort || 'BLDG').toUpperCase().replace(/[^A-Z0-9]/g, '')}-${Date.now().toString().slice(-4)}`
    };
    setCampusLocations(prev => [formatted, ...prev]);
    apiAddCampusLocation(formatted)
      .then((result) => {
        const serverId = result?.id;
        if (!serverId) return;
        // Swap the temporary local id for the real one so later edits and
        // deletes address the database row rather than a key that exists
        // only in this browser.
        setCampusLocations(prev => prev.map(loc => (loc.id === formatted.id ? { ...loc, id: serverId } : loc)));
      })
      .catch(() => { /* offline or duplicate tag — the local row stays */ });
    setNotifications(prev => [{
      id: `notif-${Date.now()}`,
      title: 'Facility Asset / Room Registered',
      text: `${formatted.room} (${formatted.building}) successfully registered with QR tag ${formatted.qrCodeRef}.`,
      time: 'Just now',
      unread: true,
      targetRole: 'admin'
    }, ...prev]);
    return formatted;
  };

  /* Resolves whatever key Print Labels passes (a local id, a QR tag, or a
     database id) to the database id, or null when the row lives only here. */
  const serverLocationIdFor = (idOrQr) => {
    if (/^\d+$/.test(String(idOrQr))) return String(idOrQr);
    const hit = campusLocations.find(loc => loc.id === idOrQr || loc.qrCodeRef === idOrQr);
    return hit && isServerBackedLocation(hit) ? String(hit.id) : null;
  };

  const updateCampusLocation = (idOrQr, updatedLoc) => {
    const serverId = serverLocationIdFor(idOrQr);
    if (serverId) {
      apiUpdateCampusLocation(serverId, updatedLoc).catch(() => { /* offline */ });
    }
    setCampusLocations(prev => prev.map(loc => {
      if (loc.id === idOrQr || loc.qrCodeRef === idOrQr) {
        return {
          ...loc,
          ...updatedLoc,
          building: updatedLoc.building !== undefined ? updatedLoc.building.trim() : loc.building,
          bldgShort: updatedLoc.bldgShort !== undefined ? updatedLoc.bldgShort.trim() : loc.bldgShort,
          floor: updatedLoc.floor !== undefined ? updatedLoc.floor.trim() : loc.floor,
          room: updatedLoc.room !== undefined ? updatedLoc.room.trim() : loc.room,
          qrCodeRef: updatedLoc.qrCodeRef !== undefined ? updatedLoc.qrCodeRef.trim() : loc.qrCodeRef
        };
      }
      return loc;
    }));
  };

  const deleteCampusLocation = (idOrQr) => {
    const serverId = serverLocationIdFor(idOrQr);
    if (serverId) {
      // Without this the row vanished from the page and came straight back on
      // the next reload, because the server copy had never been touched.
      apiDeleteCampusLocation(serverId).catch(() => { /* offline */ });
    }
    setCampusLocations(prev => prev.filter(loc => loc.id !== idOrQr && loc.qrCodeRef !== idOrQr));
  };

  /* Restore the seeded campus list. Only the locally-held rows are replaced:
     database rows are the admin's own record and are merged back in on the
     next load. This also wrote to a `v3` key that the reader no longer opens,
     so the reset never actually cleared the cached list. */
  const resetCampusLocations = () => {
    setCampusLocations(prev => [
      ...INITIAL_CAMPUS_LOCATIONS,
      ...prev.filter(isServerBackedLocation)
    ]);
    localStorage.setItem('fixit_pdas_campus_locations_v5', JSON.stringify(INITIAL_CAMPUS_LOCATIONS));
  };

  // KPI Calculations
  const activeRequisitions = requisitions.filter(r => !r.isArchived);
  /* The all-requests figure is the server's count of everything on file, not
     the length of the page that happens to be loaded. The per-status figures
     below are still derived from the loaded rows, which is why they are capped
     at what one page can hold. */
  /* Counts come from the database, not from the loaded page.
     These used to be filtered out of the requisitions array, which holds one
     200-row window. Past that a tile could read 4 while the queue held 31 and
     nothing looked wrong. statusCounts is the server's GROUP BY status under
     the same visibility scope as the list; the filtered fallbacks are only used
     before the first response lands. */
  const countOf = (...statuses) =>
    statuses.reduce((sum, s) => sum + (statusCounts[s] ?? 0), 0);

  const totalRequisitions = requisitionTotal || activeRequisitions.length;
  const pendingApprovals = statusCountsLoaded
    ? countOf('Pending', 'Pending Supervisor Approval')
    : activeRequisitions.filter(r => r.status === 'Pending').length;
  const awaitingSignaturesCount = statusCountsLoaded
    ? countOf('Pending Final Approval', 'Awaiting Signatures')
    : activeRequisitions.filter(r => r.status === 'Pending Final Approval' || r.status === 'Awaiting Signatures').length;
  const ongoingWorkOrders = statusCountsLoaded
    ? countOf('Ongoing', 'In Progress', 'On Hold', 'Approved', 'Pending Final Approval', 'Awaiting Signatures')
    : activeRequisitions.filter(r => r.status === 'In Progress' || r.status === 'Ongoing' || r.status === 'On Hold' || r.status === 'Approved' || r.status === 'Pending Final Approval' || r.status === 'Awaiting Signatures').length;
  const completedRepairs = statusCountsLoaded
    ? countOf('Completed')
    : activeRequisitions.filter(r => r.status === 'Completed').length;
  const unreadMessagesCount = messages.filter(m => m.unread).length;
  const pendingRegistrationsCount = pendingRegistrations.length;
  const replacementFlaggedCount = activeRequisitions.filter(r => r.replacementFlag && r.replacementFlag.isFlagged).length;
  const monthlyRequestTotals = requisitions.reduce((totals, request) => {
    const month = request.date?.slice(0, 7);
    if (month) totals[month] = (totals[month] || 0) + 1;
    return totals;
  }, {});
  // Pending evaluations: completed tickets that have no evaluation submitted yet
  const pendingEvaluations = requisitions.filter(r =>
    r.status === 'Completed' &&
    !evaluations.some(e => e.reqId === r.id || e.controlNo === r.controlNo)
  );

  // Shared ticket search query — the navbar global search writes here and the
  // faculty ticket lists read it, so there is only one search box.
  const [ticketSearch, setTicketSearch] = useState('');

  // Deep-link target: when a notification is clicked, the drawer stores the
  // ticket reference here and navigates to the role tab; the destination view
  // opens the matching record, then clears the ref.
  const [focusedTicketRef, setFocusedTicketRef] = useState(null);

  // Cross-view handoff for the landing-screen QR shortcut. "Scan QR" sits on
  // the dashboard, but the app owns exactly one scanner — the one inside the
  // request form's location step — so what crosses here is the intent to scan,
  // not a room: the intake flow picks it up, opens the form straight into
  // scanning and clears the flag so every later filing opens normally.
  const [pendingScanIntent, setPendingScanIntent] = useState(false);

  return (
    <DataContext.Provider
      value={{
        requisitions,
        calendarEvents,
        users,
        messageParticipants,
        offices,
        departments,
        campusLocations,
        pendingRegistrations,
        pendingRegistrationsCount,
        rejectedRegistrations,
        isLoadingUsers,
        userDataError,
        refreshUserData,
        messages,
        notifications,
        unreadCount,
        fetchNotifications,
        markAllNotificationsRead,
        markNotificationRead,
        deleteNotification,
        clearAllNotifications,
        evaluations,
        totalRequisitions,
        pendingApprovals,
        awaitingSignaturesCount,
        ongoingWorkOrders,
        completedRepairs,
        unreadMessagesCount,
        replacementFlaggedCount,
        monthlyRequestTotals,
        pendingEvaluations,
        registerUser,
        addOffice,
        addDepartment,
        addCampusLocation,
        updateCampusLocation,
        deleteCampusLocation,
        resetCampusLocations,
        submitSupervisorAction,
        submitAdminAction,
        submitApproverAction,
        approveRegistration,
        rejectRegistration,
        createMaintenanceUser,
        approveRequisition,
        reviewRequisition,
        rejectRequisition,
        confirmSignatures,
        assignTechnician,
        updateRequisitionStatus,
        raiseMaintenanceFlag,
        raiseReplacementFlag,
        updateProcurementStatus,
        isLoadingRequisitions,
        refreshRequisitions,
        addRequisition,
        completeStandardFormForUrgent,
        updateActionTaken,
        updateFinalAction,
        archiveRequisition,
        unarchiveRequisition,
        submitEvaluation,
        addCalendarEvent,
        removeCalendarEvent,
        toggleUserStatus,
        updateUser,
        removeUser,
        requestPasswordChange,
        sendMessage,
        createMessageThread,
        trackingConfig,
        updateTrackingConfig,
        peekNextTrackingNumber,
        generateNextTrackingNumber,
        updateRequisitionTrackingNo,
        updateRequisitionForm,
        ticketSearch,
        setTicketSearch,
        focusedTicketRef,
        setFocusedTicketRef,
        pendingScanIntent,
        setPendingScanIntent
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};


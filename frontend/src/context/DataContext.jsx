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
  apiUpdatePreventiveSchedule,
  apiCompletePreventiveSchedule,
  apiDeletePreventiveSchedule,
  apiGetNotifications,
  apiMarkNotificationRead,
  apiMarkAllNotificationsRead,
  apiArchiveNotification,
  apiRestoreNotification,
  apiDeleteNotification,
  apiClearAllNotifications,
  apiGetCampusLocations,
  apiAddCampusLocation,
  apiUpdateCampusLocation,
  apiDeleteCampusLocation,
  apiGetJobRequests,
  apiGetJobRequestById,
  apiConfirmSignedForm,
  apiUpdateJobRequestTrackingNo,
  apiUpdateJobRequestFormDetails,
  apiReviseJobRequest,
  apiSendContactMessage,
  apiGetMessages,
  apiGetMessageThread,
  apiReplyMessage,
  apiMarkMessageRead,
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
  'Research Office',
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

export const DEFAULT_FORM_TEMPLATE_CONFIG = {
  // Header
  republicLine: 'Republic of the Philippines',
  institutionName: 'ILOILO SCIENCE AND TECHNOLOGY UNIVERSITY',
  campusName: 'DUMANGAS CAMPUS',
  campusAddress: 'P.D. Monfort South, Dumangas, Iloilo',
  documentTitle: 'JOB REQUEST FOR REPAIR, MAINTENANCE AND CONSTRUCTION',
  department: 'Department: PDAS',
  documentCode: 'QF-PDAS-DC-01',
  revisionNo: '00',
  effectiveDate: 'February 3, 2025',
  customLogoUrl: '',

  // Body Layout & Typography
  fontFamily: 'serif', // 'serif' ("Times New Roman") | 'sans' ("Inter", Arial, sans-serif)
  showDefectPhoto: true,
  showVerificationQr: true,
  trackingLabel: 'Tracking Number:',
  clientNameLabel: 'Name of Client:',
  clientOfficeLabel: 'Office of Client:',
  supervisorLabel: 'Immediate Supervisor:',
  dateLabel: 'Date of Request:',
  locationLabel: 'Location:',

  // Footer & Signatures
  pdasHeadTitle: 'Head, PDAS / Director, Planning Development and Auxiliary Services',
  approverTitle: 'Campus Administrator',
  copyDistribution: 'Copy distribution: 1 – PDAS, 1 – GSM, 1 – Client',
  disclaimerNotice: 'The electronic approvals recorded on this form are internal, timestamped, auditable administrative confirmations and do not constitute legally binding digital signatures. This official document is automatically generated and archived for university facility audit, inventory, and official printing.',
  verificationText: 'Verify this form: scan to check tracking against the PDAS record.',
};

export const DEFAULT_CSM_TEMPLATE_CONFIG = {
  // Header
  republicLine: 'Republic of the Philippines',
  institutionName: 'ILOILO SCIENCE AND TECHNOLOGY UNIVERSITY',
  campusAddress: 'La Paz, Iloilo City',
  documentTitle: 'CLIENT SATISFACTION MEASUREMENT',
  department: 'HRMO',
  documentCode: 'QF-HRM-15',
  revisionNo: '07',
  effectiveDate: 'April 15, 2026',

  // Intro & Privacy Commitment
  introText: 'This Client Satisfaction Measurement (CSM) tracks the customer experience of government offices. Your feedback on your recently concluded transaction will help this office provide a better service. Personal information shared will be kept confidential and you always have the option to not answer this form.',
  dataPrivacyTitle: 'Data Privacy Commitment',
  dataPrivacyText: 'Pursuant to Republic Act No. 10173, also known as the Data Privacy Act of 2012, Iloilo Science and Technology University affirms its commitment to protect and respect the privacy of its clients and stakeholders. All information collected through the Client Satisfaction Measurement (CSM) Form shall be processed and safeguarded in accordance with the principles of transparency, legitimate purpose, and proportionality, as mandated under the Data Privacy Act of 2012.',
  consentTitle: 'Consent of Data Subject',
  consentText: 'I hereby give my consent and authorize Iloilo Science and Technology University to collect, process, share, disclose, or transfer my personal data to authorized third parties when necessary for journalistic, artistic, literary, research, or other lawful purposes, in accordance with the provisions of Republic Act No. 10173, also known as the Data Privacy Act of 2012.',

  // Demographics default
  officeTransactedWith: 'Physical Development and Auxiliary Services (PDAS)',
  defaultRegion: 'Region VI - Western Visayas',

  // Citizen\'s Charter Instructions & Questions
  ccInstructions: "Check mark (✓) your answer to the Citizen's Charter (CC) questions. The Citizen's Charter is an official document that reflects the services of a government agency/office including its requirements, fees, and processing times among others.",
  cc1Prompt: 'Which of the following best describes your awareness of a CC?',
  cc2Prompt: 'If aware of CC (answered 1-3 in CC1), would you say that the CC of this office was...?',
  cc3Prompt: 'If aware of CC (answered codes 1-3 in CC1), how much did the CC help you in your transaction?',

  // SQD Table Instructions & Dimensions
  sqdInstructions: 'For SQD 0-8, please put a check mark (✓) on the column that best corresponds to your answer.',
  sqd0: 'I am satisfied with the service that I availed.',
  sqd1: 'I spent a reasonable amount of time for my transaction.',
  sqd2: "The office followed the transaction's requirements and steps based on the information provided.",
  sqd3: 'The steps (including payment) I needed to do for my transaction were easy and simple.',
  sqd4: 'I easily found information about my transaction from the office or its website.',
  sqd5: 'I paid a reasonable amount of fees for my transaction.',
  sqd6: 'I feel the office was fair to everyone, or "walang palakasan", during my transaction.',
  sqd7: 'I was treated courteously by the staff, and (if asked for help) the staff was helpful.',
  sqd8: 'I got what I needed from the government office, or (if denied) denial of request was sufficiently explained to me.',

  suggestionsPrompt: 'Suggestions on how we can further improve our services (optional):',
  footerClosing: 'THANK YOU!'
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
  { id: 'loc-adm-06', building: 'Administration Building', bldgShort: 'Admin', floor: '2nd Floor', room: 'Research Office', qrCodeRef: 'ISATU-ADM-RESEARCH-OFFICE' },
  { id: 'loc-adm-06b', building: 'Administration Building', bldgShort: 'Admin', floor: '2nd Floor', room: 'Research Services Office', qrCodeRef: 'ISATU-ADM-RESEARCH' },
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






const INITIAL_MESSAGES = [];

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

const writeJson = (key, val) => {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch { /* private browsing */ }
};

/* The campus calendar stores its dates as local YYYY-MM-DD strings, so every
   "today" comparison has to be built the same way. toISOString() converts to
   UTC first, which is a different calendar day for the eight hours after
   midnight at UTC+8 — the time zone this system actually runs in. */
export const toLocalISODate = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export const DataProvider = ({ children }) => {
  const { currentUser, isAdmin, isSuperAdmin, isMaintenance, isFacultyOrStaff } = useAuth();
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
    if (!isAdmin && !isSuperAdmin) return;
    setIsLoadingUsers(true);
    setUserDataError(null);
    try {
      const [usersData, pendingData, rejectedData] = await Promise.all([
        apiGetUsers(),
        isSuperAdmin ? apiGetPendingRegistrations().catch(() => []) : Promise.resolve([]),
        isSuperAdmin ? apiGetRejectedRegistrations().catch(() => []) : Promise.resolve([]),
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
  }, [isAdmin, isSuperAdmin]);

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
      /* Two pages, active and archived, fetched together.
         The endpoint defaults to `is_archived = 0` and nothing in the client
         ever passed `archived=true`, so a row left `requisitions` the moment it
         was archived. The Archived Requests page reads `r.isArchived === true`
         from this same array, so it could only ever have shown nothing, and a
         manual archive looked exactly like a delete with no way back —
         `ch3.md:115` requires archived records to stay retrievable. */
      const [activeResult, archivedResult] = await Promise.allSettled([
        apiGetJobRequests({ limit: 200 }),
        (isAdmin || isSuperAdmin)
          ? apiGetJobRequests({ limit: 200, archived: 'true' })
          : Promise.resolve({ rows: [], total: 0 })
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
          requestType: 'Standard Request',
          isStandardFormFilled: true,
          urgentPendingStandardForm: false,
          urgentAssignedAt: r.urgent_assigned_at || null,
          urgentOverdueNotified: false,
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
          archivedAt: r.archived_at || null,
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
            disposition: r.replacement_disposition || 'replacement',
            flaggedBy: r.replacement_flagged_by || '',
            flaggedDate: r.replacement_flagged_at
              ? new Date(r.replacement_flagged_at).toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
              : '',
          },
          timeline: r.history || r.timeline || [],
          materialsUsed: r.materials_used || (() => {
            try {
              const det = typeof r.request_details === 'string' ? JSON.parse(r.request_details) : (r.request_details || {});
              return det.materialsUsed || '';
            } catch { return ''; }
          })(),
          completionPhotoUrl: r.completion_photo_url || (() => {
            try {
              const det = typeof r.request_details === 'string' ? JSON.parse(r.request_details) : (r.request_details || {});
              return det.completionPhotoUrl || '';
            } catch { return ''; }
          })(),
          signedFormConfirmed: !!r.signed_form_confirmed,
          signedFormScanUrl: (() => {
            try {
              const det = typeof r.request_details === 'string' ? JSON.parse(r.request_details) : (r.request_details || {});
              return det.signedFormScanUrl || '';
            } catch { return ''; }
          })(),
          // Unpack stored JSON details (scopeOfWorks, actionTaken, finalAction)
          ...(() => {
            try {
              const det = typeof r.request_details === 'string'
                ? JSON.parse(r.request_details)
                : (r.request_details || {});
              // Restore maintenanceFlag for 'Cannot Complete' flags stored in request_details.
              // This prevents the flag from being lost after a page reload.
              const restoredMaintenanceFlag =
                det.maintenanceFlagType === 'Cannot Complete'
                  ? {
                      type: 'Cannot Complete',
                      reason: det.maintenanceFlagReason || '',
                      scheduledWork: det.scheduledWork || '',
                      scheduledDate: det.scheduledDate || '',
                      scheduledTime: det.scheduledTime || '',
                      flaggedBy: r.replacement_flagged_by || '',
                      flaggedDate: r.replacement_flagged_at
                        ? new Date(r.replacement_flagged_at).toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                        : ''
                    }
                  : null;
              return {
                ...(det.title ? { title: det.title } : {}),
                ...(det.notes ? { notes: det.notes } : {}),
                scopeOfWorks: det.scopeOfWorks || undefined,
                actionTaken: det.actionTaken || undefined,
                finalAction: det.finalAction || (r.campus_admin_approved || r.status === 'Approved' ? {
                  status: 'Approved',
                  remarks: r.campus_admin_remarks || '',
                  date: r.campus_admin_approved_at || ''
                } : (r.rejection_stage === 'approver' ? {
                  status: 'Disapproved',
                  remarks: r.rejection_remarks || '',
                  date: ''
                } : undefined)),
                ...(restoredMaintenanceFlag ? { maintenanceFlag: restoredMaintenanceFlag } : {})
              };
            } catch {
              return {};
            }
          })()
        }));
        setRequisitions(prev => {
          const prevPhotos = new Map();
          prev.forEach(item => {
            if (item.photoUrl || item.completionPhotoUrl || (item.timeline && item.timeline.length > 0)) {
              prevPhotos.set(String(item.id_raw ?? item.id), {
                photoUrl: item.photoUrl,
                completionPhotoUrl: item.completionPhotoUrl,
                timeline: item.timeline,
              });
            }
          });
          return normalized.map(item => {
            const cached = prevPhotos.get(String(item.id_raw ?? item.id));
            if (!cached) return item;
            return {
              ...item,
              photoUrl: item.photoUrl || cached.photoUrl || '',
              completionPhotoUrl: item.completionPhotoUrl || cached.completionPhotoUrl || '',
              timeline: (item.timeline && item.timeline.length > 0) ? item.timeline : (cached.timeline || []),
            };
          });
        });
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

  // Messages are authoritative from the database only; localStorage is just a
  // write-through cache for offline resilience. When the DB is reset (empty),
  // the cache is cleared on the next fetch. We start with the cached value for
  // instant display, but the DB sync immediately corrects any stale threads.
  const [messages, setMessages] = useState(() => readJson('fixit_pdas_messages_v4', INITIAL_MESSAGES));

  useEffect(() => {
    try {
      localStorage.setItem('fixit_pdas_messages_v4', JSON.stringify(messages));
    } catch (e) {
      console.warn('Failed to save messages to localStorage:', e);
    }
  }, [messages]);

  // Live notifications from MySQL — no localStorage fallback.
  // Polling keeps the bell badge in sync without requiring a page refresh.
  // Archived notifications are fetched separately so they never reappear in the
  // active inbox or unread badge.
  const [allNotifications, setAllNotifications] = useState([]);
  const [archivedNotifications, setArchivedNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notifPollRef = useRef(null);

  const fetchNotifications = React.useCallback(async () => {
    if (!currentUser) return;
    const mapRows = (result) => {
      const notifs = Array.isArray(result) ? result : (result.notifications || []);
      return notifs.map(n => ({
        id: n.id,
        title: n.title,
        text: n.message || n.text || '',
        time: n.created_at || n.time || '',
        unread: !n.is_read,
        link: n.link || null,
        archivedAt: n.archived_at || null,
        // Keep recipientUserId so isNotificationForUser still works on any in-memory additions
        recipientUserId: n.user_id || currentUser.id,
      }));
    };

    try {
      const [activeResult, archivedResult] = await Promise.allSettled([
        apiGetNotifications({ limit: 100 }),
        apiGetNotifications({ limit: 100, archived: true }),
      ]);

      if (activeResult.status === 'fulfilled') {
        const mapped = mapRows(activeResult.value);
        setAllNotifications(mapped);
        const serverUnread = activeResult.value?.unread_count;
        setUnreadCount(typeof serverUnread === 'number' ? serverUnread : mapped.filter(n => n.unread).length);
      }
      if (archivedResult.status === 'fulfilled') {
        setArchivedNotifications(mapRows(archivedResult.value));
      }
    } catch {
      // Offline or backend down — keep existing state, don't clear
    }
  }, [currentUser]);

  useEffect(() => {
    fetchNotifications();
    notifPollRef.current = setInterval(() => {
      if (document.hidden) return;
      fetchNotifications();
    }, 30 * 1000); // 30-second poll
    return () => clearInterval(notifPollRef.current);
  }, [fetchNotifications]);

  const fetchBackendMessages = React.useCallback(async () => {
    if (!currentUser) return;
    try {
      const rows = await apiGetMessages();
      if (!Array.isArray(rows)) return;

      setMessages(prev => {
        const existingMap = new Map();
        prev.forEach(m => {
          if (m.backendId) existingMap.set(String(m.backendId), m);
          if (m.id && String(m.id).startsWith('db_msg_')) {
            existingMap.set(String(m.id).replace('db_msg_', ''), m);
          }
        });

        const serverMapped = rows.map(r => {
          const rowIdStr = String(r.id);
          const existing = existingMap.get(rowIdStr);
          const isContact = Boolean(r.contact_name || r.contact_email);
          const senderLabel = isContact
            ? `${r.contact_name} (${r.contact_email})`
            : (r.sender_name || 'Visitor');
          const timeFormatted = r.created_at ? new Date(r.created_at).toLocaleString([], {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }) : 'Recently';

          const replies = Array.isArray(r.replies) ? r.replies.map(rep => ({
            sender: rep.sender_name || 'PDAS Director',
            text: rep.body,
            time: rep.created_at ? new Date(rep.created_at).toLocaleString([], {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            }) : 'Recently'
          })) : [];

          const initialMsgItem = {
            sender: senderLabel,
            text: r.body || '',
            time: timeFormatted
          };

          const fullThread = [initialMsgItem, ...replies];

          if (existing) {
            return {
              ...existing,
              backendId: r.id,
              subject: r.subject || existing.subject,
              unread: typeof existing.unread === 'boolean' ? existing.unread : !Boolean(r.is_read),
              thread: fullThread.length >= existing.thread.length ? fullThread : existing.thread,
              preview: fullThread[fullThread.length - 1]?.text || r.body || existing.preview
            };
          }

          return {
            id: `db_msg_${r.id}`,
            backendId: r.id,
            sender: senderLabel,
            contactName: r.contact_name || '',
            contactEmail: r.contact_email || '',
            role: isContact ? 'Public Visitor' : 'Requester',
            controlNo: isContact ? 'PUBLIC-CONTACT' : `MSG-${String(r.id).padStart(4, '0')}`,
            subject: r.subject || (isContact ? `Inquiry from ${r.contact_name}` : 'Direct Message'),
            time: timeFormatted,
            unread: !Boolean(r.is_read),
            preview: fullThread[fullThread.length - 1]?.text || r.body || '',
            thread: fullThread
          };
        });

        // When the DB is empty (after a data reset) return only what the server
        // knows about. Non-server / localStorage-only threads are discarded so
        // the inbox matches the database exactly — stale cached threads no longer
        // ghost-appear after a full data wipe.
        if (rows.length === 0) {
          try { localStorage.removeItem('fixit_pdas_messages_v4'); } catch { /* private browsing */ }
          return [];
        }

        // Keep non-server local threads (offline drafts, unsynced items)
        const serverIds = new Set(rows.map(r => String(r.id)));
        const nonServerThreads = prev.filter(m => {
          const bid = m.backendId ? String(m.backendId) : null;
          const did = m.id && String(m.id).startsWith('db_msg_') ? String(m.id).replace('db_msg_', '') : null;
          return !(bid && serverIds.has(bid)) && !(did && serverIds.has(did));
        });

        return [...serverMapped, ...nonServerThreads];
      });
    } catch {
      // Offline or network error
    }
  }, [currentUser]);

  useEffect(() => {
    fetchBackendMessages();
    const msgPoll = setInterval(() => {
      if (document.hidden) return;
      fetchBackendMessages();
    }, 20 * 1000);
    return () => clearInterval(msgPoll);
  }, [fetchBackendMessages]);

  // When an offline outbox item finishes syncing, refresh list, messages and notifications
  useEffect(() => {
    const onSynced = () => {
      refreshRequisitions();
      fetchNotifications();
      fetchBackendMessages();
    };
    window.addEventListener('fixit:outbox-synced', onSynced);
    return () => window.removeEventListener('fixit:outbox-synced', onSynced);
  }, [refreshRequisitions, fetchNotifications, fetchBackendMessages]);

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

  const archiveNotification = async (id) => {
    const target = allNotifications.find(n => n.id === id) || archivedNotifications.find(n => n.id === id);
    try {
      await apiArchiveNotification(id);
    } catch (err) {
      toast(`Could not archive notification: ${err?.message || 'request failed.'}`, 'error');
      return false;
    }
    setAllNotifications(prev => {
      const n = prev.find(x => x.id === id);
      if (n?.unread) setUnreadCount(c => Math.max(0, c - 1));
      return prev.filter(x => x.id !== id);
    });
    if (target) {
      setArchivedNotifications(prev => [
        { ...target, unread: false, archivedAt: new Date().toISOString() },
        ...prev.filter(n => n.id !== id),
      ]);
    }
    toast('Notification moved to the Archive Center.', 'info');
    return true;
  };

  const restoreNotification = async (id) => {
    try {
      await apiRestoreNotification(id);
    } catch (err) {
      toast(`Could not restore notification: ${err?.message || 'request failed.'}`, 'error');
      return false;
    }
    setArchivedNotifications(prev => prev.filter(n => n.id !== id));
    await fetchNotifications();
    toast('Notification restored to your inbox.', 'info');
    return true;
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
    setArchivedNotifications(prev => prev.filter(x => x.id !== id));
    toast('Notification deleted.', 'info');
  };

  const clearAllNotifications = async () => {
    try {
      await apiClearAllNotifications();
    } catch { /* best-effort */ }
    setAllNotifications([]);
    setArchivedNotifications([]);
    setUnreadCount(0);
    toast('All notifications cleared.', 'info');
  };

  const [evaluations, setEvaluations] = useState(() => readJson('fixit_pdas_evaluations_v3', []));

  useEffect(() => {
    if (!currentUser) return;
    import('../backend/api').then(({ apiGetEvaluations }) => {
      apiGetEvaluations()
        .then(rows => {
          if (Array.isArray(rows)) {
            const mapped = rows.map(ev => ({
              id: ev.id ? `EVAL-${ev.id}` : `EVAL-${Date.now()}`,
              backendId: ev.id,
              reqId: ev.ticket_no || ev.job_request_id,
              jobRequestId: ev.job_request_id,
              controlNo: ev.ticket_no || ev.job_request_id,
              category: ev.category || 'General',
              location: [ev.building, ev.floor, ev.room].filter(Boolean).join(' - ') || 'Unknown',
              resolutionStatus: ev.resolution_status || 'Completed',
              submittedBy: ev.evaluated_by_name || 'Requester',
              submittedAt: ev.created_at ? new Date(ev.created_at).toLocaleString() : '',
              functionalSuitability: ev.functional_suitability,
              usability: ev.usability,
              reliability: ev.reliability,
              performanceEfficiency: ev.performance_efficiency,
              security: ev.security,
              comments: ev.comments || ev.suggestions || '',
              consent: ev.consent ?? 1,
              clientType: ev.client_type || 'Government',
              region: ev.region || 'Region VI - Western Visayas',
              serviceAvailed: ev.service_availed || ev.ticket_no,
              cc1: ev.cc1,
              cc2: ev.cc2,
              cc3: ev.cc3,
              sqd0: ev.sqd0,
              sqd1: ev.sqd1,
              sqd2: ev.sqd2,
              sqd3: ev.sqd3,
              sqd4: ev.sqd4,
              sqd5: ev.sqd5,
              sqd6: ev.sqd6,
              sqd7: ev.sqd7,
              sqd8: ev.sqd8,
              suggestions: ev.suggestions,
              csmData: ev.csm_data
            }));
            setEvaluations(mapped);
            writeJson('fixit_pdas_evaluations_v3', mapped);
          }
        })
        .catch(() => {});
    });
  }, [currentUser?.id]);

  // QF-PDAS-DC-01 Tracking Number sequence config (admin-editable).
  const [trackingConfig, setTrackingConfig] = useState(() => {
    const saved = readJson('fixit_pdas_tracking_config_v1', null);
    if (saved && typeof saved === 'object') return { ...DEFAULT_TRACKING_CONFIG, ...saved };
    return { ...DEFAULT_TRACKING_CONFIG };
  });

  // QF-PDAS-DC-01 Form Template Configuration (admin-editable Header, Footer & Layout).
  const [formTemplateConfig, setFormTemplateConfig] = useState(() => {
    const saved = readJson('fixit_form_template_config_v1', null);
    if (saved && typeof saved === 'object') return { ...DEFAULT_FORM_TEMPLATE_CONFIG, ...saved };
    return { ...DEFAULT_FORM_TEMPLATE_CONFIG };
  });

  const updateFormTemplateConfig = (patch) => {
    if (!patch || typeof patch !== 'object') return formTemplateConfig;
    const next = { ...formTemplateConfig, ...patch };
    setFormTemplateConfig(next);
    writeJson('fixit_form_template_config_v1', next);
    return next;
  };

  const resetFormTemplateConfig = () => {
    setFormTemplateConfig({ ...DEFAULT_FORM_TEMPLATE_CONFIG });
    writeJson('fixit_form_template_config_v1', { ...DEFAULT_FORM_TEMPLATE_CONFIG });
    return { ...DEFAULT_FORM_TEMPLATE_CONFIG };
  };

  // QF-HRM-15 Client Satisfaction Measurement Form Template Configuration (admin-editable).
  const [csmTemplateConfig, setCsmTemplateConfig] = useState(() => {
    const saved = readJson('fixit_csm_template_config_v1', null);
    if (saved && typeof saved === 'object') return { ...DEFAULT_CSM_TEMPLATE_CONFIG, ...saved };
    return { ...DEFAULT_CSM_TEMPLATE_CONFIG };
  });

  const updateCsmTemplateConfig = (patch) => {
    if (!patch || typeof patch !== 'object') return csmTemplateConfig;
    const next = { ...csmTemplateConfig, ...patch };
    setCsmTemplateConfig(next);
    writeJson('fixit_csm_template_config_v1', next);
    return next;
  };

  const resetCsmTemplateConfig = () => {
    setCsmTemplateConfig({ ...DEFAULT_CSM_TEMPLATE_CONFIG });
    writeJson('fixit_csm_template_config_v1', { ...DEFAULT_CSM_TEMPLATE_CONFIG });
    return { ...DEFAULT_CSM_TEMPLATE_CONFIG };
  };

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
    const target = requisitions.find(r => r.id === reqId || r.controlNo === reqId || r.id_raw === reqId);
    const rawId = target?.id_raw ?? target?.id ?? reqId;
    setRequisitions(prev => prev.map(r => (r.id === reqId || r.controlNo === reqId)
      ? { ...r, controlNo: clean, officialTrackingNo: clean, timeline: [...(r.timeline || []), { status: 'Tracking Updated', timestamp: new Date().toLocaleString(), actor: 'PDAS Admin', note: `Tracking number set to ${clean}.` }] }
      : r));
    apiUpdateJobRequestTrackingNo(rawId, clean)
      .then(() => refreshRequisitions())
      .catch((err) => {
        toast(`Could not save tracking number to server: ${err?.message || 'request failed.'}`, 'error');
        refreshRequisitions();
      });
    return true;
  };

  // Generic save for overlay-edited QF-PDAS-DC-01 fields (before print).
  const updateRequisitionForm = (reqId, patch) => {
    if (!patch || typeof patch !== 'object') return false;
    const target = requisitions.find(r => r.id === reqId || r.controlNo === reqId || r.id_raw === reqId);
    const rawId = target?.id_raw ?? target?.id ?? reqId;
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
    apiUpdateJobRequestFormDetails(rawId, patch)
      .then(() => refreshRequisitions())
      .catch((err) => {
        console.warn('Could not persist form details:', err?.message);
      });
    return true;
  };

  // Fetch full single ticket detail (photo_url, completion_photo_url, history) on demand
  const fetchRequisitionDetail = React.useCallback(async (reqId) => {
    if (!reqId) return null;
    const target = requisitions.find(r =>
      r.id === reqId ||
      r.controlNo === reqId ||
      r.id_raw === reqId ||
      String(r.id_raw) === String(reqId) ||
      r.ticket_no === reqId
    );
    const rawId = target?.id_raw ?? target?.id ?? reqId;
    try {
      const detail = await apiGetJobRequestById(rawId);
      if (!detail) return null;
      let detJson = {};
      try {
        detJson = typeof detail.request_details === 'string'
          ? JSON.parse(detail.request_details)
          : (detail.request_details || {});
      } catch {}
      const mappedTimeline = Array.isArray(detail.history) && detail.history.length > 0
        ? detail.history.map(h => ({
            status: h.to_status || h.status || 'Updated',
            timestamp: h.created_at ? new Date(h.created_at).toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '',
            actor: h.changed_by_name || 'System',
            note: h.remarks || '',
          }))
        : (target?.timeline || []);
      const patch = {
        photoUrl: detail.photo_url || detJson.photoUrl || target?.photoUrl || '',
        photoName: detail.photo_name || detJson.photoName || target?.photoName || '',
        completionPhotoUrl: detail.completion_photo_url || detJson.completionPhotoUrl || target?.completionPhotoUrl || '',
        materialsUsed: detail.materials_used || detJson.materialsUsed || target?.materialsUsed || '',
        signedFormConfirmed: detail.signed_form_confirmed !== undefined ? Boolean(detail.signed_form_confirmed) : target?.signedFormConfirmed,
        signedFormScanUrl: detJson.signedFormScanUrl || target?.signedFormScanUrl || '',
        timeline: mappedTimeline,
      };
      setRequisitions(prev => prev.map(r => {
        if (r.id === reqId || r.controlNo === reqId || String(r.id_raw) === String(detail.id) || r.ticket_no === detail.ticket_no) {
          return { ...r, ...patch };
        }
        return r;
      }));
      return { ...(target || {}), ...patch };
    } catch {
      return target || null;
    }
  }, [requisitions]);

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
        middleName: techData.middleName || null,
        lastName: techData.lastName,
        email: techData.email,
        password: techData.password,
        role: 'maintenance',
        department: 'PDAS Technical Crew Unit',
        phone: techData.phone,
        specialization: techData.specialization || 'General Campus Facility',
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
    
    // Urgent emergency requests bypass the supervisor endorsement chain entirely:
    // they route straight to Admin (Pending) for immediate dispatch.
    // Campus Admin filings self-endorse and auto-approve immediately.
    const isCampusAdminFiling = !isDraft && currentUser?.role === 'campus_admin';
    const initialStatus = isDraft
      ? 'Draft'
      : isCampusAdminFiling
        ? 'Approved'
        : isUrgent
          ? 'Pending Final Approval'
          : (newReq.immediateSupervisor ? 'Pending Supervisor Approval' : 'Pending');

    const entry = {
      id: requestId,
      controlNo: null,
      date: toLocalISODate(new Date()),
      status: initialStatus,
      urgency,
      requestType: 'Standard Request',
      urgentPendingStandardForm: false,
      urgentDeadline: null,
      immediateSupervisor: newReq.immediateSupervisor || '',
      requesterId: currentUser?.id ?? newReq.requesterId ?? null,
      requester_id: currentUser?.id ?? newReq.requester_id ?? null,
      requesterEmail: currentUser?.email || newReq.requesterEmail || '',
      requester_email: currentUser?.email || newReq.requester_email || '',
      requestedBy: newReq.requestedBy || currentUser?.name || 'Requester',
      idNumber: currentUser?.idNumber || newReq.idNumber || '',
      requesterApproved: !isDraft,
      requesterApprovedAt: isDraft ? null : new Date().toISOString(),
      supervisorApproved: isCampusAdminFiling ? true : false,
      supervisorApprovedAt: isCampusAdminFiling ? new Date().toISOString() : null,
      supervisorRemarks: isCampusAdminFiling ? 'Self-endorsed by Campus Administrator' : '',
      adminApproved: false,
      adminApprovedAt: null,
      adminRemarks: '',
      adminFieldRemarks: null,
      campusAdminApproved: isCampusAdminFiling ? true : false,
      campusAdminApprovedAt: isCampusAdminFiling ? new Date().toISOString() : null,
      campusAdminRemarks: isCampusAdminFiling ? 'Auto-approved by Campus Administrator' : '',
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
              : 'Job Request submitted and electronically signed.'
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

    // Append to end to maintain first-come, first-served (FCFS) order
    setRequisitions(prev => [...prev.filter(r => r.id !== entry.id), entry]);
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
    const nextStatus = isApprove ? 'Under Review' : 'Returned';

    try {
      const { apiSupervisorAction } = await import('../backend/api');
      const rawId = target?.id_raw || target?.id || reqId;
      await apiSupervisorAction(rawId, { action, remarks });
    } catch (e) {
      toast(e.message || 'Could not process supervisor action.', 'error');
      return false;
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
              note: remarks || (isApprove ? 'Electronically signed' : 'Returned for revision')
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
    const target = requisitions.find(r =>
      r.id === reqId ||
      r.controlNo === reqId ||
      r.id_raw === reqId ||
      String(r.id_raw) === String(reqId) ||
      r.ticket_no === reqId ||
      r.officialTrackingNo === reqId
    );
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
  const completeStandardFormForUrgent = async (reqId, standardDetails) => {
    const target = requisitions.find(r => r.id === reqId || r.controlNo === reqId);
    if (!target) return;

    const rawId = target?.id_raw || target?.id || reqId;
    try {
      const { apiCompleteStandardForm } = await import('../backend/api');
      await apiCompleteStandardForm(rawId, {
        immediateSupervisor: standardDetails.immediateSupervisor || target.immediateSupervisor,
        description: standardDetails.description || target.description,
        scopeOfWorks: standardDetails.scopeOfWorks || target.scopeOfWorks || undefined,
        title: standardDetails.title || target.title,
        category: standardDetails.category || target.category,
        location: standardDetails.location || target.location,
        building: standardDetails.building || target.building,
        floor: standardDetails.floor || target.floor,
        room: standardDetails.room || target.room,
        contactNumber: standardDetails.contactNumber || target.contactNumber,
        photoUrl: standardDetails.photoUrl || target.photoUrl,
        photoName: standardDetails.photoName || target.photoName
      });
    } catch (e) {
      toast(e.message || 'Could not submit follow-up form.', 'error');
      return false;
    }

    const nowStr = new Date().toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    setRequisitions(prev => prev.map(r => {
      if (r.id === reqId || r.controlNo === reqId || r.ticket_no === reqId) {
        return {
          ...r,
          urgentPendingStandardForm: false,
          isStandardFormFilled: true,
          adminApproved: false,
          title: standardDetails.title || r.title,
          category: standardDetails.category || r.category,
          location: standardDetails.location || r.location,
          building: standardDetails.building || r.building,
          floor: standardDetails.floor || r.floor,
          room: standardDetails.room || r.room,
          contactNumber: standardDetails.contactNumber || r.contactNumber,
          immediateSupervisor: standardDetails.immediateSupervisor || r.immediateSupervisor,
          immediateSupervisorSignature: 'Signed',
          scopeOfWorks: standardDetails.scopeOfWorks || r.scopeOfWorks,
          description: standardDetails.description || r.description,
          photoUrl: standardDetails.photoUrl || r.photoUrl,
          photoName: standardDetails.photoName || r.photoName,
          timeline: [
            ...r.timeline,
            {
              status: 'Follow-up Form Filed',
              timestamp: nowStr,
              actor: `${r.requestedBy} (${r.requesterRole || 'Requester'})`,
              note: 'Official follow-up QF-PDAS-DC-01 form submitted. Routed to Admin for electronic approval (Supervisor and Approver notified for information only).'
            }
          ]
        };
      }
      return r;
    }));

    toast('Follow-up form submitted and routed to Admin for electronic approval.');
    refreshRequisitions();
  };

  // Electronic approval of follow-up form by PDAS Admin
  const approveFollowUpForm = async (reqId, remarks = 'Follow-up form electronically signed') => {
    const target = requisitions.find(r => r.id === reqId || r.controlNo === reqId);
    const rawId = target?.id_raw || target?.id || reqId;

    try {
      const { apiApproveFollowUpForm } = await import('../backend/api');
      await apiApproveFollowUpForm(rawId, { remarks });
    } catch (e) {
      toast(e.message || 'Could not approve follow-up form.', 'error');
      return false;
    }

    const nowStr = new Date().toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    setRequisitions(prev => prev.map(r => {
      if (r.id === reqId || r.controlNo === reqId) {
        return {
          ...r,
          adminApproved: true,
          adminApprovedAt: new Date().toISOString(),
          adminRemarks: remarks,
          isStandardFormFilled: true,
          timeline: [
            ...r.timeline,
            {
              status: 'Follow-up Form Approved',
              timestamp: nowStr,
              actor: 'PDAS Administrator',
              note: `Follow-up form electronically signed: ${remarks}`
            }
          ]
        };
      }
      return r;
    }));

    toast('Follow-up form electronically signed.');
    refreshRequisitions();
    return true;
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
    const target = requisitions.find(r =>
      r.id === reqId ||
      r.controlNo === reqId ||
      r.id_raw === reqId ||
      String(r.id_raw) === String(reqId) ||
      r.ticket_no === reqId ||
      r.officialTrackingNo === reqId
    );
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
  const updateRequisitionStatus = async (reqId, newStatus, actorName = 'Maintenance Staff', notes = '', materialsUsed = '', completionPhotoUrl = undefined) => {
    const target = requisitions.find(r => r.id === reqId || r.controlNo === reqId);
    if (!target) {
      toast(`Request ${reqId} was not found.`, 'error');
      return false;
    }
    try {
      const { apiUpdateJobRequestStatus } = await import('../backend/api');
      const res = await apiUpdateJobRequestStatus(target.id ?? reqId, {
        status: newStatus,
        remarks: notes || `Status updated to ${newStatus}.`,
        materialsUsed: materialsUsed !== undefined && materialsUsed !== null ? materialsUsed : undefined,
        completionPhotoUrl: completionPhotoUrl !== undefined && completionPhotoUrl !== null ? completionPhotoUrl : undefined,
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

  const reviseRequisition = async (reqId, revisionData) => {
    const target = requisitions.find(r => r.id === reqId || r.controlNo === reqId || r.id_raw === reqId);
    const idToUse = target?.id_raw ?? target?.id ?? reqId;
    try {
      const result = await apiReviseJobRequest(idToUse, revisionData);
      setRequisitions(prev => prev.map(r => {
        if (r.id === reqId || r.controlNo === reqId || r.id_raw === reqId) {
          return {
            ...r,
            ...revisionData,
            status: 'Pending',
            rejectionStage: null,
            rejectionRemarks: '',
            category: revisionData.category ? (revisionData.category.charAt(0).toUpperCase() + revisionData.category.slice(1)) : r.category,
            urgency: revisionData.urgency || revisionData.urgencyLevel || r.urgency,
            timeline: [
              ...(r.timeline || []),
              {
                status: 'Revised & Resubmitted',
                timestamp: new Date().toLocaleString(),
                actor: currentUser?.name || 'Requester',
                note: revisionData.revisionNotes || 'Revised by requester',
              }
            ]
          };
        }
        return r;
      }));
      await refreshRequisitions();
      toast(result?.message || 'Job request revised and resubmitted successfully.', 'success');
      return result;
    } catch (err) {
      const reason = err?.message || 'Failed to submit revision.';
      toast(reason, 'error');
      throw err;
    }
  };

  // ── Unified Outcome Flagging (Fix: Bugs 2, 3, 5)
  //
  // Previously two separate functions (raiseMaintenanceFlag + raiseReplacementFlag)
  // with three problems:
  //   1. "Cannot Complete" had no API call — state was lost on page reload.
  //   2. "Disposal" fired the optimistic UI update even when the API call failed.
  //   3. Routing split meant different code paths for identical operations.
  //
  // This single function always calls the API first for all three types, and only
  // updates local state after a successful server response. The endpoint is
  // /replacement-flag for every disposition, so the historical name is kept.
  const raiseReplacementFlag = async (reqId, flagData) => {
    const target = requisitions.find(r => r.id === reqId || r.controlNo === reqId);
    if (!target) {
      toast(`Request ${reqId} was not found.`, 'error');
      return false;
    }

    const nowStr = new Date().toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const flaggedBy = flagData.flaggedBy || 'Maintenance Personnel';
    const type = flagData.type || 'Replacement'; // 'Replacement' | 'Disposal' | 'Cannot Complete'

    // Map the UI flag type to the API disposition value
    const disposition =
      type === 'Disposal' ? 'disposal'
      : type === 'Cannot Complete' ? 'cannot_complete'
      : 'replacement';

    // Always persist to the server first — no optimistic update.
    try {
      const { apiFlagReplacement } = await import('../backend/api');
      // Use raw DB integer id so WHERE id=? works reliably.
      await apiFlagReplacement(target.id_raw ?? target.id ?? reqId, {
        reason: flagData.reason,
        itemSpecs: flagData.itemSpecs || null,
        disposition,
        flaggedBy,
        // Cannot Complete extra fields stored in request_details on the server
        scheduledWork: flagData.scheduledWork || null,
        scheduledDate: flagData.scheduledDate || null,
        scheduledTime: flagData.scheduledTime || null
      });
    } catch (err) {
      toast(`Could not flag ${target.controlNo || reqId}: ${err?.message || 'rejected by the server.'}`, 'error');
      return false;
    }

    // API succeeded — now update local state
    const isReplacement = type === 'Replacement';
    const isDisposal = type === 'Disposal';

    setRequisitions(prev =>
      prev.map(r => {
        if (r.id === reqId || r.controlNo === reqId) {
          return {
            ...r,
            // maintenanceFlag holds the full flag for WorkOrderCard display
            maintenanceFlag: {
              type,
              reason: flagData.reason,
              scheduledWork: flagData.scheduledWork || '',
              scheduledDate: flagData.scheduledDate || '',
              scheduledTime: flagData.scheduledTime || '',
              flaggedBy,
              flaggedDate: nowStr
            },
            // replacementFlag drives the ReplacementRequests list
            replacementFlag: {
              ...r.replacementFlag,
              isFlagged: isReplacement || isDisposal,
              disposition,
              reason: flagData.reason,
              itemSpecs: isReplacement ? (flagData.itemSpecs || '') : (r.replacementFlag?.itemSpecs || ''),
              flaggedBy,
              flaggedDate: nowStr,
              procurementStatus: isReplacement
                ? (r.replacementFlag?.procurementStatus || 'Pending Purchase Request (PR)')
                : null
            },
            status: type === 'Cannot Complete' ? 'On Hold' : r.status,
            timeline: [
              ...r.timeline,
              {
                status: type,
                timestamp: nowStr,
                actor: flaggedBy,
                note: type === 'Replacement'
                  ? `Irreparable item reported: ${flagData.reason}. Recommends procurement of ${flagData.itemSpecs}.`
                  : type === 'Disposal'
                  ? `Asset condemned for disposal: ${flagData.reason}.`
                  : `Cannot complete — external contractor needed: ${flagData.reason}.${
                      flagData.scheduledDate ? ` Proposed: ${flagData.scheduledWork} on ${flagData.scheduledDate} at ${flagData.scheduledTime}.` : ''
                    }`
              }
            ]
          };
        }
        return r;
      })
    );

    await refreshRequisitions();
    await fetchNotifications();
    toast(`${target.controlNo || reqId} flagged as "${type}". Notifications and printable PDF report are now available.`, 'info');
    return true;
  };

  // One endpoint serves every outcome flag, so all callers share the same
  // implementation. raiseMaintenanceFlag remains for existing WorkQueue callers.
  const raiseOutcomeFlag = (reqId, flagData) =>
    raiseReplacementFlag(reqId, flagData);
  const raiseMaintenanceFlag = (reqId, flagData) =>
    raiseReplacementFlag(reqId, flagData);

  /* Confirming the wet-ink hardcopy is the System Administrator's attestation
     that the signed QF-PDAS-DC-01 is on file. It does NOT grant final approval:
     it hands the request to the Approver, who is the only officer that may
     write 'Approved'. Sending it straight to 'Approved' skipped that level
     entirely — and the generic endpoint sets no approval flags, so nothing on
     the server noticed. */
  const confirmSignatures = async (reqId, remarks = 'Signed hardcopy received', scanUrl = '') => {
    const target = requisitions.find(r => r.id === reqId || r.controlNo === reqId);
    if (!target) {
      toast(`Request ${reqId} was not found.`, 'error');
      return false;
    }
    if (target.status !== 'Awaiting Signatures' && target.status !== 'Pending Final Approval' && target.status !== 'Under Review') {
      toast(`${target.controlNo || reqId} is "${target.status}" — there are no signatures pending on it.`, 'error');
      return false;
    }

    try {
      await apiConfirmSignedForm(target.id_raw ?? target.id ?? reqId, {
        confirmed: true,
        scanRef: scanUrl || '',
      });
      if (target.status !== 'Pending Final Approval') {
        const { apiUpdateJobRequestStatus } = await import('../backend/api');
        await apiUpdateJobRequestStatus(target.id ?? reqId, {
          status: 'Pending Final Approval',
          remarks
        });
      }
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
    const target = requisitions.find(r =>
      r.id === reqId ||
      r.controlNo === reqId ||
      r.id_raw === reqId ||
      String(r.id_raw) === String(reqId) ||
      r.ticket_no === reqId ||
      r.officialTrackingNo === reqId
    );
    if (!target) {
      toast(`Request ${reqId} was not found.`, 'error');
      return false;
    }
    const resolvedId = target.id_raw ?? target.id ?? reqId;
    try {
      const { apiArchiveJobRequest } = await import('../backend/api');
      const res = await apiArchiveJobRequest(resolvedId);
      await refreshRequisitions();
      toast(res?.message || `Request ${target.controlNo || reqId} archived.`, 'info');
      return true;
    } catch (err) {
      if (err?.status === 404 || /not found/i.test(err?.message || '')) {
        setRequisitions(prev => prev.filter(r => r.id !== (target.id ?? reqId) && r.controlNo !== (target.controlNo ?? reqId)));
        await refreshRequisitions();
      }
      toast(`Could not archive ${target.controlNo || reqId}: ${err?.message || 'rejected by the server.'}`, 'error');
      return false;
    }
  };

  const unarchiveRequisition = async (reqId) => {
    const target = requisitions.find(r =>
      r.id === reqId ||
      r.controlNo === reqId ||
      r.id_raw === reqId ||
      String(r.id_raw) === String(reqId) ||
      r.ticket_no === reqId ||
      r.officialTrackingNo === reqId
    );
    if (!target) {
      toast(`Request ${reqId} was not found.`, 'error');
      return false;
    }
    const resolvedId = target.id_raw ?? target.id ?? reqId;
    try {
      const { apiUnarchiveJobRequest } = await import('../backend/api');
      const res = await apiUnarchiveJobRequest(resolvedId);
      await refreshRequisitions();
      toast(res?.message || `Request ${target.controlNo || reqId} restored from archive.`, 'info');
      return true;
    } catch (err) {
      if (err?.status === 404 || /not found/i.test(err?.message || '')) {
        setRequisitions(prev => prev.filter(r => r.id !== (target.id ?? reqId) && r.controlNo !== (target.controlNo ?? reqId)));
        await refreshRequisitions();
      }
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
    const target = requisitions.find(r =>
      r.id === reqId ||
      r.id_raw === reqId ||
      r.controlNo === reqId ||
      r.ticket_no === reqId ||
      r.officialTrackingNo === reqId ||
      String(r.id_raw || '') === String(reqId || '') ||
      String(r.id || '') === String(reqId || '') ||
      String(r.controlNo || '') === String(reqId || '')
    );
    if (!target) {
      toast(`Request ${reqId} was not found.`, 'error');
      return null;
    }

    const isMine = Boolean(
      currentUser && (
        (target.requesterId && String(target.requesterId) === String(currentUser.id)) ||
        (target.userId && String(target.userId) === String(currentUser.id)) ||
        (target.requestedBy && currentUser.name && target.requestedBy.toLowerCase() === currentUser.name.toLowerCase()) ||
        (target.requesterEmail && currentUser.email && target.requesterEmail.toLowerCase() === currentUser.email.toLowerCase())
      )
    );
    if (!isMine) {
      toast('Only the original requester who filed this job request can submit Client Satisfaction (CSM) feedback.', 'error');
      return null;
    }

    const nowStr = new Date().toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    // Calculate fallback ISO ratings from SQD values if available
    const sqdList = [
      evalData.sqd0, evalData.sqd1, evalData.sqd2, evalData.sqd3,
      evalData.sqd4, evalData.sqd5, evalData.sqd6, evalData.sqd7, evalData.sqd8
    ].map(v => Number(v)).filter(v => !isNaN(v) && v >= 1 && v <= 5);
    const avgScore = sqdList.length > 0 ? Math.round(sqdList.reduce((a, b) => a + b, 0) / sqdList.length) : 5;

    const fs = evalData.functionalSuitability || evalData.sqd2 || avgScore;
    const us = evalData.usability || evalData.sqd3 || avgScore;
    const rel = evalData.reliability || evalData.sqd1 || avgScore;
    const pe = evalData.performanceEfficiency || evalData.sqd4 || avgScore;
    const sec = evalData.security || evalData.sqd6 || avgScore;

    const evalEntry = {
      id: `EVAL-${Date.now()}`,
      reqId: target?.ticket_no || target?.controlNo || reqId,
      controlNo: target?.controlNo || target?.ticket_no || reqId,
      category: target?.category || 'General',
      location: target?.location || 'Unknown',
      resolutionStatus: target?.status || 'Unknown',
      submittedBy: evalData.submittedBy || target?.requestedBy || 'Requester',
      submittedAt: nowStr,
      functionalSuitability: fs,
      usability: us,
      reliability: rel,
      performanceEfficiency: pe,
      security: sec,
      comments: evalData.comments || evalData.suggestions || '',
      // Official CSM Form Attributes
      consent: evalData.consent ?? 1,
      clientType: evalData.clientType || 'Government',
      sex: evalData.sex || '',
      age: evalData.age || '',
      region: evalData.region || 'Region VI - Western Visayas',
      serviceAvailed: evalData.serviceAvailed || target?.title || target?.controlNo,
      cc1: evalData.cc1 || '',
      cc2: evalData.cc2 || '',
      cc3: evalData.cc3 || '',
      sqd0: evalData.sqd0,
      sqd1: evalData.sqd1,
      sqd2: evalData.sqd2,
      sqd3: evalData.sqd3,
      sqd4: evalData.sqd4,
      sqd5: evalData.sqd5,
      sqd6: evalData.sqd6,
      sqd7: evalData.sqd7,
      sqd8: evalData.sqd8,
      suggestions: evalData.suggestions || evalData.comments || '',
      email: evalData.email || '',
      csmData: evalData.csmData || evalData
    };

    try {
      const { apiSubmitEvaluation } = await import('../backend/api');
      await apiSubmitEvaluation({
        jobRequestId: (target.id_raw || target.id) ?? reqId,
        functionalSuitability: fs,
        usability: us,
        reliability: rel,
        performanceEfficiency: pe,
        security: sec,
        comments: evalData.comments || evalData.suggestions || '',
        // CSM fields
        consent: evalData.consent ?? 1,
        clientType: evalData.clientType || 'Government',
        region: evalData.region || 'Region VI - Western Visayas',
        serviceAvailed: evalData.serviceAvailed || target?.title || target?.controlNo,
        cc1: evalData.cc1 || '',
        cc2: evalData.cc2 || '',
        cc3: evalData.cc3 || '',
        sqd0: evalData.sqd0,
        sqd1: evalData.sqd1,
        sqd2: evalData.sqd2,
        sqd3: evalData.sqd3,
        sqd4: evalData.sqd4,
        sqd5: evalData.sqd5,
        sqd6: evalData.sqd6,
        sqd7: evalData.sqd7,
        sqd8: evalData.sqd8,
        suggestions: evalData.suggestions || evalData.comments || '',
        csmData: evalEntry
      });
    } catch (err) {
      toast(`Evaluation not saved: ${err?.message || 'rejected by the server.'}`, 'error');
      return null;
    }

    setEvaluations(prev => [evalEntry, ...prev]);
    toast(`Client satisfaction feedback submitted for request ${target?.controlNo || reqId}. Thank you!`);
    return evalEntry;
  };

  const updateProcurementStatus = async (reqId, procurementStatus) => {
    const target = requisitions.find(r => r.id === reqId || r.controlNo === reqId);

    // Fix 2: use the raw numeric DB id so WHERE id=? in the backend matches correctly.
    // target.id is the display string (e.g. 'JR-2026-0001'); id_raw is the integer.
    const dbId = target ? (target.id_raw ?? target.id) : reqId;

    if (target) {
      try {
        const { apiUpdateProcurementStatus } = await import('../backend/api');
        await apiUpdateProcurementStatus(dbId, procurementStatus);
      } catch (err) {
        toast?.(`Failed to save procurement status: ${err?.message || 'Unknown error'}`, 'error');
        return;
      }
    }

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
        inChargeName: eventData.inCharge,
        description: eventData.description || null,
        recurrence: eventData.recurrence || 'Quarterly',
        reminderLead: eventData.reminderLead || '1 day before'
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

  /* Mark a schedule as completed with optional remarks and photo. */
  const completeCalendarEvent = async (event, { remarks, photoUrl, photoName } = {}) => {
    const sId = event?.serverId || (typeof event?.id === 'string' && event.id.startsWith('PMS-') ? parseInt(event.id.replace('PMS-', ''), 10) : (typeof event?.id === 'number' ? event.id : null));
    if (sId) {
      await apiCompletePreventiveSchedule(sId, { remarks, photoUrl, photoName });
    }
    setCalendarEvents(prev =>
      prev.map(ev =>
        ev.id === event?.id || (sId && ev.serverId === sId) || (sId && ev.id === `PMS-${sId}`)
          ? {
              ...ev,
              status: 'Completed',
              completedAt: new Date().toISOString(),
              completionNotes: remarks,
              completionPhoto: photoUrl,
              completionPhotoName: photoName
            }
          : ev
      )
    );
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

  /* Reschedule or reassign a preventive maintenance event. */
  const updateCalendarEvent = async (id, patch) => {
    const serverId = patch?.serverId || id;
    if (serverId && typeof serverId === 'number') {
      try {
        await apiUpdatePreventiveSchedule(serverId, patch);
      } catch {
        // Fall back to local update
      }
    }
    setCalendarEvents(prev =>
      prev.map(ev => (ev.id === id || ev.serverId === serverId ? { ...ev, ...patch } : ev))
    );
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
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages(prev =>
      prev.map(m => {
        if (m.id === threadId) {
          return {
            ...m,
            unread: false,
            preview: text,
            time: 'Just now',
            thread: [...m.thread, { sender: senderName, text, time }]
          };
        }
        return m;
      })
    );
    const target = messages.find(m => m.id === threadId);
    if (target?.backendId) {
      apiReplyMessage(target.backendId, text).catch(err => {
        console.warn('Failed to send backend message reply:', err);
      });
    }
  };

  const markThreadRead = (threadId) => {
    setMessages(prev =>
      prev.map(m => (m.id === threadId ? { ...m, unread: false } : m))
    );
    const target = messages.find(m => m.id === threadId);
    if (target?.backendId) {
      apiMarkMessageRead(target.backendId).catch(err => {
        console.warn('Failed to mark message read on backend:', err);
      });
    }
  };

  const editMessage = (threadId, msgIndex, newText) => {
    setMessages(prev =>
      prev.map(m => {
        if (m.id !== threadId) return m;
        const updatedThread = m.thread.map((msg, i) =>
          i === msgIndex ? { ...msg, text: newText, edited: true } : msg
        );
        return { ...m, thread: updatedThread, preview: msgIndex === m.thread.length - 1 ? newText : m.preview };
      })
    );
  };

  const deleteMessage = (threadId, msgIndex) => {
    setMessages(prev =>
      prev.map(m => {
        if (m.id !== threadId) return m;
        const updatedThread = m.thread.filter((_, i) => i !== msgIndex);
        const lastMsg = updatedThread[updatedThread.length - 1];
        return { ...m, thread: updatedThread, preview: lastMsg?.text || '' };
      })
    );
  };

  const createMessageThread = async ({
    subject,
    recipient,
    recipientId = null,
    controlNo = '',
    initialMessage,
    senderName = 'PDAS Director',
    unread = false,
    role = 'Participant',
    contactName = '',
    contactEmail = '',
    backendId = null
  }) => {
    let serverId = backendId;
    if (!serverId && currentUser) {
      try {
        const { apiSendMessage } = await import('../backend/api');
        const res = await apiSendMessage({
          recipientId: recipientId || null,
          subject: subject || 'Direct Message',
          body: initialMessage || ''
        });
        if (res?.id) serverId = res.id;
      } catch (err) {
        console.warn('Backend message thread creation error:', err.message);
      }
    }

    const newThread = {
      id: serverId ? `db_msg_${serverId}` : `msg_${Date.now()}`,
      backendId: serverId,
      recipientId,
      sender: recipient,
      contactName,
      contactEmail,
      role: role || 'Participant',
      controlNo: controlNo || 'GENERAL-INQ',
      subject: subject || 'General Maintenance Inquiry',
      time: 'Just now',
      unread,
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

  const sendContactInquiry = async ({ name, email, message, subject }) => {
    const cleanName = String(name || '').trim();
    const cleanEmail = String(email || '').trim();
    const cleanMessage = String(message || '').trim();
    const cleanSubject = (subject && String(subject).trim()) || `Public Inquiry: ${cleanName}`;

    let backendResult = null;
    try {
      backendResult = await apiSendContactMessage({
        name: cleanName,
        email: cleanEmail,
        message: cleanMessage,
        subject: cleanSubject
      });
    } catch (err) {
      console.warn('Backend contact delivery failed (fallback to local state):', err);
    }

    const newThread = createMessageThread({
      subject: cleanSubject,
      recipient: `${cleanName} (${cleanEmail})`,
      contactName: cleanName,
      contactEmail: cleanEmail,
      role: 'Public Visitor',
      controlNo: 'PUBLIC-CONTACT',
      initialMessage: cleanMessage,
      senderName: `${cleanName} (${cleanEmail})`,
      unread: true,
      backendId: backendResult?.id || null
    });

    return { success: true, id: backendResult?.id || newThread.id };
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
  // When a QR URL is opened (?qr=ISATU-xxx) the resolved location object is
  // parked here; useRequestIntake picks it up, opens the form pre-filled and
  // clears the slot so every subsequent filing starts blank.
  const [pendingScannedLocation, setPendingScannedLocation] = useState(null);

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
        archivedNotifications,
        unreadCount,
        fetchNotifications,
        markAllNotificationsRead,
        markNotificationRead,
        archiveNotification,
        restoreNotification,
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
        reviseRequisition,
        raiseOutcomeFlag,
        raiseMaintenanceFlag,
        raiseReplacementFlag,
        updateProcurementStatus,
        isLoadingRequisitions,
        refreshRequisitions,
        addRequisition,
        completeStandardFormForUrgent,
        approveFollowUpForm,
        updateActionTaken,
        updateFinalAction,
        archiveRequisition,
        unarchiveRequisition,
        submitEvaluation,
        addCalendarEvent,
        updateCalendarEvent,
        completeCalendarEvent,
        removeCalendarEvent,
        toggleUserStatus,
        updateUser,
        removeUser,
        requestPasswordChange,
        sendMessage,
        markThreadRead,
        editMessage,
        deleteMessage,
        createMessageThread,
        sendContactInquiry,
        refreshMessages: fetchBackendMessages,
        trackingConfig,
        updateTrackingConfig,
        formTemplateConfig,
        updateFormTemplateConfig,
        resetFormTemplateConfig,
        csmTemplateConfig,
        updateCsmTemplateConfig,
        resetCsmTemplateConfig,
        peekNextTrackingNumber,
        generateNextTrackingNumber,
        updateRequisitionTrackingNo,
        updateRequisitionForm,
        fetchRequisitionDetail,
        ticketSearch,
        setTicketSearch,
        focusedTicketRef,
        setFocusedTicketRef,
        pendingScanIntent,
        setPendingScanIntent,
        pendingScannedLocation,
        setPendingScannedLocation
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


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
  apiGetNotifications,
  apiMarkNotificationRead,
  apiMarkAllNotificationsRead,
  apiDeleteNotification,
  apiClearAllNotifications,
} from '../backend/api';

const DataContext = createContext();

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
    text: 'Dr. Elena Ramos (Faculty - College of Engineering) submitted ID for verification',
    time: '15m ago',
    unread: true,
    targetRole: 'admin'
  },
  {
    id: 'notif-init-02',
    title: '🚨 URGENT Facility Ticket (Standard Form Pending)',
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
  'Finance Management Services Office / Budget Office',
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
  'Public Information and Communications Office (PICO) / Publication Office',
  'Office of the BSIT Coordinator',
  'Office of the BSHM Coordinator',
  'Office of the BIT Coordinator',
  'Office of the BTVTED Coordinator',
  'Office of the BSE Coordinator',
  'Quality Assurance Office',
  'Medical / Dental Clinic',
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
  'BSHM',
  'BSIT',
  'BSE',
  'BindTech',
  'BVTED (Major in CHS)',
  'BTVTED (Major in FSM)'
];

// QF-PDAS-DC-01 Tracking Number sequence (QF-PDAS-DC-01).
// Tracking numbers are ONLY issued on Final Approver approval.
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
  // CEA
  { id: 'loc-1', building: 'College of Engineering & Architecture (CEA)', bldgShort: 'CEA', floor: 'Ground Floor', room: 'CEA 101 Lecture Room', qrCodeRef: 'ISATU-CEA-G-101' },
  { id: 'loc-2', building: 'College of Engineering & Architecture (CEA)', bldgShort: 'CEA', floor: 'Ground Floor', room: 'Civil Engineering Lab', qrCodeRef: 'ISATU-CEA-G-CIVIL' },
  { id: 'loc-3', building: 'College of Engineering & Architecture (CEA)', bldgShort: 'CEA', floor: 'Ground Floor', room: 'Material Testing Room', qrCodeRef: 'ISATU-CEA-G-MTR' },
  { id: 'loc-4', building: 'College of Engineering & Architecture (CEA)', bldgShort: 'CEA', floor: 'Ground Floor', room: 'Faculty Lounge', qrCodeRef: 'ISATU-CEA-G-LOUNGE' },
  { id: 'loc-5', building: 'College of Engineering & Architecture (CEA)', bldgShort: 'CEA', floor: '2nd Floor', room: 'CEA 201 Drafting Hall', qrCodeRef: 'ISATU-CEA-2-201' },
  { id: 'loc-6', building: 'College of Engineering & Architecture (CEA)', bldgShort: 'CEA', floor: '2nd Floor', room: 'CEA 204 Electronics Lecture', qrCodeRef: 'ISATU-CEA-2-204' },
  { id: 'loc-7', building: 'College of Engineering & Architecture (CEA)', bldgShort: 'CEA', floor: '2nd Floor', room: 'Dean Office', qrCodeRef: 'ISATU-CEA-2-DEAN' },
  { id: 'loc-8', building: 'College of Engineering & Architecture (CEA)', bldgShort: 'CEA', floor: '3rd Floor', room: 'Room 302 (Electronics & Circuits Lab)', qrCodeRef: 'ISATU-DUM-CEA-302' },
  { id: 'loc-9', building: 'College of Engineering & Architecture (CEA)', bldgShort: 'CEA', floor: '3rd Floor', room: 'Computer Engineering Lab', qrCodeRef: 'ISATU-CEA-3-CPELAB' },
  { id: 'loc-10', building: 'College of Engineering & Architecture (CEA)', bldgShort: 'CEA', floor: '3rd Floor', room: 'CEA 305 Lecture Room', qrCodeRef: 'ISATU-CEA-3-305' },

  // Admin Hall
  { id: 'loc-11', building: 'Administration Hall', bldgShort: 'Admin', floor: 'Ground Floor', room: 'Server Room & MIS Data Center', qrCodeRef: 'ISATU-DUM-ADMIN-SERVER' },
  { id: 'loc-12', building: 'Administration Hall', bldgShort: 'Admin', floor: 'Ground Floor', room: 'Admissions & Registrar Office', qrCodeRef: 'ISATU-ADM-G-REG' },
  { id: 'loc-13', building: 'Administration Hall', bldgShort: 'Admin', floor: 'Ground Floor', room: 'Cashier & Accounting', qrCodeRef: 'ISATU-ADM-G-CASH' },
  { id: 'loc-14', building: 'Administration Hall', bldgShort: 'Admin', floor: '2nd Floor', room: 'Executive Boardroom & Director Office', qrCodeRef: 'ISATU-DUM-ADMIN-201' },
  { id: 'loc-15', building: 'Administration Hall', bldgShort: 'Admin', floor: '2nd Floor', room: 'PDAS Central Office', qrCodeRef: 'ISATU-ADM-2-PDAS' },
  { id: 'loc-16', building: 'Administration Hall', bldgShort: 'Admin', floor: '2nd Floor', room: 'Faculty Conference Room', qrCodeRef: 'ISATU-ADM-2-CONF' },

  // Library
  { id: 'loc-17', building: 'University Library Services', bldgShort: 'Library', floor: '1st Floor', room: 'Circulation Desk', qrCodeRef: 'ISATU-LIB-1-CIRC' },
  { id: 'loc-18', building: 'University Library Services', bldgShort: 'Library', floor: '1st Floor', room: 'General Reference Section', qrCodeRef: 'ISATU-LIB-1-REF' },
  { id: 'loc-19', building: 'University Library Services', bldgShort: 'Library', floor: '1st Floor', room: 'E-Library & Multimedia Room', qrCodeRef: 'ISATU-LIB-1-ELIB' },
  { id: 'loc-20', building: 'University Library Services', bldgShort: 'Library', floor: '2nd Floor', room: 'Faculty & Student Reading Wing Restroom', qrCodeRef: 'ISATU-DUM-LIB-201' },
  { id: 'loc-21', building: 'University Library Services', bldgShort: 'Library', floor: '2nd Floor', room: 'Graduate Theses Archive', qrCodeRef: 'ISATU-LIB-2-ARCH' },

  // Workshops
  { id: 'loc-22', building: 'Industrial Technology & Workshops', bldgShort: 'Workshops', floor: 'Ground Floor', room: 'Tech Lab 105 (Woodworking & Drafting)', qrCodeRef: 'ISATU-DUM-LAB-105' },
  { id: 'loc-23', building: 'Industrial Technology & Workshops', bldgShort: 'Workshops', floor: 'Ground Floor', room: 'Machine Shop & Welding Area', qrCodeRef: 'ISATU-TECH-G-WELD' },
  { id: 'loc-24', building: 'Industrial Technology & Workshops', bldgShort: 'Workshops', floor: 'Ground Floor', room: 'Automotive Lab', qrCodeRef: 'ISATU-TECH-G-AUTO' },
  { id: 'loc-25', building: 'Industrial Technology & Workshops', bldgShort: 'Workshops', floor: 'Ground Floor', room: 'Tool Custodian Room', qrCodeRef: 'ISATU-TECH-G-TOOL' },

  // CAS
  { id: 'loc-26', building: 'College of Arts & Sciences (CAS)', bldgShort: 'CAS', floor: '1st Floor', room: 'Room 101 (Chemistry & Biology Laboratory)', qrCodeRef: 'ISATU-DUM-CAS-101' },
  { id: 'loc-27', building: 'College of Arts & Sciences (CAS)', bldgShort: 'CAS', floor: '1st Floor', room: 'CAS 102 Lecture Room', qrCodeRef: 'ISATU-CAS-1-102' },
  { id: 'loc-28', building: 'College of Arts & Sciences (CAS)', bldgShort: 'CAS', floor: '2nd Floor', room: 'CAS 201 Speech Lab', qrCodeRef: 'ISATU-CAS-2-SPEECH' },
  { id: 'loc-29', building: 'College of Arts & Sciences (CAS)', bldgShort: 'CAS', floor: '2nd Floor', room: 'CAS 203 Multi-Purpose Room', qrCodeRef: 'ISATU-CAS-2-203' },

  // Gymnasium
  { id: 'loc-30', building: 'University Gymnasium & Athletic Center', bldgShort: 'Gym', floor: 'Main Court', room: 'Bleachers & Main Scoreboard Electrical Box', qrCodeRef: 'ISATU-DUM-GYM-01' },
  { id: 'loc-31', building: 'University Gymnasium & Athletic Center', bldgShort: 'Gym', floor: 'Main Court', room: 'PE Faculty Room', qrCodeRef: 'ISATU-GYM-PE-FAC' },
  { id: 'loc-32', building: 'University Gymnasium & Athletic Center', bldgShort: 'Gym', floor: 'Main Court', room: 'Equipment Storage Room', qrCodeRef: 'ISATU-GYM-STORAGE' }
];

// Authentic ISAT U Dumangas Campus Requisitions
const INITIAL_REQUISITIONS = [
  {
    id: 'REQ-2026-001',
    controlNo: 'REQ-2026-001',
    building: 'College of Engineering & Architecture (CEA)',
    floor: '3rd Floor',
    room: 'Room 302 (Electronics Lab)',
    location: 'CEA Building - Room 302',
    qrCodeRef: 'ISATU-DUM-CEA-302',
    category: 'Electrical',
    urgency: 'High',
    status: 'Pending',
    date: '2026-09-02',
    title: 'Ceiling Fan & Outlet Sparks Repair',
    description: 'Wall outlet sparked when connecting projector. Ceiling fan 2 is vibrating excessively and needs urgent wiring check before next lab lecture.',
    requestedBy: 'Dr. Elena Ramos',
    requesterEmail: 'elena.ramos.isatu@gmail.com',
    requesterRole: 'Faculty',
    department: 'College of Engineering & Architecture',
    contactNumber: '+63 918 333 4455',
    idNumber: 'ISATU-FAC-2019-042',
    photoUrl: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=500&auto=format&fit=crop&q=60',
    assignedTo: null,
    assignedTechId: null,
    notes: 'Awaiting Director review for safety inspection clearance.',
    replacementFlag: {
      isFlagged: false,
      reason: '',
      itemSpecs: '',
      flaggedBy: '',
      flaggedDate: '',
      procurementStatus: 'None'
    },
    isArchived: false,
    archivedAt: null,
    timeline: [
      { status: 'Submitted', timestamp: '2026-09-02 08:30 AM', actor: 'Dr. Elena Ramos (Faculty)', note: 'Request submitted via QR code scan.' }
    ]
  },
  {
    id: 'REQ-2026-002',
    controlNo: 'REQ-2026-002',
    building: 'Administration Hall',
    floor: 'Ground Floor',
    room: 'Server Room & MIS Data Center',
    location: 'Admin Hall - Server Room',
    qrCodeRef: 'ISATU-DUM-ADMIN-SERVER',
    category: 'Air Conditioning',
    urgency: 'Urgent',
    status: 'Ongoing',
    date: '2026-09-01',
    title: 'Precision AC Unit Thermal Alert',
    description: 'Server room cooling inverter unit showing error code E-4 (compressor overheating). Server room temperature currently at 28.5°C.',
    requestedBy: 'Engr. Carlos Mendoza',
    requesterEmail: 'carlos.mendoza.mis@dumangas.isatu.edu.ph',
    requesterRole: 'Staff',
    department: 'Management Information System (MIS)',
    contactNumber: '+63 917 555 1234',
    idNumber: 'ISATU-STF-2020-019',
    photoUrl: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=500&auto=format&fit=crop&q=60',
    assignedTo: 'Mark Villanueva (Senior Electrical & HVAC)',
    assignedTechId: 'usr_tech_01',
    notes: 'Urgent clearance authorized by Director. Technician on-site checking compressor and coil.',
    replacementFlag: {
      isFlagged: true,
      reason: 'Inverter Compressor burnt out and irrecoverable after 7 years of 24/7 server room operation.',
      itemSpecs: '3.0 HP Inverter Precision Cooling Compressor Unit (R410A compliant)',
      flaggedBy: 'Mark Villanueva (Lead Technician)',
      flaggedDate: '2026-09-01 02:15 PM',
      procurementStatus: 'Pending Purchase Request (PR)'
    },
    isArchived: false,
    archivedAt: null,
    timeline: [
      { status: 'Submitted', timestamp: '2026-09-01 09:15 AM', actor: 'Engr. Carlos Mendoza (MIS)', note: 'Urgent ticket filed.' },
      { status: 'Approved', timestamp: '2026-09-01 09:30 AM', actor: 'Engr. Reynaldo Bautista (Director)', note: 'Immediate urgent dispatch.' },
      { status: 'Ongoing', timestamp: '2026-09-01 10:00 AM', actor: 'Mark Villanueva (Technician)', note: 'Technician on-site evaluating thermal overload.' },
      { status: 'Replacement Flagged', timestamp: '2026-09-01 02:15 PM', actor: 'Mark Villanueva (Technician)', note: 'Assessed as irreparable. PR request submitted.' }
    ]
  },
  {
    id: 'REQ-2026-003',
    controlNo: 'REQ-2026-003',
    building: 'University Library Services',
    floor: '2nd Floor',
    room: 'Faculty & Student Reading Wing Restroom',
    location: 'Campus Library - 2nd Floor Restroom',
    qrCodeRef: 'ISATU-DUM-LIB-201',
    category: 'Water/Sanitary',
    urgency: 'Medium',
    status: 'Approved',
    date: '2026-08-30',
    title: 'Flush Valve Leak & Water Pipe Pressure',
    description: 'Continuous water leakage in cubicle 3 flush valve causing low water pressure on 2nd floor library amenities.',
    requestedBy: 'Ms. Susan Alcantara',
    requesterEmail: 'susan.alcantara@dumangas.isatu.edu.ph',
    requesterRole: 'Staff',
    department: 'University Library Services',
    contactNumber: '+63 920 111 8899',
    idNumber: 'ISATU-STF-2017-088',
    photoUrl: null,
    assignedTo: 'Ronaldo Dela Cruz (Plumbing Specialist)',
    assignedTechId: 'usr_tech_02',
    notes: 'Approved by PDAS Director. Work order dispatched.',
    replacementFlag: {
      isFlagged: false,
      reason: '',
      itemSpecs: '',
      flaggedBy: '',
      flaggedDate: '',
      procurementStatus: 'None'
    },
    isArchived: false,
    archivedAt: null,
    timeline: [
      { status: 'Submitted', timestamp: '2026-08-30 01:10 PM', actor: 'Ms. Susan Alcantara (Staff)', note: 'Filed via web portal.' },
      { status: 'Approved', timestamp: '2026-08-30 02:15 PM', actor: 'PDAS Director', note: 'Approved for replacement of brass valve.' }
    ]
  },
  {
    id: 'REQ-2026-004',
    controlNo: 'REQ-2026-004',
    building: 'Industrial Technology & Workshops',
    floor: 'Ground Floor',
    room: 'Tech Lab 105 (Woodworking & Drafting)',
    location: 'Tech Lab 105 - Woodworking',
    qrCodeRef: 'ISATU-DUM-LAB-105',
    category: 'Physical Structures',
    urgency: 'Low',
    status: 'Completed',
    date: '2026-08-28',
    title: 'Workstation Table Reinforcement',
    description: 'Fabrication of heavy-duty metal brackets and tabletop support for 4 draft tables in Room 105.',
    requestedBy: 'Glenda Montenegro',
    requesterEmail: 'glenda.montenegro.staff@gmail.com',
    requesterRole: 'Staff',
    department: 'Industrial Technology & Workshops',
    contactNumber: '+63 927 888 9900',
    idNumber: 'ISATU-STF-2021-118',
    photoUrl: null,
    assignedTo: 'Arthur Pendelton (Master Carpenter)',
    assignedTechId: 'usr_tech_03',
    notes: 'Completed, inspected, and verified by PDAS safety officer.',
    replacementFlag: {
      isFlagged: false,
      reason: '',
      itemSpecs: '',
      flaggedBy: '',
      flaggedDate: '',
      procurementStatus: 'None'
    },
    isArchived: false,
    archivedAt: null,
    timeline: [
      { status: 'Submitted', timestamp: '2026-08-28 09:00 AM', actor: 'Glenda Montenegro (Staff)', note: 'Request submitted.' },
      { status: 'Approved', timestamp: '2026-08-28 11:00 AM', actor: 'PDAS Director', note: 'Work order authorized.' },
      { status: 'Ongoing', timestamp: '2026-08-28 01:30 PM', actor: 'Arthur Pendelton (Technician)', note: 'Fabrication ongoing in workshop.' },
      { status: 'Completed', timestamp: '2026-08-29 04:00 PM', actor: 'Arthur Pendelton (Technician)', note: 'Table brackets reinforced and safety cleared.' }
    ]
  }
];

const INITIAL_APPROVAL_HISTORY = [
  {
    id: 'APV-891',
    controlNo: 'REQ-2026-003',
    action: 'Approved',
    actionBy: 'PDAS Director (Engr. Reynaldo Bautista)',
    timestamp: '2026-08-30 02:15 PM',
    remarks: 'Approved for immediate procurement of heavy-duty brass valve.',
  },
  {
    id: 'APV-890',
    controlNo: 'REQ-2026-002',
    action: 'Approved',
    actionBy: 'PDAS Director (Engr. Reynaldo Bautista)',
    timestamp: '2026-09-01 09:30 AM',
    remarks: 'Urgent clearance issued. Assigned lead HVAC specialist.',
  },
  {
    id: 'APV-889',
    controlNo: 'REQ-2026-004',
    action: 'Approved',
    actionBy: 'PDAS Director (Engr. Reynaldo Bautista)',
    timestamp: '2026-08-28 11:00 AM',
    remarks: 'Standard fabrication job order authorized.',
  }
];

const INITIAL_CALENDAR_EVENTS = [
  {
    id: 'CAL-01',
    title: 'Campus Generator Load & Fuel Testing',
    category: 'Electrical',
    date: '2026-09-08',
    time: '08:00 AM - 12:00 PM',
    location: 'Main Power Substation / GenSet Shed',
    inCharge: 'Engr. J. Santos',
    status: 'Scheduled'
  },
  {
    id: 'CAL-02',
    title: 'Quarterly Aircon Preventive Maintenance',
    category: 'HVAC / Aircon',
    date: '2026-09-12',
    time: '09:00 AM - 05:00 PM',
    location: 'All Academic Buildings (CEA & CAS)',
    inCharge: 'Mark Villanueva (Lead Technician)',
    status: 'Scheduled'
  },
  {
    id: 'CAL-03',
    title: 'Fire Extinguisher & Safety Valve Inspection',
    category: 'Safety & Compliance',
    date: '2026-09-18',
    time: '01:00 PM - 04:00 PM',
    location: 'All Laboratories & Library',
    inCharge: 'PDAS Safety Committee',
    status: 'Scheduled'
  }
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

export const DataProvider = ({ children }) => {
  const { currentUser, isAdmin, isMaintenance, isFacultyOrStaff } = useAuth();
  const { toast } = useToast();
  const [offices, setOffices] = useState(() => JSON.parse(localStorage.getItem('fixit_pdas_offices_v4') || JSON.stringify(INITIAL_OFFICES)));
  const [departments, setDepartments] = useState(() => JSON.parse(localStorage.getItem('fixit_pdas_departments_v4') || JSON.stringify(INITIAL_DEPARTMENTS)));
  // requisitions are fetched from the MySQL backend on login.
  // INITIAL_REQUISITIONS is only used if the backend is unreachable (offline mode).
  const [requisitions, setRequisitions] = useState([]);
  const [isLoadingRequisitions, setIsLoadingRequisitions] = useState(false);

  const [approvalHistory, setApprovalHistory] = useState(() => {
    const saved = localStorage.getItem('fixit_pdas_approvals_v3');
    return saved ? JSON.parse(saved) : INITIAL_APPROVAL_HISTORY;
  });

  const [calendarEvents, setCalendarEvents] = useState(() => {
    const saved = localStorage.getItem('fixit_pdas_calendar_v3');
    return saved ? JSON.parse(saved) : INITIAL_CALENDAR_EVENTS;
  });

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

  // ── Live Requisitions from MySQL ──────────────────────────────────────────
  const refreshRequisitions = React.useCallback(async () => {
    if (!currentUser) return;
    setIsLoadingRequisitions(true);
    try {
      const { apiGetJobRequests } = await import('../backend/api');
      const rows = await apiGetJobRequests({ limit: 200 });
      if (Array.isArray(rows) && rows.length > 0) {
        // Normalize DB shape to the shape the UI expects
        const normalized = rows.map(r => ({
          ...r,
          id_raw: r.id,
          id: r.ticket_no || r.id,
          ticket_no: r.ticket_no,
          controlNo: r.official_tracking_no || r.ticket_no || r.id,
          officialTrackingNo: r.official_tracking_no || '',
          date: (r.created_at || '').slice(0, 10),
          category: r.category ? (r.category.charAt(0).toUpperCase() + r.category.slice(1)) : 'Other',
          urgency: r.urgency_level || 'Medium Risk',
          status: r.status || 'Pending',
          location: [r.building, r.floor, r.room].filter(Boolean).join(' - ') || r.location || '',
          requestedBy: r.requester_name || r.requestedBy || '',
          department: r.requester_dept || r.department || '',
          assignedTo: r.assignee_name || r.assignedTo || null,
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
      } else if (rows.length === 0) {
        setRequisitions([]);
      }
    } catch {
      // Backend offline — keep existing state (seed data or last fetch)
    } finally {
      setIsLoadingRequisitions(false);
    }
  }, [currentUser]);

  useEffect(() => {
    refreshRequisitions();
  }, [refreshRequisitions]);

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
      const today = new Date().toISOString().slice(0, 10);
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
          title: '📅 Preventive Maintenance Today',
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

  const [evaluations, setEvaluations] = useState(() => {
    const saved = localStorage.getItem('fixit_pdas_evaluations_v3');
    return saved ? JSON.parse(saved) : [];
  });

  // QF-PDAS-DC-01 Tracking Number sequence config (admin-editable).
  const [trackingConfig, setTrackingConfig] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('fixit_pdas_tracking_config_v1') || 'null');
      if (saved && typeof saved === 'object') return { ...DEFAULT_TRACKING_CONFIG, ...saved };
    } catch {}
    return { ...DEFAULT_TRACKING_CONFIG };
  });

  const [campusLocations, setCampusLocations] = useState(() => {
    const saved = localStorage.getItem('fixit_pdas_campus_locations_v3');
    return saved ? JSON.parse(saved) : INITIAL_CAMPUS_LOCATIONS;
  });

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem('fixit_pdas_campus_locations_v3', JSON.stringify(campusLocations));
  }, [campusLocations]);

  useEffect(() => {
    localStorage.setItem('fixit_pdas_offices_v4', JSON.stringify(offices));
  }, [offices]);

  useEffect(() => {
    localStorage.setItem('fixit_pdas_departments_v4', JSON.stringify(departments));
  }, [departments]);

  // Requisitions are stored in MySQL — no localStorage sync needed.

  useEffect(() => {
    localStorage.setItem('fixit_pdas_approvals_v3', JSON.stringify(approvalHistory));
  }, [approvalHistory]);

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
  // NOTE: the ID-photo upload (idFile/idPreviewUrl) isn't sent to the
  // backend yet — there's no documents endpoint wired for registrations.
  // The account itself registers fine; ID verification is still visual/manual
  // for now (a follow-up item, same as job-request document uploads).
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
    pdasHeadName: 'KRISTINE J. AMAR',
    pdasHeadTitle: 'Head, PDAS / Director, Planning Development and Auxiliary Services'
  });

  // Default QF-PDAS-DC-01 Final Action Template
  const createDefaultFinalAction = () => ({
    status: 'Pending',
    remarks: '',
    campusAdminName: 'RAMIL G. LUMAUAG, Ed.D., DIT',
    campusAdminTitle: 'Campus Administrator',
    copyDistribution: '1 – PDAS, 1 – GSM, 1 – Client'
  });

  // Requisitions Workflow & Priority Routing
  const addRequisition = (newReq) => {
    const nowStr = new Date().toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const requestId = `REQ-${Date.now()}`;
    const isUrgent = newReq.requestType === 'Urgent Request' || newReq.urgency === 'High Risk' || newReq.urgency === 'Urgent';
    const urgency = newReq.urgency || (isUrgent ? 'High Risk' : 'Medium Risk');
    
    const entry = {
      id: requestId,
      controlNo: null,
      date: new Date().toISOString().split('T')[0],
      status: 'Pending',
      urgency,
      requestType: newReq.requestType || (isUrgent ? 'Urgent Request' : 'Standard Request'),
      urgentPendingStandardForm: isUrgent && !newReq.isStandardFormFilled,
      urgentDeadline: isUrgent ? 'Within Today (24 Hours)' : null,
      immediateSupervisor: newReq.immediateSupervisor || '',
      immediateSupervisorSignature: newReq.immediateSupervisor ? 'Signed' : 'Pending',
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
          status: 'Submitted',
          timestamp: nowStr,
          actor: `${newReq.requestedBy} (${newReq.requesterRole || 'Requester'})`,
          note: isUrgent && !newReq.isStandardFormFilled 
            ? 'Urgent Job Request submitted. Requester required to complete full Standard QF-PDAS-DC-01 Form within the day.'
            : 'Standard Job Request (QF-PDAS-DC-01) submitted to PDAS central queue.'
        }
      ],
      ...newReq
    };

    setRequisitions(prev => [entry, ...prev]);
    // Sync with backend so DB ticket_no replaces the temp local ID
    setTimeout(() => refreshRequisitions(), 1500);
    toast(`Request ${requestId} submitted and queued for PDAS review.`);

    setNotifications(prev => [
      {
        id: `notif-${Date.now()}`,
        title: isUrgent ? 'URGENT Facility Ticket (Standard Form Pending)' : 'New Facility Request (QF-PDAS-DC-01)',
        text: `${requestId} (${entry.category} - ${entry.location}) filed by ${entry.requestedBy}`,
        time: 'Just now',
        unread: true,
        targetRole: 'admin'
      },
      ...(isUrgent && !newReq.isStandardFormFilled ? [{
        id: `notif-urgent-remind-${Date.now()}`,
        title: 'Urgent Filing Requirement',
        text: `Please complete the full Standard QF-PDAS-DC-01 Form for ${requestId} within the day.`,
        time: 'Just now',
        unread: true,
        targetRole: 'faculty_staff',
        recipientUserId: currentUser?.id
      }] : []),
      ...prev
    ]);

    return entry;
  };

  const reviewRequisition = (reqId, remarks = 'Ticket placed under PDAS review') => {
    const target = requisitions.find(r => r.id === reqId || r.controlNo === reqId);
    if (!target || target.status !== 'Pending') return;

    const nowStr = new Date().toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    setRequisitions(prev => prev.map(r => r.id === reqId || r.controlNo === reqId ? {
      ...r,
      status: 'Under Review',
      notes: remarks,
      timeline: [...r.timeline, { status: 'Under Review', timestamp: nowStr, actor: 'PDAS Director', note: remarks }]
    } : r));
    setNotifications(prev => [{
      id: `notif-${Date.now()}`,
      title: 'Ticket Under Review',
      text: `${target.id} is now under PDAS review.`,
      time: 'Just now',
      unread: true,
      targetRole: 'faculty_staff'
    }, ...prev]);
    toast(`Request ${target.controlNo || target.id} placed under review.`, 'info');
  };

  const approveRequisition = (reqId, remarks = 'Approved by PDAS Director', technicianName = '') => {
    const target = requisitions.find(r => r.id === reqId || r.controlNo === reqId);
    if (!target || !['Pending', 'Under Review'].includes(target.status)) return;

    const nowStr = new Date().toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    // NOTE: tracking number (controlNo) is NOT issued here.
    // It is issued ONLY on Final Approver approval (see updateFinalAction).
    const refNo = target.controlNo || target.id;
    const isDispatched = Boolean(technicianName);
    const nextStatus = isDispatched ? 'Ongoing' : 'Awaiting Signatures';

    setRequisitions(prev =>
      prev.map(r => {
        if (r.id === reqId || r.controlNo === reqId) {
          return {
            ...r,
            status: nextStatus,
            ...(isDispatched ? { assignedTo: technicianName } : {}),
            notes: remarks,
            timeline: [
              ...r.timeline,
              {
                status: nextStatus,
                timestamp: nowStr,
                actor: 'PDAS Director (Engr. Reynaldo Bautista)',
                note: isDispatched
                  ? `${remarks} — Dispatched to ${technicianName}.`
                  : remarks + ' — Awaiting wet-ink signatures on printed QF-PDAS-DC-01 form.'
              }
            ]
          };
        }
        return r;
      })
    );

    const newLog = {
      id: `APV-${Math.floor(100 + Math.random() * 900)}`,
      controlNo: refNo,
      action: 'Accepted — Awaiting Signatures',
      actionBy: 'PDAS Director (Engr. Reynaldo Bautista)',
      timestamp: nowStr,
      remarks,
    };

    setApprovalHistory(prev => [newLog, ...prev]);

    setNotifications(prev => [
      {
        id: `notif-${Date.now()}`,
        title: isDispatched ? 'Request Approved and Dispatched' : 'Request Accepted — Awaiting Signatures',
        text: isDispatched
          ? `${refNo} dispatched to ${technicianName}.`
          : `${refNo} accepted. Print QF-PDAS-DC-01 and collect wet-ink signatures.`,
        time: 'Just now',
        unread: true,
        targetRoles: isDispatched ? ['faculty_staff', 'maintenance'] : ['faculty_staff']
      },
      ...prev
    ]);
    toast(isDispatched ? `Request ${refNo} approved and dispatched to ${technicianName}.` : `Request ${refNo} accepted — awaiting signed form.`);
    return true;
  };

  const rejectRequisition = (reqId, remarks = 'Disapproved due to scope or safety restrictions') => {
    const target = requisitions.find(r => r.id === reqId || r.controlNo === reqId);
    if (!target) return;

    const nowStr = new Date().toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    setRequisitions(prev =>
      prev.map(r => {
        if (r.id === reqId || r.controlNo === reqId) {
          return {
            ...r,
            status: 'Rejected',
            notes: remarks,
            timeline: [
              ...r.timeline,
              { status: 'Rejected', timestamp: nowStr, actor: 'PDAS Director', note: remarks }
            ]
          };
        }
        return r;
      })
    );

    const newLog = {
      id: `APV-${Math.floor(100 + Math.random() * 900)}`,
      controlNo: target.controlNo,
      action: 'Rejected',
      actionBy: 'PDAS Director',
      timestamp: nowStr,
      remarks,
    };

    setApprovalHistory(prev => [newLog, ...prev]);
    toast(`Request ${target.controlNo || target.id} disapproved.`, 'info');
  };

  const assignTechnician = (reqId, technicianName, techId = null) => {
    const target = requisitions.find(r => r.id === reqId || r.controlNo === reqId);
    if (!target || target.status !== 'Approved' || !technicianName) return false;
    const nowStr = new Date().toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    setRequisitions(prev =>
      prev.map(r => {
        if (r.id === reqId || r.controlNo === reqId) {
          return {
            ...r,
            assignedTo: technicianName,
            assignedTechId: techId,
            status: 'Ongoing',
            timeline: [
              ...r.timeline,
              { status: 'Ongoing', timestamp: nowStr, actor: 'PDAS Dispatch', note: `Assigned to ${technicianName}. Dispatched on-site.` }
            ]
          };
        }
        return r;
      })
    );

    setNotifications(prev => [
      {
        id: `notif-${Date.now()}`,
        title: 'Task Assigned to Technician',
        text: `${reqId} dispatched to ${technicianName}`,
        time: 'Just now',
        unread: true,
        targetRoles: ['maintenance', 'faculty_staff']
      },
      ...prev
    ]);
    toast(`Request ${reqId} assigned to ${technicianName} and ongoing.`);
    return true;
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
              actor: 'KRISTINE J. AMAR (Head, PDAS)',
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
  const updateFinalAction = (reqId, finalStatus, remarks = '') => {
    const target = requisitions.find(r => r.id === reqId || r.controlNo === reqId);
    if (!target) return null;

    const nowStr = new Date().toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const isApproved = finalStatus === 'Approved';

    // Tracking number is issued ONLY here on Final Approver approval.
    let issuedTrackingNo = target.controlNo || null;
    if (isApproved && !issuedTrackingNo) {
      issuedTrackingNo = generateNextTrackingNumber();
    }

    setRequisitions(prev => prev.map(r => {
      if (r.id === reqId || r.controlNo === reqId) {
        return {
          ...r,
          ...(issuedTrackingNo ? { controlNo: issuedTrackingNo } : {}),
          status: isApproved ? (r.assignedTo ? 'Ongoing' : 'Approved') : 'Rejected',
          finalAction: {
            ...r.finalAction,
            status: finalStatus,
            remarks: remarks || r.finalAction?.remarks || ''
          },
          timeline: [
            ...r.timeline,
            {
              status: `Final Action: ${finalStatus}`,
              timestamp: nowStr,
              actor: 'Final Approver',
              note: isApproved
                ? `Final Action set to Approved. Tracking ${issuedTrackingNo || '(range exhausted — set in Settings → Tracking Numbers)'} issued. Remarks: ${remarks || 'None'}`
                : `Final Action set to ${finalStatus}. Remarks: ${remarks || 'None'}`
            }
          ]
        };
      }
      return r;
    }));

    setNotifications(prev => [
      {
        id: `notif-${Date.now()}`,
        title: isApproved ? 'Job Request Approved (Final Action)' : 'Job Request Disapproved',
        text: isApproved
          ? `Approver approved ticket ${issuedTrackingNo || target.id}. ${remarks ? 'Remarks: ' + remarks : ''}`
          : `Approver ${finalStatus.toLowerCase()} ticket ${target.controlNo || target.id}. ${remarks ? 'Remarks: ' + remarks : ''}`,
        time: 'Just now',
        unread: true,
        targetRoles: ['faculty_staff', 'maintenance']
      },
      ...prev
    ]);
    return issuedTrackingNo;
  };

  const updateRequisitionStatus = (reqId, newStatus, actorName = 'Maintenance Staff', notes = '') => {
    const target = requisitions.find(r => r.id === reqId || r.controlNo === reqId);
    // Forward-only guard: nothing returns to Pending, Rejected goes through the
    // reject flow, and Completed records are locked (mirrors the server policy).
    // Returns false when blocked so callers never report a false success.
    if (!target || target.status === 'Completed' || newStatus === 'Pending' || newStatus === 'Rejected') return false;
    if (!target || newStatus === 'Approved' || (target.status === 'Pending' && newStatus !== 'Under Review' && newStatus !== 'Ongoing' && newStatus !== 'On Hold') || (newStatus === 'Ongoing' && target.status === 'Completed') || (newStatus === 'In Progress' && (target.status !== 'Approved' || !target.assignedTo))) return false;
    const nowStr = new Date().toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    setRequisitions(prev =>
      prev.map(r => {
        if (r.id === reqId || r.controlNo === reqId) {
          return {
            ...r,
            status: newStatus,
            timeline: [
              ...r.timeline,
              { status: newStatus, timestamp: nowStr, actor: actorName, note: notes || `Status updated to ${newStatus}.` }
            ]
          };
        }
        return r;
      })
    );

    // When a ticket is marked Completed, push evaluation notification to the requisitioner
    if (newStatus === 'Completed' && target) {
      setNotifications(prev => [
        {
          id: `notif-${Date.now()}-eval`,
          title: 'Service Evaluation Available',
          text: `${target.controlNo} has been completed. Please submit your service quality evaluation.`,
          time: 'Just now',
          unread: true,
          targetRole: 'faculty_staff'
        },
        ...prev
      ]);
    }

    setNotifications(prev => [
      {
        id: `notif-${Date.now()}`,
        title: `Ticket Status: ${newStatus}`,
        text: `${reqId} updated to "${newStatus}" by ${actorName}${target?.requestedBy ? ` for ${target.requestedBy}` : ''}`,
        time: 'Just now',
        unread: true,
        targetRoles: ['faculty_staff', 'maintenance', 'admin']
      },
      ...prev
    ]);
    toast(`Request ${target?.controlNo || reqId} updated to ${newStatus}.`);
    return true;
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
  const raiseReplacementFlag = (reqId, flagData) => {
    const nowStr = new Date().toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

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

    setNotifications(prev => [
      {
        id: `notif-${Date.now()}`,
        title: '⚠️ Irreparable Item Flagged for Replacement',
        text: `${target?.controlNo || reqId}: Irreparable item reported. Recommends procurement of ${flagData.itemSpecs}.`,
        time: 'Just now',
        unread: true,
        targetRole: 'admin'
      },
      ...prev
    ]);
  };

  // Confirm Physical Signatures — advances from 'Awaiting Signatures' to 'Approved'
  const confirmSignatures = (reqId, remarks = 'Signed hardcopy received', scanUrl = '') => {
    const target = requisitions.find(r => r.id === reqId || r.controlNo === reqId);
    if (!target || target.status !== 'Awaiting Signatures') return;

    const nowStr = new Date().toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    setRequisitions(prev =>
      prev.map(r => {
        if (r.id === reqId || r.controlNo === reqId) {
          return {
            ...r,
            status: 'Approved',
            signedFormScanUrl: scanUrl || r.signedFormScanUrl || '',
            signaturesConfirmedAt: nowStr,
            timeline: [
              ...r.timeline,
              { status: 'Approved', timestamp: nowStr, actor: 'PDAS Director (Engr. Reynaldo Bautista)', note: remarks + (scanUrl ? ` Scan: ${scanUrl}` : '') }
            ]
          };
        }
        return r;
      })
    );

    const newLog = {
      id: `APV-${Math.floor(100 + Math.random() * 900)}`,
      controlNo: target.controlNo,
      action: 'Signatures Confirmed — Approved',
      actionBy: 'PDAS Director (Engr. Reynaldo Bautista)',
      timestamp: nowStr,
      remarks,
    };
    setApprovalHistory(prev => [newLog, ...prev]);

    setNotifications(prev => [
      { id: `notif-${Date.now()}`, title: 'Signatures Confirmed', text: `${target.controlNo} physical signatures verified. Ticket approved for technician assignment.`, time: 'Just now', unread: true, targetRoles: ['faculty_staff', 'maintenance'] },
      ...prev
    ]);
    toast(`Signed form confirmed — request ${target.controlNo || reqId} approved.`);
  };

  // Archive Requisition (non-destructive)
  const archiveRequisition = (reqId) => {
    const target = requisitions.find(r => r.id === reqId || r.controlNo === reqId);
    if (!target) return;
    const nowStr = new Date().toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    setRequisitions(prev =>
      prev.map(r => {
        if (r.id === reqId || r.controlNo === reqId) {
          return {
            ...r,
            isArchived: true,
            archivedAt: nowStr,
            timeline: [
              ...r.timeline,
              { status: 'Archived', timestamp: nowStr, actor: 'PDAS Director', note: 'Ticket archived by PDAS administration.' }
            ]
          };
        }
        return r;
      })
    );

    setNotifications(prev => [{
      id: `notif-${Date.now()}`,
      title: 'Ticket Archived',
      text: `${target.controlNo} has been archived.`,
      time: 'Just now',
      unread: true,
      targetRole: 'admin'
    }, ...prev]);
    toast(`Request ${target.controlNo || reqId} archived.`, 'info');
  };

  // Unarchive (restore) a previously archived requisition
  const unarchiveRequisition = (reqId) => {
    setRequisitions(prev =>
      prev.map(r => {
        if (r.id === reqId || r.controlNo === reqId) {
          return { ...r, isArchived: false, archivedAt: null };
        }
        return r;
      })
    );
    toast(`Request ${reqId} restored from archive.`, 'info');
  };

  // Submit ISO/IEC 25010 Evaluation
  const submitEvaluation = (reqId, evalData) => {
    const target = requisitions.find(r => r.id === reqId || r.controlNo === reqId);
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
      comments: evalData.comments || ''
    };

    setEvaluations(prev => [evalEntry, ...prev]);

    setNotifications(prev => [{
      id: `notif-${Date.now()}`,
      title: 'Service Evaluation Submitted',
      text: `${target?.controlNo || reqId} evaluated by ${evalEntry.submittedBy}.`,
      time: 'Just now',
      unread: true,
      targetRole: 'admin'
    }, ...prev]);

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
      await apiCreatePreventiveSchedule({
        title: eventData.title,
        category: eventData.category,
        scheduledDate: eventData.date,
        timeWindow: eventData.time,
        location: eventData.location,
        inChargeName: eventData.inCharge
      });
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

  const updateCampusLocation = (idOrQr, updatedLoc) => {
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
    setCampusLocations(prev => prev.filter(loc => loc.id !== idOrQr && loc.qrCodeRef !== idOrQr));
  };

  const resetCampusLocations = () => {
    setCampusLocations(INITIAL_CAMPUS_LOCATIONS);
    localStorage.setItem('fixit_pdas_campus_locations_v3', JSON.stringify(INITIAL_CAMPUS_LOCATIONS));
  };

  // KPI Calculations
  const activeRequisitions = requisitions.filter(r => !r.isArchived);
  const totalRequisitions = activeRequisitions.length;
  const pendingApprovals = activeRequisitions.filter(r => r.status === 'Pending').length;
  const awaitingSignaturesCount = activeRequisitions.filter(r => r.status === 'Awaiting Signatures').length;
  const ongoingWorkOrders = activeRequisitions.filter(r => r.status === 'In Progress' || r.status === 'Ongoing' || r.status === 'On Hold' || r.status === 'Approved' || r.status === 'Awaiting Signatures').length;
  const completedRepairs = activeRequisitions.filter(r => r.status === 'Completed').length;
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
    r.status === 'Completed' && !r.isArchived &&
    !evaluations.some(e => e.reqId === r.id || e.controlNo === r.controlNo)
  );

  // Shared ticket search query — the navbar global search writes here and the
  // faculty ticket lists read it, so there is only one search box.
  const [ticketSearch, setTicketSearch] = useState('');

  // Deep-link target: when a notification is clicked, the drawer stores the
  // ticket reference here and navigates to the role tab; the destination view
  // opens the matching record, then clears the ref.
  const [focusedTicketRef, setFocusedTicketRef] = useState(null);

  return (
    <DataContext.Provider
      value={{
        requisitions,
        approvalHistory,
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
        setFocusedTicketRef
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


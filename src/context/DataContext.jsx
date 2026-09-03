import React, { createContext, useContext, useState, useEffect } from 'react';

const DataContext = createContext();

const INITIAL_OFFICES = [
  'Office of the Campus Administrator',
  'Office of Student Affairs and Services (OSAS)',
  'University Library Services',
  'Management Information System (MIS)',
  'Registrar & Admissions Office',
  'Accounting & Cashier Services',
  'Supply, Procurement & Property Custodian Office',
  'Campus Medical & Dental Clinic'
];

const INITIAL_DEPARTMENTS = [
  'BSIT',
  'BSHM',
  'BSE',
  'BINDTECH',
  'BTVTED',
  'College of Engineering & Architecture (CEA)',
  'College of Arts & Sciences (CAS)',
  'College of Industrial Technology (CIT)'
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
    timeline: [
      { status: 'Submitted', timestamp: '2026-09-02 08:30 AM', actor: 'Dr. Elena Ramos (Faculty)', note: 'Requisition submitted via QR code scan.' }
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
    category: 'HVAC / Aircon',
    urgency: 'Emergency',
    status: 'In Progress',
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
    notes: 'Emergency clearance authorized by Director. Technician on-site checking compressor and coil.',
    replacementFlag: {
      isFlagged: true,
      reason: 'Inverter Compressor burnt out and irrecoverable after 7 years of 24/7 server room operation.',
      itemSpecs: '3.0 HP Inverter Precision Cooling Compressor Unit (R410A compliant)',
      flaggedBy: 'Mark Villanueva (Lead Technician)',
      flaggedDate: '2026-09-01 02:15 PM',
      procurementStatus: 'Pending Director PR Approval'
    },
    timeline: [
      { status: 'Submitted', timestamp: '2026-09-01 09:15 AM', actor: 'Engr. Carlos Mendoza (MIS)', note: 'Emergency ticket filed.' },
      { status: 'Approved', timestamp: '2026-09-01 09:30 AM', actor: 'Engr. Reynaldo Bautista (Director)', note: 'Immediate emergency dispatch.' },
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
    category: 'Plumbing',
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
    category: 'Carpentry',
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
    timeline: [
      { status: 'Submitted', timestamp: '2026-08-28 09:00 AM', actor: 'Glenda Montenegro (Staff)', note: 'Requisition submitted.' },
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
    remarks: 'Emergency clearance issued. Assigned lead HVAC specialist.',
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

const INITIAL_USERS = [
  {
    id: 'usr_001',
    firstName: 'Reynaldo',
    lastName: 'Bautista',
    middleName: 'Santos',
    name: 'Engr. Reynaldo Bautista',
    title: 'PDAS Director',
    role: 'Admin',
    userType: 'Admin',
    email: 'pdas.director@dumangas.isatu.edu.ph',
    department: 'PDAS Administration',
    designation: 'PDAS Director / Head Administrator',
    phone: '+63 917 123 4567',
    idNumber: 'ISATU-ADM-2018-001',
    idStatus: 'Verified',
    status: 'Active',
    lastActive: 'Just now'
  },
  {
    id: 'usr_002',
    firstName: 'Elena',
    lastName: 'Ramos',
    middleName: 'Dizon',
    name: 'Dr. Elena Ramos',
    title: 'Dean, College of Engineering & Architecture',
    role: 'Faculty',
    userType: 'Faculty',
    email: 'elena.ramos.isatu@gmail.com',
    department: 'College of Engineering & Architecture',
    designation: 'Professor / College Dean',
    phone: '+63 918 333 4455',
    idNumber: 'ISATU-FAC-2019-042',
    idStatus: 'Verified',
    status: 'Active',
    lastActive: '15 mins ago'
  },
  {
    id: 'usr_003',
    firstName: 'Glenda',
    lastName: 'Montenegro',
    middleName: 'Alvarez',
    name: 'Glenda Montenegro',
    title: 'Laboratory Property Custodian',
    role: 'Staff',
    userType: 'Staff',
    email: 'glenda.montenegro.staff@gmail.com',
    department: 'Industrial Technology & Workshops',
    designation: 'Lab Technician & Custodian',
    phone: '+63 927 888 9900',
    idNumber: 'ISATU-STF-2021-118',
    idStatus: 'Verified',
    status: 'Active',
    lastActive: '1 hour ago'
  },
  {
    id: 'usr_004',
    firstName: 'Mark',
    lastName: 'Villanueva',
    middleName: 'Cruz',
    name: 'Mark Villanueva',
    title: 'Senior Electrical & HVAC Technician',
    role: 'Technician',
    userType: 'Maintenance',
    email: 'mark.villanueva.isatu@gmail.com',
    department: 'PDAS Technical Crew Unit',
    designation: 'Lead Maintenance Specialist',
    specialization: 'Electrical & HVAC',
    phone: '+63 920 456 7890',
    idNumber: 'ISATU-TEC-2020-055',
    idStatus: 'Verified',
    status: 'Active',
    lastActive: '5 mins ago'
  },
  {
    id: 'usr_005',
    firstName: 'Ronaldo',
    lastName: 'Dela Cruz',
    middleName: 'Gomez',
    name: 'Ronaldo Dela Cruz',
    title: 'Plumbing & Pipe Specialist',
    role: 'Technician',
    userType: 'Maintenance',
    email: 'ronaldo.delacruz@dumangas.isatu.edu.ph',
    department: 'PDAS Technical Crew Unit',
    designation: 'Senior Plumber',
    specialization: 'Plumbing & Drainage',
    phone: '+63 919 777 4433',
    idNumber: 'ISATU-TEC-2019-014',
    idStatus: 'Verified',
    status: 'Active',
    lastActive: '2 hours ago'
  },
  {
    id: 'usr_006',
    firstName: 'Arthur',
    lastName: 'Pendelton',
    middleName: 'Reyes',
    name: 'Arthur Pendelton',
    title: 'Master Carpenter & Mason',
    role: 'Technician',
    userType: 'Maintenance',
    email: 'arthur.pendelton@dumangas.isatu.edu.ph',
    department: 'PDAS Technical Crew Unit',
    designation: 'Master Carpenter',
    specialization: 'Carpentry & Masonry',
    phone: '+63 921 888 2211',
    idNumber: 'ISATU-TEC-2018-009',
    idStatus: 'Verified',
    status: 'Active',
    lastActive: 'Yesterday'
  }
];

const INITIAL_PENDING_REGISTRATIONS = [
  {
    id: 'REG-2026-001',
    firstName: 'Prof. Roberto',
    lastName: 'Castillo',
    middleName: 'Villar',
    gmail: 'roberto.castillo.isatu@gmail.com',
    userType: 'Faculty',
    department: 'Department of Electrical & Electronics Engineering',
    designation: 'Associate Professor',
    contactNumber: '+63 919 444 5566',
    idNumber: 'ISATU-FAC-2022-093',
    registeredDate: '2026-09-03 10:15 AM',
    idFileName: 'Faculty_ID_Prof_Castillo.jpg',
    idPreviewUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=400&auto=format&fit=crop&q=60',
    status: 'Pending Verification'
  },
  {
    id: 'REG-2026-002',
    firstName: 'Clarissa',
    lastName: 'Tan',
    middleName: 'Lim',
    gmail: 'clarissa.tan.staff@gmail.com',
    userType: 'Staff',
    department: 'Office of Student Affairs and Services (OSAS)',
    designation: 'Administrative Officer II',
    contactNumber: '+63 915 222 3344',
    idNumber: 'ISATU-STF-2023-144',
    registeredDate: '2026-09-02 03:30 PM',
    idFileName: 'Staff_ID_Clarissa_Tan.jpg',
    idPreviewUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&auto=format&fit=crop&q=60',
    status: 'Pending Verification'
  }
];

const INITIAL_REJECTED_REGISTRATIONS = [
  {
    id: 'REG-REJ-001',
    firstName: 'Juan',
    lastName: 'Dela Cruz (Sample)',
    middleName: 'B',
    gmail: 'unverified.user@gmail.com',
    userType: 'Staff',
    department: 'General Staff',
    contactNumber: '+63 900 000 0000',
    idNumber: 'INVALID-ID-000',
    rejectedDate: '2026-09-01 11:30 AM',
    reason: 'Blurry and unreadable ID photo attachment. Missing valid ISAT U institutional ID number.'
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
      { sender: 'Engr. Carlos Mendoza', text: 'Good day Director! Requisition REQ-2026-002 has been filed for the server room cooling unit.', time: '09:15 AM' },
      { sender: 'PDAS Director', text: 'Approved immediately under emergency status. Lead technician Mark is dispatched.', time: '09:32 AM' },
      { sender: 'Engr. Carlos Mendoza', text: 'Director, technician Mark checked the thermal sensor. Replacement compressor unit is needed due to burnt coils. Replacement flag raised.', time: '1:34 PM' }
    ]
  },
  {
    id: 'msg_002',
    sender: 'Dr. Elena Ramos (CEA)',
    senderAvatar: 'E',
    role: 'Dean / Requisitioner',
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
  const [offices, setOffices] = useState(() => JSON.parse(localStorage.getItem('fixit_pdas_offices_v3') || JSON.stringify(INITIAL_OFFICES)));
  const [departments, setDepartments] = useState(() => JSON.parse(localStorage.getItem('fixit_pdas_departments_v3') || JSON.stringify(INITIAL_DEPARTMENTS)));
  const [requisitions, setRequisitions] = useState(() => {
    const saved = localStorage.getItem('fixit_pdas_requisitions_v3');
    return saved ? JSON.parse(saved) : INITIAL_REQUISITIONS;
  });

  const [approvalHistory, setApprovalHistory] = useState(() => {
    const saved = localStorage.getItem('fixit_pdas_approvals_v3');
    return saved ? JSON.parse(saved) : INITIAL_APPROVAL_HISTORY;
  });

  const [calendarEvents, setCalendarEvents] = useState(() => {
    const saved = localStorage.getItem('fixit_pdas_calendar_v3');
    return saved ? JSON.parse(saved) : INITIAL_CALENDAR_EVENTS;
  });

  const [users, setUsers] = useState(() => {
    const saved = localStorage.getItem('fixit_pdas_users_v3');
    return saved ? JSON.parse(saved) : INITIAL_USERS;
  });

  const [pendingRegistrations, setPendingRegistrations] = useState(() => {
    const saved = localStorage.getItem('fixit_pdas_registrations_v3');
    return saved ? JSON.parse(saved) : INITIAL_PENDING_REGISTRATIONS;
  });

  const [rejectedRegistrations, setRejectedRegistrations] = useState(() => {
    const saved = localStorage.getItem('fixit_pdas_rejected_regs_v3');
    return saved ? JSON.parse(saved) : INITIAL_REJECTED_REGISTRATIONS;
  });

  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem('fixit_pdas_messages_v3');
    return saved ? JSON.parse(saved) : INITIAL_MESSAGES;
  });

  const [notifications, setNotifications] = useState([
    { id: 'notif-1', title: 'New Job Requisition', text: 'Dr. Elena Ramos submitted REQ-2026-001 (Electrical - CEA 302)', time: '10m ago', unread: true },
    { id: 'notif-2', title: 'Emergency Alert', text: 'Server room AC thermal alert REQ-2026-002 active - Replacement Flag raised', time: '1h ago', unread: true },
    { id: 'notif-3', title: 'Registration Request', text: 'Prof. Roberto Castillo submitted Faculty ID for verification', time: '2h ago', unread: true }
  ]);

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem('fixit_pdas_offices_v3', JSON.stringify(offices));
  }, [offices]);

  useEffect(() => {
    localStorage.setItem('fixit_pdas_departments_v3', JSON.stringify(departments));
  }, [departments]);

  useEffect(() => {
    localStorage.setItem('fixit_pdas_requisitions_v3', JSON.stringify(requisitions));
  }, [requisitions]);

  useEffect(() => {
    localStorage.setItem('fixit_pdas_approvals_v3', JSON.stringify(approvalHistory));
  }, [approvalHistory]);

  useEffect(() => {
    localStorage.setItem('fixit_pdas_calendar_v3', JSON.stringify(calendarEvents));
  }, [calendarEvents]);

  useEffect(() => {
    localStorage.setItem('fixit_pdas_users_v3', JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    localStorage.setItem('fixit_pdas_registrations_v3', JSON.stringify(pendingRegistrations));
  }, [pendingRegistrations]);

  useEffect(() => {
    localStorage.setItem('fixit_pdas_rejected_regs_v3', JSON.stringify(rejectedRegistrations));
  }, [rejectedRegistrations]);

  useEffect(() => {
    localStorage.setItem('fixit_pdas_messages_v3', JSON.stringify(messages));
  }, [messages]);

  // Registration Flow
  const registerUser = (regData) => {
    const regId = `REG-2026-${String(pendingRegistrations.length + rejectedRegistrations.length + 1).padStart(3, '0')}`;
    const newReg = {
      id: regId,
      firstName: regData.firstName,
      lastName: regData.lastName,
      middleName: regData.middleName || '',
      gmail: regData.gmail,
      userType: regData.userType || 'Faculty', // 'Faculty' or 'Staff'
      department: regData.department || (regData.userType === 'Faculty' ? 'Academic Department' : 'Administrative Office'),
      designation: regData.designation || (regData.userType === 'Faculty' ? 'Faculty Member' : 'Staff Member'),
      contactNumber: regData.contactNumber,
      idNumber: regData.idNumber || `ISATU-${Date.now().toString().slice(-4)}`,
      registeredDate: new Date().toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      idFileName: regData.idFileName || 'Attached_Photo_of_ID.jpg',
      idPreviewUrl: regData.idPreviewUrl || 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=400&auto=format&fit=crop&q=60',
      status: 'Pending Verification'
    };

    setPendingRegistrations(prev => [newReg, ...prev]);

    setNotifications(prev => [
      {
        id: `notif-${Date.now()}`,
        title: 'New Account Registration',
        text: `${newReg.firstName} ${newReg.lastName} (${newReg.userType} - ${newReg.department}) submitted ID for verification`,
        time: 'Just now',
        unread: true
      },
      ...prev
    ]);

    return { success: true, regId };
  };

  const addOffice = (office) => {
    const value = office.trim();
    if (value && !offices.some(item => item.toLowerCase() === value.toLowerCase())) setOffices(prev => [...prev, value]);
  };

  const addDepartment = (department) => {
    const value = department.trim();
    if (value && !departments.some(item => item.toLowerCase() === value.toLowerCase())) setDepartments(prev => [...prev, value]);
  };

  const approveRegistration = (regId) => {
    const reg = pendingRegistrations.find(r => r.id === regId);
    if (!reg) return;

    const fullName = `${reg.firstName} ${reg.middleName ? reg.middleName.charAt(0) + '. ' : ''}${reg.lastName}`;

    const newUser = {
      id: `usr_${Date.now().toString().slice(-4)}`,
      firstName: reg.firstName,
      lastName: reg.lastName,
      middleName: reg.middleName,
      name: fullName,
      title: reg.userType === 'Faculty' ? `Faculty (${reg.department})` : `Staff (${reg.designation})`,
      role: reg.userType,
      userType: reg.userType,
      email: reg.gmail,
      password: reg.password,
      department: reg.department || 'ISAT U Dumangas',
      designation: reg.designation || 'Staff',
      phone: reg.contactNumber,
      idNumber: reg.idNumber,
      idStatus: 'Verified',
      status: 'Active',
      lastActive: 'Just registered'
    };

    setUsers(prev => [...prev, newUser]);
    setPendingRegistrations(prev => prev.filter(r => r.id !== regId));

    setNotifications(prev => [
      {
        id: `notif-${Date.now()}`,
        title: 'Account Verified by Admin',
        text: `${fullName} (${reg.userType}) account verified and approved. Access granted.`,
        time: 'Just now',
        unread: true
      },
      ...prev
    ]);
  };

  const rejectRegistration = (regId, reason = 'Application details could not be verified by PDAS.') => {
    const reg = pendingRegistrations.find(r => r.id === regId);
    if (!reg) return;

    const rejectedEntry = {
      ...reg,
      id: `REJ-${reg.id}`,
      rejectedDate: new Date().toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      reason
    };

    setRejectedRegistrations(prev => [rejectedEntry, ...prev]);
    setPendingRegistrations(prev => prev.filter(r => r.id !== regId));

    setNotifications(prev => [
      {
        id: `notif-${Date.now()}`,
        title: 'Registration Rejected',
        text: `Application for ${reg.firstName} ${reg.lastName} rejected. Reason: ${reason}`,
        time: 'Just now',
        unread: true
      },
      ...prev
    ]);
  };

  // Maintenance Personnel Account Creation (Admin Only)
  const createMaintenanceUser = (techData) => {
    const fullName = `${techData.firstName} ${techData.middleName ? techData.middleName.charAt(0) + '. ' : ''}${techData.lastName}`;
    const newTech = {
      id: `usr_tech_${Date.now().toString().slice(-4)}`,
      firstName: techData.firstName,
      lastName: techData.lastName,
      middleName: techData.middleName || '',
      name: fullName,
      title: `${techData.specialization || 'General'} Maintenance Specialist`,
      role: 'Technician',
      userType: 'Maintenance',
      email: techData.email,
      password: techData.password || 'tech123',
      department: 'PDAS Technical Crew Unit',
      designation: `${techData.specialization || 'General'} Technician`,
      specialization: techData.specialization || 'General Maintenance',
      phone: techData.phone,
      idNumber: techData.idNumber || `ISATU-TEC-${Date.now().toString().slice(-4)}`,
      idStatus: 'Verified',
      status: 'Active',
      lastActive: 'Just created by Admin'
    };

    setUsers(prev => [...prev, newTech]);
    setNotifications(prev => [
      {
        id: `notif-${Date.now()}`,
        title: 'Maintenance Account Created',
        text: `New maintenance personnel ${fullName} (${newTech.specialization}) added by PDAS Director.`,
        time: 'Just now',
        unread: true
      },
      ...prev
    ]);
    return newTech;
  };

  // Requisitions Workflow & Priority Routing
  const addRequisition = (newReq) => {
    const controlNo = `REQ-2026-${String(requisitions.length + 1).padStart(3, '0')}`;
    const nowStr = new Date().toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    
    const entry = {
      id: controlNo,
      controlNo,
      date: new Date().toISOString().split('T')[0],
      status: 'Pending',
      replacementFlag: {
        isFlagged: false,
        reason: '',
        itemSpecs: '',
        requestType: newReq.requestType || (newReq.urgency === 'Emergency' ? 'Emergency Request' : 'Standard Request'),
        pdasFormName: newReq.pdasFormName || '',
        flaggedBy: '',
        flaggedDate: '',
        procurementStatus: 'None'
      },
      timeline: [
        {
          status: 'Submitted',
          timestamp: nowStr,
          actor: `${newReq.requestedBy} (${newReq.requesterRole || 'Requisitioner'})`,
          note: 'Job request submitted to PDAS central queue.'
        }
      ],
      ...newReq
    };

    setRequisitions(prev => [entry, ...prev]);

    setNotifications(prev => [
      {
        id: `notif-${Date.now()}`,
        title: entry.urgency === 'Emergency' || entry.urgency === 'High' ? '🚨 URGENT Facility Ticket' : 'New Facility Requisition',
        text: `${controlNo} (${entry.category} - ${entry.location}) filed by ${entry.requestedBy}`,
        time: 'Just now',
        unread: true
      },
      ...prev
    ]);

    return entry;
  };

  const approveRequisition = (reqId, remarks = 'Approved by PDAS Director') => {
    const target = requisitions.find(r => r.id === reqId || r.controlNo === reqId);
    if (!target) return;

    const nowStr = new Date().toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    setRequisitions(prev =>
      prev.map(r => {
        if (r.id === reqId || r.controlNo === reqId) {
          return {
            ...r,
            status: 'Approved',
            notes: remarks,
            timeline: [
              ...r.timeline,
              { status: 'Approved', timestamp: nowStr, actor: 'PDAS Director (Engr. Reynaldo Bautista)', note: remarks }
            ]
          };
        }
        return r;
      })
    );

    const newLog = {
      id: `APV-${Math.floor(100 + Math.random() * 900)}`,
      controlNo: target.controlNo,
      action: 'Approved',
      actionBy: 'PDAS Director (Engr. Reynaldo Bautista)',
      timestamp: nowStr,
      remarks,
    };

    setApprovalHistory(prev => [newLog, ...prev]);

    setNotifications(prev => [
      { id: `notif-${Date.now()}`, title: 'Requisition Approved', text: `${target.controlNo} approved by PDAS Director`, time: 'Just now', unread: true },
      ...prev
    ]);
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
  };

  const assignTechnician = (reqId, technicianName, techId = null) => {
    const nowStr = new Date().toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    setRequisitions(prev =>
      prev.map(r => {
        if (r.id === reqId || r.controlNo === reqId) {
          return {
            ...r,
            assignedTo: technicianName,
            assignedTechId: techId,
            status: 'In Progress',
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
        unread: true
      },
      ...prev
    ]);
  };

  const updateRequisitionStatus = (reqId, newStatus, actorName = 'Maintenance Staff', notes = '') => {
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

    setNotifications(prev => [
      {
        id: `notif-${Date.now()}`,
        title: `Ticket Status: ${newStatus}`,
        text: `${reqId} updated to "${newStatus}" by ${actorName}`,
        time: 'Just now',
        unread: true
      },
      ...prev
    ]);
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
              flaggedBy: flagData.flaggedBy || 'Maintenance Personnel',
              flaggedDate: nowStr,
              procurementStatus: 'Pending Director PR Approval'
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
        time: 'Just now',
        unread: true
      },
      ...prev
    ]);
  };

  const updateProcurementStatus = (reqId, procurementStatus) => {
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
  };

  const addCalendarEvent = (eventData) => {
    const newEvent = {
      id: `CAL-${Date.now().toString().slice(-4)}`,
      status: 'Scheduled',
      ...eventData
    };
    setCalendarEvents(prev => [...prev, newEvent]);
    setNotifications(prev => [
      {
        id: `notif-${Date.now()}`,
        title: 'Preventive Maintenance Scheduled',
        text: `${newEvent.title} on ${newEvent.date} (${newEvent.location})`,
        time: 'Just now',
        unread: true
      },
      ...prev
    ]);
  };

  const toggleUserStatus = (userId) => {
    setUsers(prev =>
      prev.map(u => (u.id === userId ? { ...u, status: u.status === 'Active' ? 'Inactive' : 'Active' } : u))
    );
  };

  const updateUser = (userId, updatedFields) => {
    setUsers(prev => prev.map(user => user.id === userId ? { ...user, ...updatedFields } : user));
  };

  const removeUser = (userId) => {
    const target = users.find(user => user.id === userId);
    if (!target || target.role === 'Admin' || target.userType === 'Admin') return false;
    setUsers(prev => prev.filter(user => user.id !== userId));
    setNotifications(prev => [{
      id: `notif-${Date.now()}`,
      title: 'User Account Removed',
      text: `${target.name || target.email} was removed by PDAS Director.`,
      time: 'Just now',
      unread: true
    }, ...prev]);
    return true;
  };

  const requestPasswordChange = (email) => {
    setNotifications(prev => [{
      id: `notif-${Date.now()}`,
      title: 'Password Change Request',
      text: `${email} requested a password reset.`,
      time: 'Just now',
      unread: true
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

  // KPI Calculations
  const totalRequisitions = requisitions.length;
  const pendingApprovals = requisitions.filter(r => r.status === 'Pending').length;
  const ongoingWorkOrders = requisitions.filter(r => r.status === 'In Progress' || r.status === 'Approved').length;
  const completedRepairs = requisitions.filter(r => r.status === 'Completed').length;
  const unreadMessagesCount = messages.filter(m => m.unread).length;
  const pendingRegistrationsCount = pendingRegistrations.length;
  const replacementFlaggedCount = requisitions.filter(r => r.replacementFlag && r.replacementFlag.isFlagged).length;
  const monthlyRequestTotals = requisitions.reduce((totals, request) => {
    const month = request.date?.slice(0, 7);
    if (month) totals[month] = (totals[month] || 0) + 1;
    return totals;
  }, {});

  return (
    <DataContext.Provider
      value={{
        requisitions,
        approvalHistory,
        calendarEvents,
        users,
        offices,
        departments,
        pendingRegistrations,
        pendingRegistrationsCount,
        rejectedRegistrations,
        messages,
        notifications,
        totalRequisitions,
        pendingApprovals,
        ongoingWorkOrders,
        completedRepairs,
        unreadMessagesCount,
        replacementFlaggedCount,
        monthlyRequestTotals,
        registerUser,
        addOffice,
        addDepartment,
        approveRegistration,
        rejectRegistration,
        createMaintenanceUser,
        approveRequisition,
        rejectRequisition,
        assignTechnician,
        updateRequisitionStatus,
        raiseReplacementFlag,
        updateProcurementStatus,
        addRequisition,
        addCalendarEvent,
        toggleUserStatus,
        updateUser,
        removeUser,
        requestPasswordChange,
        sendMessage,
        setNotifications
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


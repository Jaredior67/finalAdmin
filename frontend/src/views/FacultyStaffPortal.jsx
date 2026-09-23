import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  QrCode,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileText,
  Printer,
  Eye,
  Send,
  History,
  Star,
  Download,
  Check
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { StatusBadge, UrgencyBadge, CategoryPill } from '../components/common/StatusBadge';
import { Modal } from '../components/common/Modal';
import { QrCodeScannerModal } from '../components/common/QrCodeScannerModal';
import { CommunicationBox } from './CommunicationBox';
import { OfficialDocuments } from './OfficialDocuments';
import { EvaluationForm } from './EvaluationForm';
import { JobRequestFormOverlay } from '../components/common/JobRequestFormOverlay';
import { JobRequestPrintSheet } from '../components/common/JobRequestPrintSheet';
import { PageHeader } from '../components/common/PageHeader';
import { Pagination } from '../components/ui/Pagination';
import { formatTicketDate } from '../components/common/TimeGreeting';

const DEFAULT_CAMPUS_BUILDINGS = [
  {
    name: 'College of Engineering & Architecture (CEA)',
    floors: [
      { floor: 'Ground Floor', rooms: ['CEA 101 Lecture Room', 'Civil Engineering Lab', 'Material Testing Room', 'Faculty Lounge'] },
      { floor: '2nd Floor', rooms: ['CEA 201 Drafting Hall', 'CEA 204 Electronics Lecture', 'Dean Office', 'Restroom (East Wing)'] },
      { floor: '3rd Floor', rooms: ['Room 302 (Electronics & Circuits Lab)', 'Computer Engineering Lab', 'CEA 305 Lecture Room', 'Restroom (West Wing)'] }
    ]
  },
  {
    name: 'Administration Hall',
    floors: [
      { floor: 'Ground Floor', rooms: ['Server Room & MIS Data Center', 'Admissions & Registrar Office', 'Cashier & Accounting'] },
      { floor: '2nd Floor', rooms: ['Executive Boardroom & Director Office', 'PDAS Central Office', 'Faculty Conference Room'] }
    ]
  },
  {
    name: 'University Library Services',
    floors: [
      { floor: '1st Floor', rooms: ['Circulation Desk', 'General Reference Section', 'E-Library & Multimedia Room'] },
      { floor: '2nd Floor', rooms: ['Faculty & Student Reading Wing Restroom', 'Graduate Theses Archive', 'Periodicals Wing'] }
    ]
  },
  {
    name: 'Industrial Technology & Workshops',
    floors: [
      { floor: 'Ground Floor', rooms: ['Tech Lab 105 (Woodworking & Drafting)', 'Machine Shop & Welding Area', 'Automotive Lab', 'Tool Custodian Room'] }
    ]
  },
  {
    name: 'College of Arts & Sciences (CAS)',
    floors: [
      { floor: '1st Floor', rooms: ['Room 101 (Chemistry & Biology Laboratory)', 'CAS 102 Lecture Room', 'Faculty Room'] },
      { floor: '2nd Floor', rooms: ['CAS 201 Speech Lab', 'CAS 203 Multi-Purpose Room', 'CAS Restrooms'] }
    ]
  },
  {
    name: 'University Gymnasium & Athletic Center',
    floors: [
      { floor: 'Main Court', rooms: ['Bleachers & Main Scoreboard Electrical Box', 'PE Faculty Room', 'Equipment Storage Room', 'Locker & Shower Area'] }
    ]
  }
];

export const FacultyStaffPortal = ({ activeTab = 'faculty-submit', onTabChange, initialRequestType }) => {
  const { currentUser } = useAuth();
  const { 
    requisitions, 
    addRequisition, 
    completeStandardFormForUrgent, 
    messages, 
    sendMessage, 
    evaluations, 
    submitEvaluation, 
    campusLocations,
    offices,
    ticketSearch: searchTerm
  } = useData();

  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [selectedReqForPrint, setSelectedReqForPrint] = useState(null);
  const [selectedTicketDetail, setSelectedTicketDetail] = useState(null);
  const [submittedSuccess, setSubmittedSuccess] = useState(null);
  const [evaluationRequest, setEvaluationRequest] = useState(null);
  const [isStandardOverlayOpen, setIsStandardOverlayOpen] = useState(false);

  // Filters State (search text comes from the navbar global search box)
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [urgencyFilter, setUrgencyFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [tablePage, setTablePage] = useState(1);
  const tablePageSize = 8;

  // Reset table pagination whenever the tab or filters change
  useEffect(() => { setTablePage(1); }, [activeTab, searchTerm, categoryFilter, urgencyFilter, statusFilter]);

  const paginate = (list) => {
    const totalPages = Math.max(1, Math.ceil(list.length / tablePageSize));
    const safe = Math.min(Math.max(tablePage, 1), totalPages);
    return { totalPages, safe, rows: list.slice((safe - 1) * tablePageSize, safe * tablePageSize) };
  };

  // Dynamically derive campus buildings hierarchy from campusLocations
  const CAMPUS_BUILDINGS = useMemo(() => {
    if (campusLocations && campusLocations.length > 0) {
      const bldgMap = new Map();
      campusLocations.forEach(loc => {
        if (!bldgMap.has(loc.building)) {
          bldgMap.set(loc.building, new Map());
        }
        const floorMap = bldgMap.get(loc.building);
        if (!floorMap.has(loc.floor)) {
          floorMap.set(loc.floor, []);
        }
        floorMap.get(loc.floor).push(loc.room);
      });

      return Array.from(bldgMap.entries()).map(([name, floorMap]) => ({
        name,
        floors: Array.from(floorMap.entries()).map(([floor, rooms]) => ({
          floor,
          rooms: Array.from(new Set(rooms))
        }))
      }));
    }
    return DEFAULT_CAMPUS_BUILDINGS;
  }, [campusLocations]);

  // Location defaults & request-type state (the overlay itself is the form now)
  const [selectedOffice] = useState(() => currentUser?.department || offices?.[0] || 'Office of the Campus Administrator');
  const [selectedBuilding, setSelectedBuilding] = useState(() => CAMPUS_BUILDINGS[0]?.name || 'College of Engineering & Architecture (CEA)');
  const [selectedFloor, setSelectedFloor] = useState(() => CAMPUS_BUILDINGS[0]?.floors[0]?.floor || 'Ground Floor');
  const [selectedRoom, setSelectedRoom] = useState(() => CAMPUS_BUILDINGS[0]?.floors[0]?.rooms[0] || 'Room 101');
  const [qrScannedTag, setQrScannedTag] = useState('');

  const [urgency, setUrgency] = useState(() => (
    (initialRequestType === 'Urgent Request' || activeTab === 'faculty-urgent') ? 'High Risk' : 'Medium Risk'
  ));

  // Submission UX State
  const [, setIsSubmitting] = useState(false);

  // Urgent Standard Form Completion Modal State
  const [isUrgentModalOpen, setIsUrgentModalOpen] = useState(false);
  const [urgentTargetReq, setUrgentTargetReq] = useState(null);
  const [urgentModalSupervisor, setUrgentModalSupervisor] = useState('');
  const [urgentModalOptions, setUrgentModalOptions] = useState([]);
  const [urgentModalDesc, setUrgentModalDesc] = useState('');
  const [requestType, setRequestType] = useState(() => (
    initialRequestType || (activeTab === 'faculty-urgent' ? 'Urgent Request' : 'Standard Request')
  ));

  // Synchronize requestType when tab or prop triggers urgent
  useEffect(() => {
    if (activeTab === 'faculty-urgent' || initialRequestType === 'Urgent Request') {
      setRequestType('Urgent Request');
      setUrgency('High Risk');
    } else if (initialRequestType === 'Standard Request') {
      setRequestType('Standard Request');
      setUrgency('Medium Risk');
    }
  }, [activeTab, initialRequestType]);

  // Jump straight into the full QF-PDAS-DC-01 overlay when the user NAVIGATES
  // to a submit tab — but never on first mount, so logging in lands on the
  // launcher card instead of an instant popup.
  const prevTab = useRef(activeTab);
  useEffect(() => {
    if (
      (activeTab === 'faculty-submit' || activeTab === 'faculty-urgent' || activeTab === 'submit') &&
      !submittedSuccess &&
      prevTab.current !== activeTab
    ) {
      setIsStandardOverlayOpen(true);
    }
    prevTab.current = activeTab;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Messaging State
  const [msgText, setMsgText] = useState('');

  // QR Scan Handler — location feeds the overlay draft, then opens the full form.
  const handleQrScanSuccess = (scanData) => {
    setQrScannedTag(scanData.qrCodeRef);
    setSelectedBuilding(scanData.building);
    setSelectedFloor(scanData.floor);
    setSelectedRoom(scanData.room);
    setIsStandardOverlayOpen(true);
  };

  const handleResetForm = () => {
    setUrgency('Medium Risk');
    setRequestType('Standard Request');
    setQrScannedTag('');
    setIsSubmitting(false);
  };

  // Build QF-PDAS-DC-01 Scope of Works Data
  const buildScopeOfWorks = (targetCat, selectedOpts, desc) => {
    const scopeData = {
      drawingDesign: { checked: false, options: [], description: '', dateComplied: '' },
      physicalStructures: { checked: false, options: [], description: '', dateComplied: '' },
      electrical: { checked: false, options: [], description: '', dateComplied: '' },
      mechanical: { checked: false, options: [], description: '', dateComplied: '' },
      waterSanitary: { checked: false, options: [], description: '', dateComplied: '' },
      airConditioning: { checked: false, options: [], description: '', dateComplied: '' }
    };

    const keyMap = {
      'Drawing/Design': 'drawingDesign',
      'Physical Structures': 'physicalStructures',
      'Electrical': 'electrical',
      'Mechanical': 'mechanical',
      'Water/Sanitary': 'waterSanitary',
      'Air Conditioning': 'airConditioning'
    };

    const targetKey = keyMap[targetCat] || 'electrical';
    scopeData[targetKey] = {
      checked: true,
      options: selectedOpts || [],
      description: desc || '',
      dateComplied: ''
    };

    return scopeData;
  };

  // Fresh QF-PDAS-DC-01 draft — the overlay itself is the form, prefilled from
  // the signed-in requester and campus defaults.
  const overlayDraft = () => ({
    date: new Date().toISOString().split('T')[0],
    requestedBy: currentUser?.name || '',
    department: currentUser?.department || 'ISAT U Dumangas',
    location: `${selectedBuilding} - ${selectedRoom}`,
    immediateSupervisor: '',
    contactNumber: currentUser?.phone || '',
    title: '',
    category: 'Electrical',
    urgency: requestType === 'Urgent Request' ? 'High Risk' : urgency,
    description: '',
    scopeOfWorks: buildScopeOfWorks('Electrical', [], ''),
    controlNo: null,
  });

  const createFromOverlay = (edited, printAfter = false) => {
    setIsSubmitting(true);
    const isStandard = requestType === 'Standard Request';
    const newReq = addRequisition({
      title: edited.title,
      description: edited.description,
      building: selectedBuilding,
      floor: selectedFloor,
      room: selectedRoom,
      location: edited.location || `${selectedBuilding} - ${selectedRoom}`,
      qrCodeRef: qrScannedTag || `ISATU-${selectedRoom.replace(/\s+/g, '-').slice(0, 10).toUpperCase()}`,
      category: edited.category,
      urgency: edited.urgency || urgency,
      requestType,
      isStandardFormFilled: isStandard,
      immediateSupervisor: edited.immediateSupervisor || 'Department Head / Supervisor',
      scopeOfWorks: edited.scopeOfWorks,
      actionTaken: edited.actionTaken,
      finalAction: edited.finalAction,
      pdasFormName: '',
      requestedBy: edited.requestedBy || currentUser?.name || 'Faculty Requester',
      requesterEmail: currentUser?.email || 'faculty@dumangas.isatu.edu.ph',
      requesterRole: currentUser?.role === 'staff' ? 'Staff' : 'Faculty',
      department: edited.department || selectedOffice || currentUser?.department || 'ISAT U Dumangas',
      contactNumber: edited.contactNumber || currentUser?.phone || '+63 9XX XXX XXXX',
      idNumber: currentUser?.idNumber || 'ISATU-EMP-000',
      photoUrl: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=500&auto=format&fit=crop&q=60'
    });
    setTimeout(() => {
      setSubmittedSuccess(newReq);
      setSelectedReqForPrint(newReq);
      setIsStandardOverlayOpen(false);
      handleResetForm();
      setIsSubmitting(false);
      if (printAfter) setIsPrintModalOpen(true);
    }, 300);
  };

  // Requisition Partitioning (most recent first)
  const byDateDesc = (a, b) => String(b.date || '').localeCompare(String(a.date || ''));
  const myTickets = requisitions.filter(r => 
    (currentUser?.email && r.requesterEmail?.toLowerCase() === currentUser.email.toLowerCase()) ||
    (currentUser?.name && r.requestedBy?.toLowerCase().includes(currentUser.name.toLowerCase()))
  );
  const activeTickets = myTickets.filter(r => r.status !== 'Completed' && r.status !== 'Rejected');
  const completedTickets = myTickets.filter(r => r.status === 'Completed' || r.status === 'Rejected');

  // Filtered Active Tickets
  const filteredActiveTickets = activeTickets.filter(req => {
    const matchesSearch = 
      String(req.controlNo || req.id).toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.location.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || req.category === categoryFilter;
    const matchesUrgency = urgencyFilter === 'all' || req.urgency === urgencyFilter;
    const matchesStatus = statusFilter === 'all' || req.status.toLowerCase().replace(/\s+/g, '-') === statusFilter;
    return matchesSearch && matchesCategory && matchesUrgency && matchesStatus;
  }).sort(byDateDesc);

  // Filtered History Tickets
  const filteredHistoryTickets = completedTickets.filter(req => {
    const matchesSearch = 
      String(req.controlNo || req.id).toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (req.assignedTo && req.assignedTo.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = categoryFilter === 'all' || req.category === categoryFilter;
    const matchesUrgency = urgencyFilter === 'all' || req.urgency === urgencyFilter;
    return matchesSearch && matchesCategory && matchesUrgency;
  }).sort(byDateDesc);

  const pagedActive = paginate(filteredActiveTickets);
  const pagedHistory = paginate(filteredHistoryTickets);

  // Export Requisitions to CSV
  const handleExportCSV = () => {
    if (completedTickets.length === 0) return;
    const headers = ['Tracking No', 'Title', 'Location', 'Category', 'Urgency', 'Status', 'Date Filed', 'Serviced By', 'Evaluation Rating'];
    const rows = completedTickets.map(req => {
      const evalData = evaluations.find(e => e.reqId === req.id || e.controlNo === req.controlNo);
      let avgScore = 'Unrated';
      if (evalData) {
        const scores = [evalData.functionalSuitability, evalData.usability, evalData.reliability, evalData.performanceEfficiency].filter(Boolean);
        avgScore = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : 'Rated';
      }
      return [
        `"${req.controlNo || req.id}"`,
        `"${req.title.replace(/"/g, '""')}"`,
        `"${req.location}"`,
        `"${req.category}"`,
        `"${req.urgency}"`,
        `"${req.status}"`,
        `"${req.date}"`,
        `"${req.assignedTo || 'PDAS Team'}"`,
        `"${avgScore}"`
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ISATU_Request_History_${currentUser?.idNumber || 'Report'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };


  if (activeTab === 'faculty-documents') {
    return <OfficialDocuments />;
  }

  if (activeTab === 'faculty-messages') {
    return <CommunicationBox />;
  }

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', paddingBottom: '40px' }}>
      
      {/* Page Header */}
      <PageHeader
        breadcrumbs={['Request Desk', activeTab === 'faculty-history' ? 'Request History' : activeTab === 'faculty-tickets' ? 'My Active Tickets' : 'New Request']}
        title={activeTab === 'faculty-history' ? 'Request History' : activeTab === 'faculty-tickets' ? 'My Active Tickets' : 'Facility Request Desk'}
        action={
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setRequestType('Standard Request');
                setUrgency('Medium Risk');
                if (onTabChange) onTabChange('faculty-submit');
                setIsStandardOverlayOpen(true);
              }}
              style={{ padding: '8px 14px', borderRadius: '8px', background: '#001f9c', color: '#ffffff', border: 'none', fontWeight: '700', fontSize: '13px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <FileText size={15} /> Standard Request
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                setRequestType('Urgent Request');
                setUrgency('High Risk');
                if (onTabChange) onTabChange('faculty-submit');
                setIsStandardOverlayOpen(true);
              }}
              style={{ padding: '8px 14px', borderRadius: '8px', background: '#dc2626', color: '#ffffff', border: 'none', fontWeight: '700', fontSize: '13px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <AlertTriangle size={15} /> Report Urgent Issue
            </button>
          </div>
        }
      />

      {/* Summary KPI cards live on the Dashboard tab only (faculty-dashboard). */}

      {/* TAB 1: SUBMIT JOB REQUEST */}
      {(activeTab === 'faculty-submit' || activeTab === 'faculty-urgent' || activeTab === 'submit') && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: '24px',
          alignItems: 'start'
        }}>
          {/* Launcher Card — the full QF-PDAS-DC-01 overlay is the form */}
          <div className="content-card" style={{ padding: '28px' }}>
            {submittedSuccess ? (
              <div className="animate-scale-in" style={{ textAlign: 'center', padding: '36px 16px' }}>
                <div style={{
                  width: '68px',
                  height: '68px',
                  borderRadius: '50%',
                  background: '#ecfdf5',
                  color: '#059669',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '16px',
                  border: '2px solid #a7f3d0',
                  boxShadow: '0 0 0 8px rgba(16, 185, 129, 0.08)'
                }}>
                  <CheckCircle2 size={40} />
                </div>
                <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#0f172a', marginBottom: '8px' }}>
                  Facility Job Request Submitted Successfully!
                </h2>
                <div style={{
                  display: 'inline-block',
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  color: '#001f9c',
                  fontWeight: '800',
                  padding: '6px 14px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  marginBottom: '12px'
                }}>
                  Reference: {submittedSuccess.controlNo || submittedSuccess.id}
                </div>
                <div style={{
                  background: submittedSuccess.requestType === 'Urgent Request' ? '#fff1f2' : '#eff6ff',
                  border: submittedSuccess.requestType === 'Urgent Request' ? '1px solid #fecdd3' : '1px solid #bfdbfe',
                  borderRadius: '12px',
                  padding: '16px',
                  maxWidth: '580px',
                  margin: '0 auto 24px auto',
                  textAlign: 'left',
                  fontSize: '13px',
                  color: '#1e293b'
                }}>
                  {submittedSuccess.requestType === 'Urgent Request' ? (
                    <div>
                      <div style={{ fontWeight: '800', color: '#9f1239', marginBottom: '6px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <AlertTriangle size={16} color="#dc2626" />
                        Urgent Dispatch Authorized!
                      </div>
                      <div style={{ color: '#881337', lineHeight: 1.5 }}>
                        1. Maintenance personnel have been assigned immediately to respond to the site hazard.<br />
                        2. <strong>Post-Dispatch Action:</strong> Within the day (after Admin accepts and dispatches), please print the QF-PDAS-DC-01 form below, obtain your <strong>Immediate Supervisor's physical wet-ink signature</strong>, and submit the signed hardcopy form to the PDAS Office.
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontWeight: '800', color: '#1e40af', marginBottom: '6px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <FileText size={16} color="#001f9c" />
                        Standard Process Required Next Steps:
                      </div>
                      <div style={{ color: '#334155', lineHeight: 1.5 }}>
                        <strong>Step 1:</strong> Print the QF-PDAS-DC-01 form using the button below.<br />
                        <strong>Step 2:</strong> Have the hardcopy physically signed in wet ink by your <strong>Immediate Supervisor</strong>.<br />
                        <strong>Step 3:</strong> Pass/submit the signed physical hardcopy form to the <strong>PDAS Office</strong>.<br />
                        <span style={{ color: '#b91c1c', fontWeight: '700' }}>⚠️ Important: The request CANNOT move or advance until the hardcopy form is physically signed by all required signatories and verified by PDAS Admin.</span>
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setIsPrintModalOpen(true)}
                  >
                    <Printer size={16} />
                    View & Print Official PDAS Form (PDF)
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setSubmittedSuccess(null);
                      if (onTabChange) onTabChange('faculty-tickets');
                    }}
                  >
                    <Clock size={16} />
                    Track in Active Tickets
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setSubmittedSuccess(null)}
                  >
                    File Another Request
                  </button>
                </div>
              </div>
            ) : (
              <div className="content-card" style={{ padding: '40px 36px', textAlign: 'center', maxWidth: '660px', margin: '0 auto' }}>
                <div style={{
                  width: '72px',
                  height: '72px',
                  borderRadius: '20px',
                  background: requestType === 'Urgent Request' ? '#fef2f2' : '#eff4ff',
                  color: requestType === 'Urgent Request' ? '#dc2626' : '#001f9c',
                  border: requestType === 'Urgent Request' ? '1px solid #fecaca' : '1px solid #bfdbfe',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '18px'
                }}>
                  {requestType === 'Urgent Request' ? <AlertTriangle size={34} /> : <FileText size={34} />}
                </div>
                <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', marginBottom: '8px' }}>
                  {requestType === 'Urgent Request' ? 'Report Urgent Hazard' : 'File Standard Job Request'}
                </h2>
                <p style={{ fontSize: '14.5px', color: '#475569', lineHeight: 1.6, marginBottom: '6px' }}>
                  The official <strong>QF-PDAS-DC-01</strong> form opens for filing.
                </p>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#475569', fontSize: '12.5px', fontWeight: '600', borderRadius: '9999px', padding: '5px 14px', margin: '10px 0 22px 0' }}>
                  Filing as {currentUser?.name || 'Faculty Requester'} • {currentUser?.department || 'ISAT U Dumangas'}
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '26px' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ padding: '13px 26px', fontSize: '15px', fontWeight: '800' }}
                    onClick={() => setIsStandardOverlayOpen(true)}
                  >
                    <FileText size={17} /> Open Full QF-PDAS-DC-01 Form
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '13px 20px', fontSize: '14px' }}
                    onClick={() => { if (onTabChange) onTabChange('faculty-tickets'); }}
                  >
                    <Clock size={16} /> My Active Tickets
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '13px 20px', fontSize: '14px' }}
                    onClick={() => setIsQrModalOpen(true)}
                    title="Scan a room QR tag to auto-fill the location, then fill the full form"
                  >
                    <QrCode size={16} /> Scan Location QR
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', textAlign: 'left' }}>
                  {[
                    { n: '1', t: 'Fill & review', d: 'Type directly into the full official form.' },
                    { n: '2', t: 'Save / Print', d: 'Submit online, print the QF-PDAS-DC-01 slip.' },
                    { n: '3', t: 'Wet-ink sign', d: 'Supervisor signs the hardcopy for PDAS.' },
                  ].map(s => (
                    <div key={s.n} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 14px' }}>
                      <div style={{ fontSize: '12px', fontWeight: '800', color: '#001f9c' }}>STEP {s.n}</div>
                      <div style={{ fontSize: '13.5px', fontWeight: '700', color: '#0f172a', margin: '2px 0' }}>{s.t}</div>
                      <div style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.5 }}>{s.d}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: MY ACTIVE TICKETS & TRACKING */}
      {(activeTab === 'faculty-tickets' || activeTab === 'my-tickets') && (
        <div className="content-card" style={{ paddingTop: '20px' }}>

          {/* URGENT PENDING STANDARD FORM WARNING BANNER */}
          {activeTickets.some(r => r.urgentPendingStandardForm) && (
            <div style={{
              background: '#fff1f2',
              border: '2px solid #fecdd3',
              borderRadius: '12px',
              padding: '16px 20px',
              margin: '0 24px 20px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              boxShadow: '0 4px 12px rgba(225, 29, 72, 0.1)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: '#ffe4e6',
                  color: '#e11d48',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <AlertTriangle size={22} />
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '800', color: '#9f1239' }}>
                    Action Required: Urgent Request Standard Form Filing
                  </div>
                  <div style={{ fontSize: '12.5px', color: '#881337', marginTop: '2px' }}>
                    You have urgent requests pending full <strong>QF-PDAS-DC-01 Standard Form</strong> details. Please complete within the day.
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  const targetReq = activeTickets.find(r => r.urgentPendingStandardForm);
                  if (targetReq) {
                    setUrgentTargetReq(targetReq);
                    setUrgentModalSupervisor(targetReq.immediateSupervisor || '');
                    setUrgentModalOptions([]);
                    setUrgentModalDesc(targetReq.description || '');
                    setIsUrgentModalOpen(true);
                  }
                }}
                style={{ background: '#e11d48', borderColor: '#be123c', color: '#ffffff', flexShrink: 0, fontWeight: '700' }}
              >
                Complete Standard Form Now
              </button>
            </div>
          )}

          {/* Filter Bar (search lives in the top navbar) */}
          <div style={{
            display: 'flex',
            gap: '12px',
            padding: '0 24px 18px 24px',
            borderBottom: '1px solid #f1f5f9',
            flexWrap: 'wrap',
            alignItems: 'center'
          }}>
            <select
              aria-label="Filter by category"
              className="form-select"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{ height: '38px', fontSize: '12.5px', flex: '1', minWidth: '150px' }}
            >
              <option value="all">All Categories</option>
              <option value="Electrical">Electrical</option>
              <option value="Air Conditioning">Air Conditioning</option>
              <option value="Water/Sanitary">Water/Sanitary</option>
              <option value="Physical Structures">Physical Structures</option>
              <option value="Mechanical">Mechanical</option>
              <option value="Drawing/Design">Drawing/Design</option>
            </select>

            <select
              aria-label="Filter by risk level"
              className="form-select"
              value={urgencyFilter}
              onChange={(e) => setUrgencyFilter(e.target.value)}
              style={{ height: '38px', fontSize: '12.5px', flex: '1', minWidth: '150px' }}
            >
              <option value="all">All Risk Levels</option>
              <option value="High Risk">High Risk</option>
              <option value="Medium Risk">Medium Risk</option>
              <option value="Low Risk">Low Risk</option>
            </select>

              <select
                aria-label="Filter by status"
                className="form-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ height: '38px', fontSize: '12.5px', flex: '1', minWidth: '150px' }}
              >
                <option value="all">All Active Status</option>
                <option value="pending">Pending</option>
                <option value="under-review">Under Review</option>
                <option value="awaiting-signatures">Awaiting Signatures</option>
                <option value="approved">Approved</option>
                <option value="ongoing">Ongoing</option>
                <option value="on-hold">On Hold</option>
              </select>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">TRACKING NO</th>
                  <th scope="col">SUBJECT & LOCATION</th>
                  <th scope="col">CATEGORY</th>
                  <th scope="col">URGENCY</th>
                  <th scope="col">CURRENT STATUS</th>
                  <th scope="col">DATE FILED</th>
                  <th scope="col">ASSIGNED TECH</th>
                  <th scope="col" style={{ textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredActiveTickets.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '48px 16px', color: '#94a3b8' }}>
                      <Clock size={32} style={{ margin: '0 auto 8px auto', opacity: 0.4 }} />
                      <div style={{ fontSize: '14px', fontWeight: '600', color: '#475569' }}>No active tickets matching your criteria</div>
                      <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                        {activeTickets.length === 0 ? 'You currently have no pending or ongoing maintenance requests.' : 'Try changing your search or filter settings.'}
                      </div>
                    </td>
                  </tr>
                ) : (
                  pagedActive.rows.map(req => (
                    <tr key={req.id}>
                      <td style={{ fontWeight: '700', color: '#001f9c' }}>
                        {req.controlNo || req.id}
                      </td>
                      <td>
                        <div style={{ fontWeight: '700', color: '#0f172a' }}>{req.title}</div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>{req.location}</div>
                        {req.replacementFlag?.isFlagged && (
                          <div style={{
                            marginTop: '4px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: '#fef2f2',
                            border: '1px solid #fecaca',
                            color: '#b91c1c',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: '700'
                          }}>
                            <AlertTriangle size={11} />
                            Irreparable Item Flagged (Procurement in Progress)
                          </div>
                        )}
                      </td>
                      <td>
                        <CategoryPill category={req.category} />
                      </td>
                      <td>
                        <UrgencyBadge urgency={req.urgency} />
                      </td>
                      <td>
                        <StatusBadge status={req.status} />
                      </td>
                      <td style={{ fontSize: '12.5px', color: '#64748b' }}>
                        {formatTicketDate(req.date)}
                      </td>
                      <td style={{ fontSize: '12.5px', color: req.assignedTo ? '#0f172a' : '#94a3b8' }}>
                        {req.assignedTo || 'Pending Assignment'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setSelectedTicketDetail(req)}
                            title="View full progress timeline & details"
                          >
                            <Eye size={13} />
                            Details
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => { setSelectedReqForPrint(req); setIsPrintModalOpen(true); }}
                            title="Print official QF-PDAS-DC-01 form"
                          >
                            <Printer size={13} />
                            Slip
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '0 24px 20px 24px' }}>
            <Pagination
              page={pagedActive.safe}
              totalPages={pagedActive.totalPages}
              onPageChange={setTablePage}
              pageSize={tablePageSize}
              total={filteredActiveTickets.length}
              itemLabel="requests"
            />
          </div>
        </div>
      )}

      {/* TAB 3: REQUEST HISTORY & COMPLETED LOGS */}
      {activeTab === 'faculty-history' && (
        <div className="content-card" style={{ paddingTop: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 24px 14px 24px' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleExportCSV}
              title="Export list to CSV for accreditation or records"
            >
              <Download size={14} /> Export CSV
            </button>
          </div>

          {/* Filter Bar (search lives in the top navbar) */}
          <div style={{
            display: 'flex',
            gap: '12px',
            padding: '0 24px 18px 24px',
            borderBottom: '1px solid #f1f5f9',
            flexWrap: 'wrap',
            alignItems: 'center'
          }}>
            <select
              aria-label="Filter by category"
              className="form-select"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{ height: '38px', fontSize: '12.5px', flex: '1', minWidth: '150px' }}
            >
              <option value="all">All Categories</option>
              <option value="Electrical">Electrical</option>
              <option value="Air Conditioning">Air Conditioning</option>
              <option value="Water/Sanitary">Water/Sanitary</option>
              <option value="Physical Structures">Physical Structures</option>
              <option value="Mechanical">Mechanical</option>
              <option value="Drawing/Design">Drawing/Design</option>
            </select>

            <select
              aria-label="Filter by risk level"
              className="form-select"
              value={urgencyFilter}
              onChange={(e) => setUrgencyFilter(e.target.value)}
              style={{ height: '38px', fontSize: '12.5px', flex: '1', minWidth: '150px' }}
            >
              <option value="all">All Risk Levels</option>
              <option value="High Risk">High Risk</option>
              <option value="Medium Risk">Medium Risk</option>
              <option value="Low Risk">Low Risk</option>
            </select>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">TRACKING NO</th>
                  <th scope="col">SUBJECT & LOCATION</th>
                  <th scope="col">CATEGORY</th>
                  <th scope="col">FINAL STATUS</th>
                  <th scope="col">DATE COMPLETED</th>
                  <th scope="col">SERVICED BY</th>
                  <th scope="col">ISO 25010 EVALUATION</th>
                  <th scope="col" style={{ textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistoryTickets.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '48px 16px', color: '#94a3b8' }}>
                      <History size={32} style={{ margin: '0 auto 8px auto', opacity: 0.4 }} />
                      <div style={{ fontSize: '14px', fontWeight: '600', color: '#475569' }}>No completed request history records found</div>
                      <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                        Once pending repairs are finished and closed by the PDAS team, they will appear here.
                      </div>
                    </td>
                  </tr>
                ) : (
                  pagedHistory.rows.map(req => {
                    const evalData = evaluations.find(e => e.reqId === req.id || e.controlNo === req.controlNo);
                    let avgRating = null;
                    if (evalData) {
                      const scores = [evalData.functionalSuitability, evalData.usability, evalData.reliability, evalData.performanceEfficiency].filter(Boolean);
                      avgRating = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : '5.0';
                    }

                    return (
                      <tr key={req.id}>
                        <td style={{ fontWeight: '700', color: '#001f9c' }}>
                          {req.controlNo || req.id}
                        </td>
                        <td>
                          <div style={{ fontWeight: '700', color: '#0f172a' }}>{req.title}</div>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>{req.location}</div>
                        </td>
                        <td>
                          <CategoryPill category={req.category} />
                        </td>
                        <td>
                          <StatusBadge status={req.status} />
                        </td>
                        <td style={{ fontSize: '12.5px', color: '#64748b' }}>
                          {formatTicketDate(req.date)}
                        </td>
                        <td style={{ fontSize: '12.5px', color: '#0f172a', fontWeight: '600' }}>
                          {req.assignedTo || 'PDAS Maintenance Team'}
                        </td>
                        <td>
                          {req.status === 'Completed' ? (
                            evalData ? (
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#047857', padding: '3px 8px', borderRadius: '6px', fontSize: '11.5px', fontWeight: '700' }}>
                                <Star size={12} fill="#047857" /> {avgRating} / 5.0 (Evaluated)
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={() => setEvaluationRequest(req)}
                                style={{ background: '#f59e0b', color: '#0f172a', fontWeight: '700', border: 'none', padding: '3px 10px', fontSize: '11.5px' }}
                              >
                                <Star size={12} /> Rate Service
                              </button>
                            )
                          ) : (
                            <span style={{ fontSize: '12px', color: '#94a3b8' }}>N/A ({req.status})</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '6px' }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => setSelectedTicketDetail(req)}
                            >
                              <Eye size={13} /> Details
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => { setSelectedReqForPrint(req); setIsPrintModalOpen(true); }}
                            >
                              <Printer size={13} /> Slip
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '0 24px 20px 24px' }}>
            <Pagination
              page={pagedHistory.safe}
              totalPages={pagedHistory.totalPages}
              onPageChange={setTablePage}
              pageSize={tablePageSize}
              total={filteredHistoryTickets.length}
              itemLabel="requests"
            />
          </div>
        </div>
      )}

      {/* TAB 4: DIRECT MESSAGING DESK */}
      {(activeTab === 'faculty-messages' || activeTab === 'messages') && (
        <div className="content-card" style={{ padding: '24px' }}>
          <h2 className="card-title" style={{ marginBottom: '16px' }}>Direct Communication Desk with PDAS</h2>
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '20px',
            minHeight: '300px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            marginBottom: '16px'
          }}>
            {messages[0]?.thread?.map((t, idx) => (
              <div
                key={idx}
                style={{
                  alignSelf: t.sender.includes('Director') ? 'flex-start' : 'flex-end',
                  maxWidth: '75%',
                  background: t.sender.includes('Director') ? '#ffffff' : '#001f9c',
                  color: t.sender.includes('Director') ? '#0f172a' : '#ffffff',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  border: t.sender.includes('Director') ? '1px solid #e2e8f0' : 'none',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}
              >
                <div style={{ fontSize: '11px', color: t.sender.includes('Director') ? '#64748b' : '#bfdbfe', marginBottom: '4px' }}>
                  {t.sender} • {t.time}
                </div>
                <div style={{ fontSize: '13px', lineHeight: 1.5 }}>
                  {t.text}
                </div>
              </div>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (msgText.trim()) {
                sendMessage(messages[0]?.id || 'msg_001', msgText, currentUser?.name || 'Faculty Member');
                setMsgText('');
              }
            }}
            style={{ display: 'flex', gap: '10px' }}
          >
            <input
              type="text"
              className="form-input"
              placeholder="Send a message or query to PDAS Director & Maintenance Dispatch..."
              value={msgText}
              onChange={(e) => setMsgText(e.target.value)}
              style={{ flex: 1 }}
            />
            <button type="submit" className="btn btn-primary">
              <Send size={15} /> Send Message
            </button>
          </form>
        </div>
      )}

      {/* Interactive Ticket Details & Progress Stepper Modal */}
      <Modal
        isOpen={Boolean(selectedTicketDetail)}
        onClose={() => setSelectedTicketDetail(null)}
        title={`Request Details: ${selectedTicketDetail?.controlNo || selectedTicketDetail?.id || ''}`}
        maxWidth="680px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setSelectedTicketDetail(null)}
            >
              Close
            </button>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  setSelectedReqForPrint(selectedTicketDetail);
                  setIsPrintModalOpen(true);
                }}
              >
                <Printer size={14} /> Print Official Slip (PDF)
              </button>
            </div>
          </div>
        }
      >
        {selectedTicketDetail && (
          <div>
            {/* Visual Lifecycle Stepper */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '20px'
            }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', marginBottom: '14px' }}>
                Request Lifecycle Progress
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', textAlign: 'center' }}>
                {[
                  { step: 1, label: '1. Request Filed', done: true, active: false },
                  { step: 2, label: '2. Under Review', done: ['Under Review', 'Awaiting Signatures', 'Approved', 'In Progress', 'Ongoing', 'On Hold', 'Completed'].includes(selectedTicketDetail.status), active: selectedTicketDetail.status === 'Under Review' },
                  { step: 3, label: '3. Approved & Assigned', done: ['Approved', 'In Progress', 'Ongoing', 'On Hold', 'Completed'].includes(selectedTicketDetail.status), active: selectedTicketDetail.status === 'Approved' || selectedTicketDetail.status === 'In Progress' || selectedTicketDetail.status === 'Ongoing' || selectedTicketDetail.status === 'On Hold' },
                  { step: 4, label: '4. Serviced & Closed', done: selectedTicketDetail.status === 'Completed', active: false }
                ].map(s => (
                  <div key={s.step} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      background: s.done ? '#059669' : '#e2e8f0',
                      color: s.done ? '#ffffff' : '#64748b',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      fontWeight: '700',
                      marginBottom: '6px'
                    }}>
                      {s.done ? <Check size={14} /> : s.step}
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: s.done ? '700' : '500', color: s.done ? '#0f172a' : '#94a3b8' }}>
                      {s.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Meta Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px', marginBottom: '16px' }}>
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>Subject:</span>
                <div style={{ fontWeight: '700', color: '#0f172a' }}>{selectedTicketDetail.title}</div>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>Facility Location:</span>
                <div style={{ fontWeight: '600', color: '#0f172a' }}>{selectedTicketDetail.location}</div>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>Category:</span>
                <div><CategoryPill category={selectedTicketDetail.category} /></div>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>Urgency Level:</span>
                <div><UrgencyBadge urgency={selectedTicketDetail.urgency} /></div>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>Current Status:</span>
                <div><StatusBadge status={selectedTicketDetail.status} /></div>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>Assigned Technician:</span>
                <div style={{ fontWeight: '600', color: '#001f9c' }}>{selectedTicketDetail.assignedTo || 'Pending Dispatch'}</div>
              </div>
            </div>

            {/* Problem Description */}
            <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', marginBottom: '16px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '11.5px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
                Problem Scope & Detailed Description:
              </div>
              <div style={{ fontSize: '13px', color: '#1e293b', lineHeight: 1.5 }}>
                {selectedTicketDetail.description}
              </div>
            </div>

            {/* Photo Attachment Preview if available */}
            {selectedTicketDetail.photoUrl && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '11.5px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Attached Defect Photo:
                </div>
                <img
                  src={selectedTicketDetail.photoUrl}
                  alt="Defect visual evidence"
                  style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '10px', border: '1px solid #cbd5e1' }}
                />
              </div>
            )}

            {selectedTicketDetail.completionPhotoUrl && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '11.5px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Completion Photo (Technician):
                </div>
                <img
                  src={selectedTicketDetail.completionPhotoUrl}
                  alt="Completed work evidence"
                  style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '10px', border: '1px solid #cbd5e1' }}
                />
              </div>
            )}

            {/* Irreparable / Replacement Notice if flagged */}
            {selectedTicketDetail.replacementFlag?.isFlagged && (
              <div style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '10px',
                padding: '12px 16px',
                color: '#991b1b',
                fontSize: '12.5px'
              }}>
                <div style={{ fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <AlertTriangle size={15} color="#dc2626" />
                  Irreparable Item Flagged for Replacement
                </div>
                <div><strong>Technician Reason:</strong> {selectedTicketDetail.replacementFlag.reason}</div>
                <div><strong>Recommended Unit:</strong> {selectedTicketDetail.replacementFlag.itemSpecs}</div>
                <div style={{ marginTop: '4px', fontSize: '11.5px', color: '#b91c1c' }}>
                  Procurement Stage: <strong>{selectedTicketDetail.replacementFlag.procurementStatus || 'Pending Director PR Approval'}</strong>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ISO/IEC 25010 Evaluation Modal */}
      <Modal
        isOpen={Boolean(evaluationRequest)}
        onClose={() => setEvaluationRequest(null)}
        title={`ISO/IEC 25010 Service Evaluation: ${evaluationRequest?.controlNo || evaluationRequest?.id || ''}`}
        maxWidth="640px"
      >
        {evaluationRequest && (
          <EvaluationForm
            request={evaluationRequest}
            requesterName={currentUser?.name}
            submitEvaluation={submitEvaluation}
            onSubmitted={() => setEvaluationRequest(null)}
          />
        )}
      </Modal>

      {/* QR Scanner Modal */}
      <QrCodeScannerModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        onScanSuccess={handleQrScanSuccess}
      />

      {/* Official Document Print Modal — print-safe sheet */}
      <Modal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        title="Official PDAS Job Request Form (QF-PDAS-DC-01)"
        maxWidth="760px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              Tracking issued only on Final Approval • {selectedReqForPrint?.controlNo || 'PENDING'}
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setIsPrintModalOpen(false)}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => window.print()}
              >
                <Printer size={15} />
                Print / Save PDF
              </button>
            </div>
          </div>
        }
      >
        {selectedReqForPrint && (
          <JobRequestPrintSheet req={selectedReqForPrint} />
        )}
      </Modal>
      {selectedReqForPrint && (
        <div className="jr-print-only" aria-hidden="true">
          <JobRequestPrintSheet req={selectedReqForPrint} />
        </div>
      )}

      {/* Editable Standard Form overlay (all fields editable before submit/print) */}
      <JobRequestFormOverlay
        isOpen={isStandardOverlayOpen}
        onClose={() => setIsStandardOverlayOpen(false)}
        initialReq={overlayDraft()}
        allowActionTaken={false}
        allowFinalAction={false}
        title={requestType === 'Urgent Request' ? 'Urgent Hazard Report (QF-PDAS-DC-01) — Review & Edit Before Dispatch' : 'Standard Job Request (QF-PDAS-DC-01) — Review & Edit Before Submit'}
        onSave={(edited) => createFromOverlay(edited, false)}
        onSaveAndPrint={(edited) => createFromOverlay(edited, true)}
      />

      {/* Urgent Request Standard Form Completion Modal */}
      <Modal
        isOpen={isUrgentModalOpen}
        onClose={() => setIsUrgentModalOpen(false)}
        title="Complete Standard Form (QF-PDAS-DC-01) for Urgent Request"
        maxWidth="640px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsUrgentModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                if (urgentTargetReq) {
                  const updatedScope = buildScopeOfWorks(urgentTargetReq.category, urgentModalOptions, urgentModalDesc);
                  completeStandardFormForUrgent(urgentTargetReq.id, {
                    immediateSupervisor: urgentModalSupervisor,
                    scopeOfWorks: updatedScope
                  });
                  setIsUrgentModalOpen(false);
                }
              }}
            >
              Submit Official Standard Form
            </button>
          </div>
        }
      >
        {urgentTargetReq && (
          <div>
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '12px', marginBottom: '16px', fontSize: '13px', color: '#1e40af' }}>
              <strong>Tracking Number:</strong> {urgentTargetReq.controlNo || urgentTargetReq.id}<br />
              <strong>Urgent Subject:</strong> {urgentTargetReq.title}<br />
              <strong>Location:</strong> {urgentTargetReq.location}
            </div>

            <div className="form-group">
              <label className="form-label">Immediate Supervisor Name *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Dr. Maria Santos / Department Chair"
                value={urgentModalSupervisor}
                onChange={(e) => setUrgentModalSupervisor(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Scope Options for {urgentTargetReq.category}:</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                {(
                  urgentTargetReq.category === 'Drawing/Design' ? ['Floor Plans', 'Detailed Drawings', 'Perspective', 'Specifications', 'List of Materials', 'Other Services'] :
                  urgentTargetReq.category === 'Physical Structures' ? ['New Structure', 'Rehabilitation/Repair', 'Renovation', 'Partial', 'Full', 'Other Services'] :
                  ['New Installation', 'Repair', 'Rehabilitation', 'Other Services']
                ).map(opt => (
                  <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={urgentModalOptions.includes(opt)}
                      onChange={(e) => {
                        if (e.target.checked) setUrgentModalOptions(prev => [...prev, opt]);
                        else setUrgentModalOptions(prev => prev.filter(o => o !== opt));
                      }}
                    />
                    {opt}
                  </label>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Complete Work Description:</label>
              <textarea
                className="form-textarea"
                value={urgentModalDesc}
                onChange={(e) => setUrgentModalDesc(e.target.value)}
                rows={3}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

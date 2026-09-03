import React, { useState } from 'react';
import { 
  Plus, 
  QrCode, 
  Upload, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  FileText, 
  Printer, 
  Eye, 
  MapPin, 
  Building, 
  Send, 
  MessageSquare,
  ShieldCheck,
  UserCheck,
  Zap,
  AlertCircle,
  History,
  Folder,
  Calendar as CalendarIcon
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { StatusBadge, UrgencyBadge, CategoryPill } from '../components/common/StatusBadge';
import { Modal } from '../components/common/Modal';
import { QrCodeScannerModal } from '../components/common/QrCodeScannerModal';
import { CommunicationBox } from './CommunicationBox';
import { PreventiveCalendar } from './PreventiveCalendar';
import { OfficialDocuments } from './OfficialDocuments';
import fixitLogo from '../assets/fixit-logo.png';

export const FacultyStaffPortal = ({ activeTab = 'faculty-submit', onTabChange }) => {
  const { currentUser } = useAuth();
  const { requisitions, addRequisition, messages, sendMessage } = useData();

  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [selectedReqForPrint, setSelectedReqForPrint] = useState(null);
  const [submittedSuccess, setSubmittedSuccess] = useState(null);

  // Cascading Location Hierarchy
  const CAMPUS_BUILDINGS = [
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

  // Form State
  const [selectedBuilding, setSelectedBuilding] = useState(CAMPUS_BUILDINGS[0].name);
  const [selectedFloor, setSelectedFloor] = useState(CAMPUS_BUILDINGS[0].floors[0].floor);
  const [selectedRoom, setSelectedRoom] = useState(CAMPUS_BUILDINGS[0].floors[0].rooms[0]);
  const [qrScannedTag, setQrScannedTag] = useState('');

  const [category, setCategory] = useState('Electrical');
  const [urgency, setUrgency] = useState('Medium');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [requestType, setRequestType] = useState('Standard Request');
  const [pdasFormFile, setPdasFormFile] = useState(null);

  // Messaging State
  const [msgText, setMsgText] = useState('');

  // Handle building change
  const handleBuildingChange = (bldgName) => {
    setSelectedBuilding(bldgName);
    const bldg = CAMPUS_BUILDINGS.find(b => b.name === bldgName);
    if (bldg && bldg.floors.length > 0) {
      setSelectedFloor(bldg.floors[0].floor);
      setSelectedRoom(bldg.floors[0].rooms[0]);
    }
  };

  const handleFloorChange = (floorName) => {
    setSelectedFloor(floorName);
    const bldg = CAMPUS_BUILDINGS.find(b => b.name === selectedBuilding);
    const flr = bldg?.floors.find(f => f.floor === floorName);
    if (flr && flr.rooms.length > 0) {
      setSelectedRoom(flr.rooms[0]);
    }
  };

  // QR Scan Handler
  const handleQrScanSuccess = (scanData) => {
    setQrScannedTag(scanData.qrCodeRef);
    setSelectedBuilding(scanData.building);
    setSelectedFloor(scanData.floor);
    setSelectedRoom(scanData.room);
  };

  // Photo change
  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Submit Job Request
  const handleSubmitJobRequest = (e) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    if (requestType === 'Standard Request' && !pdasFormFile) return;

    const newReq = addRequisition({
      title,
      description,
      building: selectedBuilding,
      floor: selectedFloor,
      room: selectedRoom,
      location: `${selectedBuilding} - ${selectedRoom}`,
      qrCodeRef: qrScannedTag || `ISATU-${selectedRoom.replace(/\s+/g, '-').slice(0, 10).toUpperCase()}`,
      category,
      urgency,
      requestType,
      pdasFormName: pdasFormFile?.name || '',
      requestedBy: currentUser?.name || 'Faculty Requisitioner',
      requesterEmail: currentUser?.email || 'faculty@dumangas.isatu.edu.ph',
      requesterRole: currentUser?.role === 'staff' ? 'Staff' : 'Faculty',
      department: currentUser?.department || 'ISAT U Dumangas',
      contactNumber: currentUser?.phone || '+63 9XX XXX XXXX',
      idNumber: currentUser?.idNumber || 'ISATU-EMP-000',
      photoUrl: photoPreview || 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=500&auto=format&fit=crop&q=60'
    });

    setSubmittedSuccess(newReq);
    setSelectedReqForPrint(newReq);
    setTitle('');
    setDescription('');
    setPhotoFile(null);
    setPhotoPreview(null);
    setPdasFormFile(null);
    setQrScannedTag('');
  };

  // Requisition Partitioning
  const myTickets = requisitions.filter(r => 
    (currentUser?.email && r.requesterEmail?.toLowerCase() === currentUser.email.toLowerCase()) ||
    (currentUser?.name && r.requestedBy?.toLowerCase().includes(currentUser.name.toLowerCase()))
  );
  const activeTickets = myTickets.filter(r => r.status !== 'Completed' && r.status !== 'Rejected');
  const completedTickets = myTickets.filter(r => r.status === 'Completed' || r.status === 'Rejected');

  const activeFloors = CAMPUS_BUILDINGS.find(b => b.name === selectedBuilding)?.floors || [];
  const activeRooms = activeFloors.find(f => f.floor === selectedFloor)?.rooms || [];

  // Direct tab delegators for Campus Calendar, Official Docs, and Messages
  if (activeTab === 'faculty-calendar') {
    return <PreventiveCalendar />;
  }

  if (activeTab === 'faculty-documents') {
    return <OfficialDocuments />;
  }

  if (activeTab === 'faculty-messages') {
    return <CommunicationBox />;
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '40px' }}>
      {/* Verified Institutional Requisitioner Profile Card */}
      <div style={{
        background: 'linear-gradient(135deg, #001f9c 0%, #0f3ba2 100%)',
        color: '#ffffff',
        borderRadius: '16px',
        padding: '24px 28px',
        marginBottom: '24px',
        boxShadow: '0 8px 24px rgba(0, 31, 156, 0.18)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '60px',
            height: '60px',
            borderRadius: '14px',
            background: 'rgba(255, 255, 255, 0.15)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px',
            fontWeight: '800'
          }}>
            {currentUser?.role === 'staff' ? '💼' : '🎓'}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px', fontWeight: '800' }}>
                {currentUser?.name || 'Dr. Elena Ramos'}
              </span>
              <span style={{
                background: 'rgba(16, 185, 129, 0.25)',
                border: '1px solid rgba(16, 185, 129, 0.5)',
                color: '#6ee7b7',
                fontSize: '11px',
                fontWeight: '700',
                padding: '2px 8px',
                borderRadius: '12px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <ShieldCheck size={12} /> Verified Profile
              </span>
            </div>
            <div style={{ fontSize: '13px', color: '#cbd5e1', marginTop: '3px' }}>
              {currentUser?.roleTitle || currentUser?.department} • ID: <strong>{currentUser?.idNumber || 'ISATU-EMP-2024'}</strong>
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
              Email: {currentUser?.email} • Contact: {currentUser?.phone}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => onTabChange ? onTabChange('faculty-tickets') : null}
            style={{ 
              background: (activeTab === 'faculty-tickets' || activeTab === 'my-tickets') ? '#ffffff' : 'rgba(255, 255, 255, 0.15)', 
              color: (activeTab === 'faculty-tickets' || activeTab === 'my-tickets') ? '#001f9c' : '#ffffff', 
              border: '1px solid rgba(255, 255, 255, 0.3)',
              fontWeight: '700'
            }}
          >
            <Clock size={14} />
            My Active Tickets ({activeTickets.length})
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => { 
              if (onTabChange) onTabChange('faculty-submit'); 
              setSubmittedSuccess(null); 
            }}
            style={{ 
              background: '#f59e0b', 
              color: '#0f172a', 
              fontWeight: '700', 
              border: 'none' 
            }}
          >
            <Plus size={14} />
            File New Job Request
          </button>
        </div>
      </div>

      {/* TAB 1: SUBMIT JOB REQUEST */}
      {(activeTab === 'faculty-submit' || activeTab === 'submit') && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px' }}>
          {/* Main Form Card */}
          <div className="content-card" style={{ padding: '28px' }}>
            {submittedSuccess ? (
              <div style={{ textAlign: 'center', padding: '32px 16px' }}>
                <div style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: '#ecfdf5',
                  color: '#059669',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '16px'
                }}>
                  <CheckCircle2 size={36} />
                </div>
                <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#0f172a', marginBottom: '8px' }}>
                  Job Request Filed Successfully!
                </h2>
                <div style={{ fontSize: '15px', color: '#001f9c', fontWeight: '800', marginBottom: '12px' }}>
                  Control No: {submittedSuccess.controlNo}
                </div>
                <p style={{ fontSize: '13.5px', color: '#475569', maxWidth: '520px', margin: '0 auto 24px auto', lineHeight: 1.5 }}>
                  Your request has been logged into the central PDAS database. Emergency & High Risk requests are automatically prioritized on the Director dashboard.
                </p>

                <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setIsPrintModalOpen(true)}
                  >
                    <Printer size={16} />
                    View & Print Official PDAS Job Request Form (PDF)
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
              <form onSubmit={handleSubmitJobRequest}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', borderBottom: '1px solid #f1f5f9', paddingBottom: '14px' }}>
                  <div>
                    <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
                      Physical Development & Auxiliary Services (PDAS) Form F-01
                    </h2>
                    <p style={{ fontSize: '12.5px', color: '#64748b', marginTop: '2px' }}>
                      Complete maintenance request specification for campus facility repairs
                    </p>
                  </div>

                  {/* QR Code Quick Scan Trigger */}
                  <button
                    type="button"
                    onClick={() => setIsQrModalOpen(true)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 14px',
                      background: '#eff6ff',
                      border: '1.5px solid #001f9c',
                      borderRadius: '8px',
                      color: '#001f9c',
                      fontWeight: '700',
                      fontSize: '12.5px',
                      cursor: 'pointer'
                    }}
                  >
                    <QrCode size={16} />
                    Scan Room QR Code
                  </button>
                </div>

                {qrScannedTag && (
                  <div style={{
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    borderRadius: '10px',
                    padding: '10px 14px',
                    marginBottom: '18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '12.5px',
                    color: '#1e40af'
                  }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <CheckCircle2 size={15} color="#059669" />
                      Location auto-filled via QR tag: <strong>{qrScannedTag}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => setQrScannedTag('')}
                      style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '11px', textDecoration: 'underline' }}
                    >
                      Reset to Manual Dropdown
                    </button>
                  </div>
                )}

                {/* 1. Location Capture (Cascading Building -> Floor -> Room) */}
                <div style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '16px',
                  marginBottom: '20px'
                }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <MapPin size={14} color="#001f9c" />
                    Facility Location Selection (Cascading Hierarchy)
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                    <div>
                      <label className="form-label" style={{ fontSize: '12px' }}>Building / Facility *</label>
                      <select
                        className="form-select"
                        value={selectedBuilding}
                        onChange={(e) => handleBuildingChange(e.target.value)}
                        required
                      >
                        {CAMPUS_BUILDINGS.map(b => (
                          <option key={b.name} value={b.name}>{b.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="form-label" style={{ fontSize: '12px' }}>Floor / Level *</label>
                      <select
                        className="form-select"
                        value={selectedFloor}
                        onChange={(e) => handleFloorChange(e.target.value)}
                        required
                      >
                        {activeFloors.map(f => (
                          <option key={f.floor} value={f.floor}>{f.floor}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="form-label" style={{ fontSize: '12px' }}>Room / Area Designation *</label>
                      <select
                        className="form-select"
                        value={selectedRoom}
                        onChange={(e) => setSelectedRoom(e.target.value)}
                        required
                      >
                        {activeRooms.map(r => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* 2. Category & Request Type */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '18px' }}>
                  <div className="form-group">
                    <label className="form-label">Maintenance Category *</label>
                    <select
                      className="form-select"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      required
                    >
                      <option value="Electrical">Electrical (Power, Lights, Outlets, Wiring)</option>
                      <option value="HVAC / Aircon">HVAC / Aircon (Inverter, Split, Window Units)</option>
                      <option value="Plumbing">Plumbing (Pipes, Valves, Faucets, Drainage)</option>
                      <option value="Carpentry">Carpentry (Tables, Doors, Cabinets, Partitions)</option>
                      <option value="IT / Network">IT / Network (Cabling, Rack, Data Outlets)</option>
                      <option value="Painting & Masonry">Painting & Masonry (Wall cracks, plaster)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Request Type *</label>
                    <select
                      className="form-select"
                      value={requestType}
                      onChange={(e) => { setRequestType(e.target.value); setUrgency(e.target.value === 'Emergency Request' ? 'Emergency' : 'Medium'); setPdasFormFile(e.target.value === 'Emergency Request' ? null : pdasFormFile); }}
                      required
                    >
                      <option value="Standard Request">Standard Request</option>
                      <option value="Emergency Request">Emergency Request</option>
                    </select>
                  </div>
                </div>

                {requestType === 'Standard Request' && (
                  <div className="form-group">
                    <label className="form-label">Attach PDAS Form *</label>
                    <input type="file" className="form-input" accept=".pdf,.doc,.docx,image/*" onChange={(e) => setPdasFormFile(e.target.files[0] || null)} required />
                  </div>
                )}

                {/* 3. Title & Description */}
                <div className="form-group">
                  <label className="form-label">Issue Summary / Subject *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Wall outlet sparked, defective breaker & ceiling fan vibration"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Detailed Description of Problem & Location Specifics *</label>
                  <textarea
                    className="form-textarea"
                    placeholder="Provide specific details: equipment number, when it started, observed risks, and impact on students/staff..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    style={{ minHeight: '90px' }}
                    required
                  />
                </div>

                {/* 4. Optional Photo Attachment */}
                <div className="form-group">
                  <label className="form-label">Optional Photo Attachment of Defect</label>
                  <div style={{
                    border: '2px dashed #cbd5e1',
                    borderRadius: '10px',
                    padding: '16px',
                    textAlign: 'center',
                    background: '#f8fafc',
                    position: 'relative',
                    cursor: 'pointer'
                  }}>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoChange}
                      style={{
                        position: 'absolute',
                        inset: 0,
                        opacity: 0,
                        cursor: 'pointer',
                        width: '100%',
                        height: '100%'
                      }}
                    />
                    {photoPreview ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px' }}>
                        <img
                          src={photoPreview}
                          alt="Fault defect preview"
                          style={{ width: '80px', height: '52px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                        />
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>
                            {photoFile ? photoFile.name : 'Defect_Photo.jpg'}
                          </div>
                          <div style={{ fontSize: '11.5px', color: '#059669', fontWeight: '600' }}>
                            ✓ Photo attached (Click to replace)
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <Upload size={20} color="#001f9c" style={{ margin: '0 auto 4px auto' }} />
                        <div style={{ fontSize: '12.5px', fontWeight: '600', color: '#334155' }}>
                          Upload photo of damaged equipment or room defect
                        </div>
                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>PNG, JPG, JPEG up to 10MB</div>
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ padding: '10px 24px', fontSize: '14px' }}
                  >
                    <Send size={16} />
                    Submit Requisition to PDAS
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Right Sidebar: Profile Summary & Guidelines */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Auto-filled Requester Info Card */}
            <div className="content-card" style={{ padding: '20px' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#001f9c', textTransform: 'uppercase', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <UserCheck size={16} />
                Requisitioner Profile (Auto-filled)
              </div>
              <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div>
                  <span style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>Full Name:</span>
                  <div style={{ fontWeight: '700', color: '#0f172a' }}>{currentUser?.name}</div>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>Institutional ID:</span>
                  <div style={{ fontWeight: '600', color: '#334155' }}>{currentUser?.idNumber}</div>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>Department / Office:</span>
                  <div style={{ fontWeight: '600', color: '#334155' }}>{currentUser?.department}</div>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>Contact Mobile:</span>
                  <div style={{ fontWeight: '600', color: '#334155' }}>{currentUser?.phone}</div>
                </div>
              </div>
            </div>

            {/* PDAS Maintenance Protocol Notice */}
            <div className="content-card" style={{ padding: '20px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#0f172a', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Zap size={15} color="#d97706" />
                PDAS Turnaround SLAs
              </div>
              <ul style={{ fontSize: '12px', color: '#475569', paddingLeft: '16px', lineHeight: 1.6, margin: 0 }}>
                <li><strong>Emergency / High:</strong> 1-2 hours initial response on-site.</li>
                <li><strong>Standard Maintenance:</strong> 24-48 hours resolution SLA.</li>
                <li>All jobs generate an official printable PDAS Form F-01.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MY ACTIVE TICKETS & TRACKING */}
      {(activeTab === 'faculty-tickets' || activeTab === 'my-tickets') && (
        <div className="content-card">
          <div className="card-header">
            <h2 className="card-title">My Active Facility Requisitions ({activeTickets.length})</h2>
            <span style={{ fontSize: '12.5px', color: '#64748b' }}>
              Real-time progression updates from PDAS Director & Maintenance Crew
            </span>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>CONTROL NO</th>
                  <th>SUBJECT & LOCATION</th>
                  <th>CATEGORY</th>
                  <th>URGENCY</th>
                  <th>CURRENT STATUS</th>
                  <th>DATE FILED</th>
                  <th>ASSIGNED TECH</th>
                  <th style={{ textAlign: 'right' }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {activeTickets.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                      You have no active pending or ongoing facility requisitions.
                    </td>
                  </tr>
                ) : (
                  activeTickets.map(req => (
                    <tr key={req.id}>
                      <td style={{ fontWeight: '700', color: '#001f9c' }}>
                        {req.controlNo}
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
                            padding: '2px 6px',
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
                        {req.date}
                      </td>
                      <td style={{ fontSize: '12.5px', color: req.assignedTo ? '#0f172a' : '#94a3b8' }}>
                        {req.assignedTo || 'Pending Assignment'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => { setSelectedReqForPrint(req); setIsPrintModalOpen(true); }}
                        >
                          <Printer size={13} />
                          Print Slip
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: REQUISITION HISTORY & COMPLETED LOGS */}
      {activeTab === 'faculty-history' && (
        <div className="content-card">
          <div className="card-header">
            <h2 className="card-title">Completed & Serviced Requisitions History ({completedTickets.length})</h2>
            <span style={{ fontSize: '12.5px', color: '#64748b' }}>
              Historical record of serviced work orders, official sign-offs, and maintenance logs
            </span>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>CONTROL NO</th>
                  <th>SUBJECT & LOCATION</th>
                  <th>CATEGORY</th>
                  <th>URGENCY</th>
                  <th>FINAL STATUS</th>
                  <th>DATE COMPLETED</th>
                  <th>SERVICED BY</th>
                  <th style={{ textAlign: 'right' }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {completedTickets.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                      No completed requisition history records found yet.
                    </td>
                  </tr>
                ) : (
                  completedTickets.map(req => (
                    <tr key={req.id}>
                      <td style={{ fontWeight: '700', color: '#001f9c' }}>
                        {req.controlNo}
                      </td>
                      <td>
                        <div style={{ fontWeight: '700', color: '#0f172a' }}>{req.title}</div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>{req.location}</div>
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
                        {req.date}
                      </td>
                      <td style={{ fontSize: '12.5px', color: '#0f172a', fontWeight: '600' }}>
                        {req.assignedTo || 'PDAS Maintenance Team'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => { setSelectedReqForPrint(req); setIsPrintModalOpen(true); }}
                        >
                          <Printer size={13} />
                          Print Slip
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: MESSAGES WITH PDAS */}
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
            {messages[0]?.thread.map((t, idx) => (
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

      {/* QR Scanner Modal */}
      <QrCodeScannerModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        onScanSuccess={handleQrScanSuccess}
      />

      {/* Official Document Print Modal */}
      <Modal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        title="Official PDAS Job Request Form (PDAS-F01)"
        maxWidth="760px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              ISAT U Dumangas Quality Management System (ISO 9001:2015 Compliant)
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
          <div style={{
            background: '#ffffff',
            border: '2px solid #0f172a',
            padding: '32px 28px',
            borderRadius: '4px',
            fontFamily: 'serif',
            color: '#000000'
          }}>
            {/* University & PDAS Official Header */}
            <div style={{ borderBottom: '2px solid #000000', paddingBottom: '16px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                <div style={{ width: '64px', height: '64px', flexShrink: 0 }}>
                  <img 
                    src={fixitLogo} 
                    alt="PDAS Logo" 
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    onError={(e) => { e.target.src = '/fixit-logo.png'; }}
                  />
                </div>

                <div style={{ textAlign: 'center', flex: 1 }}>
                  <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Republic of the Philippines</div>
                  <div style={{ fontSize: '17px', fontWeight: 'bold', textTransform: 'uppercase', color: '#001f9c' }}>
                    Iloilo Science and Technology University
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: '600' }}>DUMANGAS CAMPUS</div>
                  <div style={{ fontSize: '12px', fontStyle: 'italic', marginTop: '2px' }}>
                    ISAT U DUMANGAS CAMPUS 2026
                  </div>
                </div>

                <div style={{ textAlign: 'right', width: '64px', fontSize: '10px', color: '#64748b' }}>
                  <div style={{ fontWeight: 'bold', color: '#001f9c' }}>ISO 9001</div>
                  <div>Certified</div>
                </div>
              </div>

              <div style={{ textAlign: 'center', fontSize: '15px', fontWeight: 'bold', textTransform: 'uppercase', marginTop: '14px', letterSpacing: '0.08em', textDecoration: 'underline' }}>
                OFFICIAL FACILITY JOB REQUEST FORM (PDAS-F01)
              </div>
            </div>

            {/* Document Details Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px', marginBottom: '20px' }}>
              <div><strong>CONTROL NO:</strong> {selectedReqForPrint.controlNo}</div>
              <div><strong>DATE FILED:</strong> {selectedReqForPrint.date}</div>
              <div><strong>LOCATION:</strong> {selectedReqForPrint.location}</div>
              <div><strong>CATEGORY:</strong> {selectedReqForPrint.category}</div>
              <div><strong>URGENCY LEVEL:</strong> {selectedReqForPrint.urgency}</div>
              <div><strong>STATUS:</strong> {selectedReqForPrint.status}</div>
              <div><strong>REQUISITIONER:</strong> {selectedReqForPrint.requestedBy}</div>
              <div><strong>DEPARTMENT / OFFICE:</strong> {selectedReqForPrint.department}</div>
              <div><strong>ASSIGNED TECHNICIAN:</strong> {selectedReqForPrint.assignedTo || 'PDAS Technical Crew (Pending Dispatch)'}</div>
            </div>

            {/* Description & Scope */}
            <div style={{ border: '1px solid #000000', padding: '14px', marginBottom: '24px', fontSize: '13px' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>PROBLEM SPECIFICATION & SCOPE:</div>
              <div>{selectedReqForPrint.title}</div>
              <div style={{ marginTop: '6px', color: '#222222', fontStyle: 'italic' }}>{selectedReqForPrint.description}</div>
              {selectedReqForPrint.notes && (
                <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed #666666' }}>
                  <strong>Director / Dispatch Remarks:</strong> {selectedReqForPrint.notes}
                </div>
              )}
            </div>

            {/* Signatures */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', textAlign: 'center', marginTop: '40px', fontSize: '12px' }}>
              <div>
                <div style={{ borderBottom: '1px solid #000000', paddingBottom: '4px', fontWeight: 'bold' }}>{selectedReqForPrint.requestedBy}</div>
                <div style={{ marginTop: '4px' }}>Requisitioner (Faculty/Staff)</div>
              </div>
              <div>
                <div style={{ borderBottom: '1px solid #000000', paddingBottom: '4px', fontWeight: 'bold' }}>{selectedReqForPrint.assignedTo || 'Assigned Technician'}</div>
                <div style={{ marginTop: '4px' }}>PDAS Technical Specialist</div>
              </div>
              <div>
                <div style={{ borderBottom: '1px solid #000000', paddingBottom: '4px', fontWeight: 'bold' }}>ENGR. REYNALDO BAUTISTA</div>
                <div style={{ marginTop: '4px' }}>PDAS Director (Approved)</div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

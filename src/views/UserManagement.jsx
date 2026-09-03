import React, { useState } from 'react';
import { 
  Users, 
  Plus,
  UserPlus, 
  Shield, 
  Check, 
  X, 
  Search, 
  Mail, 
  Phone, 
  FileCheck, 
  Eye, 
  CheckCircle2, 
  XCircle, 
  Upload, 
  IdCard,
  GraduationCap,
  Briefcase,
  Wrench,
  AlertTriangle,
  FileWarning
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { Modal } from '../components/common/Modal';
import { RegisterModal } from '../components/auth/RegisterModal';

export const UserManagement = () => {
  const { 
    users, 
    pendingRegistrations, 
    pendingRegistrationsCount, 
    rejectedRegistrations,
    approveRegistration, 
    rejectRegistration,
    createMaintenanceUser, 
    toggleUserStatus,
    updateUser,
    removeUser,
    offices,
    departments,
    addOffice,
    addDepartment
  } = useData();

  const [activeTab, setActiveTab] = useState('verified'); // 'verified' | 'pending-id' | 'rejected-logs'
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  
  // Maintenance creation modal
  const [isTechModalOpen, setIsTechModalOpen] = useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [techForm, setTechForm] = useState({
    firstName: '',
    lastName: '',
    middleName: '',
    email: '',
    phone: '',
    specialization: 'Electrical & HVAC',
    password: 'tech123',
    idNumber: ''
  });

  // Rejection modal
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [targetRejectReg, setTargetRejectReg] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('Blurry and unreadable ID photo attachment. Please re-submit a high-resolution photo.');

  // Inspect Modal
  const [selectedPendingReg, setSelectedPendingReg] = useState(null);
  const [isInspectModalOpen, setIsInspectModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', department: '', designation: '', phone: '' });
  const [newOffice, setNewOffice] = useState('');
  const [newDepartment, setNewDepartment] = useState('');

  const filteredUsers = users.filter(u => {
    const fullName = `${u.firstName || ''} ${u.middleName || ''} ${u.lastName || ''} ${u.name || ''}`;
    const matchesSearch = 
      fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.email && u.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (u.department && u.department.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (u.designation && u.designation.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (u.idNumber && u.idNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (u.phone && u.phone.includes(searchTerm));
    const matchesType = typeFilter === 'all' || (u.userType && u.userType.toLowerCase() === typeFilter.toLowerCase());
    return matchesSearch && matchesType;
  });

  const filteredPending = pendingRegistrations.filter(r => {
    const fullName = `${r.firstName} ${r.middleName} ${r.lastName}`;
    return (
      fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.gmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.department && r.department.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (r.idNumber && r.idNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
      r.contactNumber.includes(searchTerm)
    );
  });

  const filteredRejected = (rejectedRegistrations || []).filter(r => {
    const fullName = `${r.firstName} ${r.middleName} ${r.lastName}`;
    return (
      fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.gmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.reason && r.reason.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  });

  const handleOpenReject = (reg) => {
    setTargetRejectReg(reg);
    setIsRejectModalOpen(true);
  };

  const handleConfirmReject = (e) => {
    e.preventDefault();
    if (targetRejectReg) {
      rejectRegistration(targetRejectReg.id, rejectionReason);
      setIsRejectModalOpen(false);
      setIsInspectModalOpen(false);
      setTargetRejectReg(null);
    }
  };

  const handleCreateTechnician = (e) => {
    e.preventDefault();
    createMaintenanceUser({
      ...techForm,
      idNumber: techForm.idNumber || `ISATU-TEC-${Date.now().toString().slice(-4)}`
    });
    setIsTechModalOpen(false);
    setTechForm({
      firstName: '',
      lastName: '',
      middleName: '',
      email: '',
      phone: '',
      specialization: 'Electrical & HVAC',
      password: 'tech123',
      idNumber: ''
    });
  };

  const handleOpenInspect = (reg) => {
    setSelectedPendingReg(reg);
    setIsInspectModalOpen(true);
  };

  const handleApproveReg = () => {
    if (selectedPendingReg) {
      approveRegistration(selectedPendingReg.id);
      setIsInspectModalOpen(false);
    }
  };

  const handleOpenEdit = (user) => {
    setEditingUser(user);
    setEditForm({
      name: user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      email: user.email || user.gmail || '',
      department: user.department || '',
      designation: user.designation || '',
      phone: user.phone || user.contactNumber || ''
    });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = (event) => {
    event.preventDefault();
    if (!editingUser) return;
    updateUser(editingUser.id, editForm);
    setIsEditModalOpen(false);
    setEditingUser(null);
  };

  const handleRemove = (user) => {
    if (user.role === 'Admin' || user.userType === 'Admin') return;
    if (window.confirm(`Remove ${user.name || user.email} from User Management?`)) removeUser(user.id);
  };

  const handleAddOffice = (event) => {
    event.preventDefault();
    addOffice(newOffice);
    setNewOffice('');
  };

  const handleAddDepartment = (event) => {
    event.preventDefault();
    addDepartment(newDepartment);
    setNewDepartment('');
  };

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 className="page-title">User Management & ID Verification</h1>
            <span style={{
              background: '#fee2e2',
              color: '#dc2626',
              fontSize: '11px',
              fontWeight: '700',
              padding: '2px 8px',
              borderRadius: '6px',
              textTransform: 'uppercase'
            }}>
              PDAS Admin Only
            </span>
          </div>
          <p className="page-subtitle">
            Review applicant registrations, verify institutional photo IDs, and manage maintenance personnel accounts
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-secondary" onClick={() => setIsRegisterModalOpen(true)}>
            <UserPlus size={16} /> Register Faculty / Staff
          </button>
          <button type="button" className="btn btn-primary" onClick={() => setIsTechModalOpen(true)} style={{ background: '#001f9c' }}>
            <Wrench size={16} /> Create Maintenance Personnel Account
          </button>
        </div>
      </div>

      <div className="content-card" style={{ marginBottom: '20px' }}>
        <div className="card-header">
          <div>
            <h2 className="card-title">Offices and Departments</h2>
            <p className="page-subtitle" style={{ margin: '4px 0 0' }}>Manage options available in registration forms</p>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', padding: '0 20px 20px' }}>
          <form onSubmit={handleAddOffice}>
            <label className="form-label">Add Office</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input className="form-input" value={newOffice} onChange={event => setNewOffice(event.target.value)} placeholder="e.g. Office of the Registrar" required />
              <button type="submit" className="btn btn-primary"><Plus size={15} /> Add</button>
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '8px' }}>{offices.length} offices available</div>
          </form>
          <form onSubmit={handleAddDepartment}>
            <label className="form-label">Add Department / Program</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input className="form-input" value={newDepartment} onChange={event => setNewDepartment(event.target.value)} placeholder="e.g. BS Architecture" required />
              <button type="submit" className="btn btn-primary"><Plus size={15} /> Add</button>
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '8px' }}>{departments.length} departments/programs available</div>
          </form>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '10px', borderBottom: '1px solid #e2e8f0', marginBottom: '20px' }}>
        <button
          type="button"
          onClick={() => setActiveTab('verified')}
          style={{
            padding: '10px 18px',
            border: 'none',
            background: 'none',
            fontWeight: activeTab === 'verified' ? '700' : '500',
            color: activeTab === 'verified' ? '#001f9c' : '#64748b',
            borderBottom: activeTab === 'verified' ? '2px solid #001f9c' : '2px solid transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px'
          }}
        >
          <Users size={16} />
          Active Campus Personnel ({users.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('pending-id')}
          style={{
            padding: '10px 18px',
            border: 'none',
            background: 'none',
            fontWeight: activeTab === 'pending-id' ? '700' : '500',
            color: activeTab === 'pending-id' ? '#001f9c' : '#64748b',
            borderBottom: activeTab === 'pending-id' ? '2px solid #001f9c' : '2px solid transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px'
          }}
        >
          <FileCheck size={16} />
          Pending ID Confirmations
          {pendingRegistrationsCount > 0 && (
            <span style={{
              background: '#ef4444',
              color: '#ffffff',
              fontSize: '11px',
              fontWeight: '700',
              padding: '1px 7px',
              borderRadius: '10px'
            }}>
              {pendingRegistrationsCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('rejected-logs')}
          style={{
            padding: '10px 18px',
            border: 'none',
            background: 'none',
            fontWeight: activeTab === 'rejected-logs' ? '700' : '500',
            color: activeTab === 'rejected-logs' ? '#001f9c' : '#64748b',
            borderBottom: activeTab === 'rejected-logs' ? '2px solid #001f9c' : '2px solid transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px'
          }}
        >
          <FileWarning size={16} />
          Rejected Applications Log ({rejectedRegistrations?.length || 0})
        </button>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <div className="search-input-wrapper">
          <Search size={16} className="search-input-icon" />
          <input
            type="text"
            className="search-input"
            placeholder={
              activeTab === 'verified'
                ? "Search verified accounts by name, ID number, email, department..."
                : "Search pending requests by name, ID number, contact..."
            }
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {activeTab === 'verified' && (
          <select
            className="select-filter"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="all">All Classifications</option>
            <option value="Faculty">Faculty</option>
            <option value="Staff">Staff</option>
            <option value="Maintenance">Maintenance Personnel</option>
            <option value="Admin">Admin</option>
          </select>
        )}
      </div>

      {/* Tab 1: Verified Accounts */}
      {activeTab === 'verified' && (
        <div className="content-card">
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>NAME & INSTITUTIONAL ID</th>
                  <th>EMAIL ADDRESS</th>
                  <th>CLASSIFICATION</th>
                  <th>DEPARTMENT / SPECIALIZATION</th>
                  <th>CONTACT NUMBER</th>
                  <th>ID STATUS</th>
                  <th>ACCOUNT</th>
                  <th style={{ textAlign: 'right' }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(user => {
                  const displayName = user.name || `${user.firstName || ''} ${user.middleName ? user.middleName + ' ' : ''}${user.lastName || ''}`;
                  return (
                    <tr key={user.id}>
                      <td>
                        <div style={{ fontWeight: '700', color: '#0f172a' }}>{displayName}</div>
                        <div style={{ fontSize: '11.5px', color: '#001f9c', fontWeight: '600' }}>
                          ID: {user.idNumber || 'ISATU-VERIFIED'}
                        </div>
                      </td>
                      <td style={{ fontSize: '13px', color: '#334155', fontWeight: '500' }}>
                        {user.email || user.gmail}
                      </td>
                      <td>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '11.5px',
                          fontWeight: '700',
                          background: user.userType === 'Faculty' ? '#eff6ff' : user.userType === 'Maintenance' ? '#fffbeb' : '#f5f3ff',
                          color: user.userType === 'Faculty' ? '#1d4ed8' : user.userType === 'Maintenance' ? '#d97706' : '#6d28d9'
                        }}>
                          {user.userType === 'Faculty' ? <GraduationCap size={13} /> : user.userType === 'Maintenance' ? <Wrench size={13} /> : <Briefcase size={13} />}
                          {user.userType || user.role}
                        </span>
                      </td>
                      <td style={{ fontSize: '12.5px', color: '#334155' }}>
                        <div>{user.department}</div>
                        {user.specialization && (
                          <div style={{ fontSize: '11px', color: '#d97706', fontWeight: '600' }}>
                            Trade: {user.specialization}
                          </div>
                        )}
                      </td>
                      <td style={{ fontSize: '12.5px', color: '#64748b' }}>
                        {user.phone || user.contactNumber}
                      </td>
                      <td>
                        <span className="badge status-completed" style={{ gap: '4px' }}>
                          <CheckCircle2 size={12} />
                          Verified ID
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${user.status === 'Active' ? 'status-approved' : 'status-rejected'}`}>
                          <span className="badge-dot"></span>
                          {user.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => toggleUserStatus(user.id)}
                          disabled={user.role === 'Admin'}
                          title={user.role === 'Admin' ? 'Primary admin cannot be deactivated' : 'Toggle Active status'}
                        >
                          {user.status === 'Active' ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleOpenEdit(user)}
                          style={{ marginLeft: '6px' }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => handleRemove(user)}
                          disabled={user.role === 'Admin' || user.userType === 'Admin'}
                          title={user.role === 'Admin' ? 'The sole admin account cannot be removed' : 'Remove user'}
                          style={{ marginLeft: '6px' }}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Edit User Account" maxWidth="520px">
        <form onSubmit={handleSaveEdit}>
          {['name', 'email', 'department', 'designation', 'phone'].map(field => (
            <div className="form-group" key={field}>
              <label className="form-label">{field === 'designation' ? 'Office' : field.charAt(0).toUpperCase() + field.slice(1)}</label>
              <input
                className="form-input"
                type={field === 'email' ? 'email' : 'text'}
                value={editForm[field]}
                onChange={event => setEditForm({ ...editForm, [field]: event.target.value })}
                required={field === 'name' || field === 'email'}
              />
            </div>
          ))}
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Save Changes</button>
        </form>
      </Modal>
      <RegisterModal isOpen={isRegisterModalOpen} onClose={() => setIsRegisterModalOpen(false)} />

      {/* Tab 2: Pending ID Confirmations */}
      {activeTab === 'pending-id' && (
        <div className="content-card">
          <div className="card-header">
            <h2 className="card-title">Pending Faculty & Staff Registration Applications</h2>
            <span style={{ fontSize: '13px', color: '#64748b' }}>
              Inspect attached photo of ID before verifying and granting access
            </span>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>APPLICANT NAME</th>
                  <th>ID NUMBER</th>
                  <th>EMAIL</th>
                  <th>TYPE</th>
                  <th>DEPARTMENT / OFFICE</th>
                  <th>CONTACT NUMBER</th>
                  <th>ATTACHED ID PHOTO</th>
                  <th>DATE</th>
                  <th style={{ textAlign: 'right' }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {filteredPending.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '48px', color: '#94a3b8' }}>
                      <CheckCircle2 size={36} color="#10b981" style={{ marginBottom: '8px' }} />
                      <div style={{ fontWeight: '600', color: '#475569' }}>All registration submissions verified!</div>
                      <div style={{ fontSize: '12.5px', color: '#94a3b8' }}>
                        No pending applications in the review queue.
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredPending.map(reg => (
                    <tr key={reg.id}>
                      <td style={{ fontWeight: '700', color: '#0f172a' }}>
                        {reg.firstName} {reg.lastName}
                      </td>
                      <td style={{ fontSize: '12.5px', fontWeight: '600', color: '#001f9c' }}>
                        {reg.idNumber}
                      </td>
                      <td style={{ fontSize: '13px', color: '#334155' }}>
                        {reg.gmail}
                      </td>
                      <td>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '2px 7px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: '700',
                          background: reg.userType === 'Faculty' ? '#eff6ff' : '#f5f3ff',
                          color: reg.userType === 'Faculty' ? '#1d4ed8' : '#6d28d9'
                        }}>
                          {reg.userType === 'Faculty' ? <GraduationCap size={12} /> : <Briefcase size={12} />}
                          {reg.userType}
                        </span>
                      </td>
                      <td style={{ fontSize: '12.5px', color: '#334155' }}>
                        {reg.department}
                      </td>
                      <td style={{ fontSize: '12.5px', color: '#475569' }}>
                        {reg.contactNumber}
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() => handleOpenInspect(reg)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: '#eff6ff',
                            border: '1px solid #bfdbfe',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '600',
                            color: '#1d4ed8',
                            cursor: 'pointer'
                          }}
                        >
                          <Eye size={13} />
                          Inspect ID Photo
                        </button>
                      </td>
                      <td style={{ fontSize: '12px', color: '#64748b' }}>
                        {reg.registeredDate}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className="btn btn-success btn-sm"
                            onClick={() => approveRegistration(reg.id)}
                            title="Accept ID and Activate Account"
                          >
                            <Check size={14} />
                            Accept
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => handleOpenReject(reg)}
                            title="Reject Submission with Reason"
                          >
                            <X size={14} />
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Rejected Applications Log */}
      {activeTab === 'rejected-logs' && (
        <div className="content-card">
          <div className="card-header">
            <h2 className="card-title">Rejected Applications Audit Log</h2>
            <span style={{ fontSize: '13px', color: '#64748b' }}>
              Historical record of rejected registration requests with stated official reasons
            </span>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>APPLICANT</th>
                  <th>ID NUMBER</th>
                  <th>EMAIL</th>
                  <th>DATE REJECTED</th>
                  <th>OFFICIAL REJECTION REASON</th>
                </tr>
              </thead>
              <tbody>
                {filteredRejected.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '32px', color: '#94a3b8' }}>
                      No rejected applications recorded.
                    </td>
                  </tr>
                ) : (
                  filteredRejected.map(r => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: '700', color: '#0f172a' }}>
                        {r.firstName} {r.lastName}
                      </td>
                      <td style={{ fontSize: '12.5px', color: '#64748b' }}>
                        {r.idNumber}
                      </td>
                      <td style={{ fontSize: '13px', color: '#334155' }}>
                        {r.gmail}
                      </td>
                      <td style={{ fontSize: '12px', color: '#64748b' }}>
                        {r.rejectedDate}
                      </td>
                      <td style={{ color: '#b91c1c', fontSize: '12.5px', fontWeight: '500' }}>
                        {r.reason}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Rejection Reason Modal */}
      <Modal
        isOpen={isRejectModalOpen}
        onClose={() => setIsRejectModalOpen(false)}
        title="Reject Registration Application"
        maxWidth="520px"
      >
        {targetRejectReg && (
          <form onSubmit={handleConfirmReject}>
            <div style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '10px',
              padding: '12px 14px',
              marginBottom: '16px',
              color: '#991b1b',
              fontSize: '13px'
            }}>
              <div style={{ fontWeight: '800', marginBottom: '2px' }}>
                State Official Rejection Reason
              </div>
              <div>
                Applicant <strong>{targetRejectReg.firstName} {targetRejectReg.lastName}</strong> will be notified with this specific reason.
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Official Rejection Reason *</label>
              <textarea
                className="form-textarea"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g. Blurry ID photo, Unrecognized department, Invalid employee ID number..."
                required
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsRejectModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-danger"
              >
                <XCircle size={15} />
                Confirm Rejection & Notify
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Admin Create Maintenance Personnel Modal */}
      <Modal
        isOpen={isTechModalOpen}
        onClose={() => setIsTechModalOpen(false)}
        title="Create Maintenance Personnel Account (Admin Only)"
        maxWidth="600px"
      >
        <form onSubmit={handleCreateTechnician}>
          <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
            Maintenance personnel accounts are <strong>strictly created by the PDAS Director</strong>. No public self-registration is allowed for this role.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">First Name *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Rogelio"
                value={techForm.firstName}
                onChange={(e) => setTechForm({ ...techForm, firstName: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Last Name *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Ramos"
                value={techForm.lastName}
                onChange={(e) => setTechForm({ ...techForm, lastName: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Middle Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. S"
                value={techForm.middleName}
                onChange={(e) => setTechForm({ ...techForm, middleName: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">Assigned Trade Specialization *</label>
              <select
                className="form-select"
                value={techForm.specialization}
                onChange={(e) => setTechForm({ ...techForm, specialization: e.target.value })}
                required
              >
                <option value="Electrical & HVAC">Electrical & HVAC Systems</option>
                <option value="Plumbing & Drainage">Plumbing & Water Systems</option>
                <option value="Carpentry & Masonry">Carpentry & Structural Masonry</option>
                <option value="Network & IT Infrastructure">Network & IT Hardware</option>
                <option value="General Campus Facility">General Campus Maintenance</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Technician ID Number *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. ISATU-TEC-2026-08"
                value={techForm.idNumber}
                onChange={(e) => setTechForm({ ...techForm, idNumber: e.target.value })}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">Email / Username *</label>
              <input
                type="email"
                className="form-input"
                placeholder="e.g. rogelio.ramos@dumangas.isatu.edu.ph"
                value={techForm.email}
                onChange={(e) => setTechForm({ ...techForm, email: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Mobile Contact Number *</label>
              <input
                type="text"
                className="form-input"
                placeholder="+63 9XX XXX XXXX"
                value={techForm.phone}
                onChange={(e) => setTechForm({ ...techForm, phone: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Initial PIN / Password</label>
            <input
              type="text"
              className="form-input"
              value={techForm.password}
              onChange={(e) => setTechForm({ ...techForm, password: e.target.value })}
              required
            />
          </div>

          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsTechModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
            >
              <UserPlus size={16} />
              Create Maintenance Account
            </button>
          </div>
        </form>
      </Modal>

      {/* Inspect Photo of ID Modal */}
      <Modal
        isOpen={isInspectModalOpen}
        onClose={() => setIsInspectModalOpen(false)}
        title="Admin Photo of ID Confirmation Verification"
        maxWidth="680px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              ISAT U Dumangas PDAS ID Verification Protocol
            </span>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={() => handleOpenReject(selectedPendingReg)}
              >
                <XCircle size={15} />
                Reject Submission
              </button>
              <button
                type="button"
                className="btn btn-success btn-sm"
                onClick={handleApproveReg}
              >
                <CheckCircle2 size={15} />
                Confirm Photo of ID & Activate Account
              </button>
            </div>
          </div>
        }
      >
        {selectedPendingReg && (
          <div>
            {/* User Info Details */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '20px',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
              fontSize: '13px'
            }}>
              <div>
                <span style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', fontWeight: '700' }}>First Name:</span>
                <div style={{ fontWeight: '700', color: '#0f172a' }}>{selectedPendingReg.firstName}</div>
              </div>
              <div>
                <span style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', fontWeight: '700' }}>Last Name:</span>
                <div style={{ fontWeight: '700', color: '#0f172a' }}>{selectedPendingReg.lastName}</div>
              </div>
              <div>
                <span style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', fontWeight: '700' }}>Valid ID Number:</span>
                <div style={{ fontWeight: '700', color: '#001f9c' }}>{selectedPendingReg.idNumber}</div>
              </div>
              <div>
                <span style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', fontWeight: '700' }}>Account Classification:</span>
                <div style={{ fontWeight: '800', color: '#001f9c' }}>{selectedPendingReg.userType}</div>
              </div>
              <div>
                <span style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', fontWeight: '700' }}>
                  Department / Office:
                </span>
                <div style={{ fontWeight: '700', color: '#047857' }}>
                  {selectedPendingReg.department}
                </div>
              </div>
              <div>
                <span style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', fontWeight: '700' }}>Email Address:</span>
                <div style={{ fontWeight: '600', color: '#1e293b' }}>{selectedPendingReg.gmail}</div>
              </div>
              <div>
                <span style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', fontWeight: '700' }}>Contact Number:</span>
                <div style={{ fontWeight: '600', color: '#1e293b' }}>{selectedPendingReg.contactNumber}</div>
              </div>
            </div>

            {/* Attached Photo of ID */}
            <div>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <IdCard size={16} color="#001f9c" />
                Attached Photo of ID for Confirmation:
              </div>
              <div style={{
                border: '2px solid #cbd5e1',
                borderRadius: '12px',
                padding: '12px',
                textAlign: 'center',
                background: '#0f172a',
                overflow: 'hidden'
              }}>
                <img
                  src={selectedPendingReg.idPreviewUrl}
                  alt="Attached Photo of ID"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '340px',
                    borderRadius: '8px',
                    objectFit: 'contain'
                  }}
                />
              </div>
              <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '6px', textAlign: 'center' }}>
                File: <code>{selectedPendingReg.idFileName}</code>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

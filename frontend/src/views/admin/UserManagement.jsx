import React, { useEffect, useRef, useState } from 'react';
import {
  Users,
  Plus,
  UserPlus,
  Shield,
  Check,
  Search,
  CheckCircle2,
  GraduationCap,
  Briefcase,
  Wrench,
  Pencil,
  UserCheck,
  UserX,
  Archive,
  Landmark,
  ChevronDown
} from 'lucide-react';
import { useData } from '../../context/DataContext';
import { useToast } from '../../components/ui/Toast';
import { apiGetSupervisors, apiGetSupervisorAssignments, apiAssignSupervisor, apiDesignateSupervisor } from '../../backend/api';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { UserRegistrationForm } from '../../components/users/UserRegistrationForm';

const userRoleLabel = (user) => {
  const role = String(user?.role || user?.userType || '').trim().toLowerCase();
  if (role === 'superadmin' || role === 'super_admin') return 'Super Admin';
  if (role === 'admin' || role === 'administrator') return 'Admin';
  if (role === 'campus_admin' || role === 'campus_administrator' || role === 'approver') return 'Approver';
  if (role === 'supervisor') return 'Supervisor';
  if (role === 'technician' || role === 'maintenance' || role === 'tech') return 'Maintenance Personnel';
  if (role === 'staff') return 'Staff';
  if (role === 'faculty') return 'Faculty';
  return role ? role.charAt(0).toUpperCase() + role.slice(1) : 'Faculty';
};

const getRoleBadgeStyle = (user) => {
  const role = String(user?.role || user?.userType || '').trim().toLowerCase();
  if (role === 'superadmin' || role === 'super_admin') {
    return {
      bg: '#fae8ff',
      color: '#86198f',
      border: '1px solid #f5d0fe',
      icon: <Shield size={13} />
    };
  }
  if (role === 'admin' || role === 'administrator') {
    return {
      bg: '#fee2e2',
      color: '#991b1b',
      border: '1px solid #fecaca',
      icon: <Shield size={13} />
    };
  }
  if (role === 'campus_admin' || role === 'campus_administrator' || role === 'approver') {
    return {
      bg: '#fef3c7',
      color: '#92400e',
      border: '1px solid #fde68a',
      icon: <Landmark size={13} />
    };
  }
  if (role === 'supervisor') {
    return {
      bg: '#e0e7ff',
      color: '#3730a3',
      border: '1px solid #c7d2fe',
      icon: <UserCheck size={13} />
    };
  }
  if (role === 'maintenance' || role === 'technician' || role === 'tech') {
    return {
      bg: '#fffbeb',
      color: '#b45309',
      border: '1px solid #fde68a',
      icon: <Wrench size={13} />
    };
  }
  if (role === 'staff') {
    return {
      bg: '#f5f3ff',
      color: '#6d28d9',
      border: '1px solid #ddd6fe',
      icon: <Briefcase size={13} />
    };
  }
  // Faculty
  return {
    bg: '#eff6ff',
    color: '#1d4ed8',
    border: '1px solid #bfdbfe',
    icon: <GraduationCap size={13} />
  };
};

export const UserManagement = ({ onNavigate, initialRegisterOpen = false }) => {
  const {
    users,
    toggleUserStatus,
    updateUser,
    removeUser,
    offices,
    departments,
    addOffice,
    addDepartment,
  } = useData();
  const { toast } = useToast();

  const [isRegisterOpen, setIsRegisterOpen] = useState(Boolean(initialRegisterOpen));

  useEffect(() => {
    if (initialRegisterOpen) setIsRegisterOpen(true);
  }, [initialRegisterOpen]);

  const handleCloseRegister = () => {
    setIsRegisterOpen(false);
    // The legacy #register-user deep link opens this modal over the directory.
    // Once it closes, keep the URL and active tab on Personnel Directory.
    if (typeof onNavigate === 'function') onNavigate('user-management');
  };

  const [activeTab, setActiveTabState] = useState(() => {
    return (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('fixit_user_mgmt_tab')) || 'verified';
  });
  const setActiveTab = (tab) => {
    setActiveTabState(tab);
    try { sessionStorage.setItem('fixit_user_mgmt_tab', tab); } catch { }
  };

  // View Switcher Dropdown State
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen]);

  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  /* Supervisor assignment (paper: admin designates the Supervisor function,
     then assigns which Faculty/Staff accounts report to each Supervisor).
     Options come from GET /users/supervisors; the account being edited has its
     current supervisor resolved from GET /users/supervisor-assignments, because
     GET /users does not return supervisor_id. */
  const [supervisors, setSupervisors] = useState([]);
  const [supervisorAssignments, setSupervisorAssignments] = useState([]);
  const [editSupervisorId, setEditSupervisorId] = useState('');
  // Sequence token for the assignment lookup: a slow response for the account
  // that was edited first must not overwrite the one now on screen.
  const editFetchRef = useRef(0);

  // Dedicated "Assign Immediate Supervisor" modal states
  const [isAssignSupervisorModalOpen, setIsAssignSupervisorModalOpen] = useState(false);
  const [targetAssignUser, setTargetAssignUser] = useState(null);
  const [selectedSupervisorId, setSelectedSupervisorId] = useState('');
  const [isDesignatedSupervisor, setIsDesignatedSupervisor] = useState(false);
  const [isSavingSupervisor, setIsSavingSupervisor] = useState(false);

  const refreshSupervisorsAndAssignments = React.useCallback(async () => {
    try {
      const [sups, assignmentsData] = await Promise.all([
        apiGetSupervisors(),
        apiGetSupervisorAssignments()
      ]);
      setSupervisors(Array.isArray(sups) ? sups : []);
      setSupervisorAssignments(Array.isArray(assignmentsData?.employees) ? assignmentsData.employees : []);
    } catch (requestError) {
      console.error('Error refreshing supervisors and assignments:', requestError);
    }
  }, []);

  useEffect(() => {
    refreshSupervisorsAndAssignments();
  }, [refreshSupervisorsAndAssignments]);

  const assignmentMap = React.useMemo(() => {
    const map = new Map();
    (supervisorAssignments || []).forEach(emp => {
      if (emp?.id != null) map.set(Number(emp.id), emp);
    });
    return map;
  }, [supervisorAssignments]);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', role: 'Faculty', department: '', designation: '', phone: '', academicRank: '' });
  const [newOffice, setNewOffice] = useState('');
  const [newDepartment, setNewDepartment] = useState('');

  const filteredUsers = users.filter(u => {
    const fullName = `${u.firstName || ''} ${u.middleName || ''} ${u.lastName || ''} ${u.extName || ''} ${u.name || ''}`;
    const matchesSearch =
      fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.email && u.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (u.department && u.department.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (u.office && u.office.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (u.designation && u.designation.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (u.idNumber && u.idNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (u.phone && u.phone.includes(searchTerm));
    const normalizedRole = userRoleLabel(u).toLowerCase();
    const targetType = typeFilter.toLowerCase();
    const matchesType = typeFilter === 'all' ||
      normalizedRole === targetType ||
      (targetType === 'approver' && (normalizedRole.includes('approver') || String(u.role).toLowerCase().includes('campus_admin'))) ||
      (targetType === 'maintenance' && normalizedRole.includes('maintenance')) ||
      String(u.role || '').toLowerCase() === targetType;
    return matchesSearch && matchesType;
  });

  const [removingUser, setRemovingUser] = useState(null);

  const handleOpenEdit = (user) => {
    setEditingUser(user);
    const rawRole = String(user.role || user.userType || '').toLowerCase();
    const normalizedRole = rawRole.includes('tech') || rawRole.includes('maint')
      ? 'Maintenance'
      : rawRole === 'staff'
        ? 'Staff'
        : rawRole === 'superadmin' || rawRole === 'super_admin'
          ? 'Super Admin'
          : rawRole === 'admin'
            ? 'Admin'
            : rawRole === 'campus_admin' || rawRole === 'campus_administrator' || rawRole === 'approver'
              ? 'Campus Admin'
              : 'Faculty';
    setEditForm({
      name: user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      email: user.email || user.gmail || '',
      department: user.department || '',
      designation: user.designation || '',
      phone: user.phone || user.contactNumber || '',
      role: normalizedRole,
      academicRank: user.academicRank || '',
      specialization: user.specialization || 'General Campus Facility',
      availabilityStatus: user.availabilityStatus || 'available',
      // normalizeUser (api.js) now guarantees isSupervisor is a boolean,
      // so this will always reflect the real DB value on first open.
      isSupervisor: Boolean(user.isSupervisor)
    });
    setEditSupervisorId('');
    setIsEditModalOpen(true);

    // Resolve who this account currently reports to. It is not part of the
    // list the table renders, so it is read here, when the edit form opens.
    const fetchSeq = ++editFetchRef.current;
    apiGetSupervisorAssignments()
      .then(data => {
        if (fetchSeq !== editFetchRef.current) return;
        const employee = (data?.employees || []).find(e => Number(e.id) === Number(user.id));
        setEditSupervisorId(employee?.supervisor_id ? String(employee.supervisor_id) : '');
      })
      .catch(requestError => {
        if (fetchSeq !== editFetchRef.current) return;
        toast(requestError.message || 'The current supervisor could not be loaded.', 'error');
      });
  };

  /* PUT /users/:id/assign-supervisor — the paper allows reassignment at any
     time, so this saves on change instead of waiting for "Save Changes"
     (which only carries profile fields). A rejected assignment rolls the
     select back to the last value the server accepted and says why. */
  const handleChangeSupervisor = async (event) => {
    if (!editingUser) return;
    const nextValue = event.target.value;
    const previousValue = editSupervisorId;
    setEditSupervisorId(nextValue);
    try {
      const result = await apiAssignSupervisor(editingUser.id, nextValue === '' ? null : Number(nextValue));
      toast(result?.message || 'Supervisor assignment updated.');
      refreshSupervisorsAndAssignments();
    } catch (requestError) {
      setEditSupervisorId(previousValue);
      toast(requestError.message || 'The supervisor assignment could not be saved.', 'error');
    }
  };

  const handleOpenAssignSupervisor = (user) => {
    if (user) {
      setTargetAssignUser(user);
      const assignment = assignmentMap.get(Number(user.id));
      setSelectedSupervisorId(assignment?.supervisor_id ? String(assignment.supervisor_id) : '');
      setIsDesignatedSupervisor(Boolean(user.isSupervisor || user.is_supervisor));
    } else {
      const eligible = filteredUsers.find(u => String(u.role || u.userType || '').toLowerCase() !== 'admin') || users[0] || null;
      setTargetAssignUser(eligible);
      if (eligible) {
        const assignment = assignmentMap.get(Number(eligible.id));
        setSelectedSupervisorId(assignment?.supervisor_id ? String(assignment.supervisor_id) : '');
        setIsDesignatedSupervisor(Boolean(eligible.isSupervisor || eligible.is_supervisor));
      } else {
        setSelectedSupervisorId('');
        setIsDesignatedSupervisor(false);
      }
    }
    setIsAssignSupervisorModalOpen(true);
  };

  const handleSelectTargetUser = (userId) => {
    const found = users.find(u => Number(u.id) === Number(userId));
    if (found) {
      setTargetAssignUser(found);
      const assignment = assignmentMap.get(Number(found.id));
      setSelectedSupervisorId(assignment?.supervisor_id ? String(assignment.supervisor_id) : '');
      setIsDesignatedSupervisor(Boolean(found.isSupervisor || found.is_supervisor));
    }
  };

  const handleSaveSupervisorAssignment = async (event) => {
    event.preventDefault();
    if (!targetAssignUser) return;
    setIsSavingSupervisor(true);
    try {
      const originalDesignation = Boolean(targetAssignUser.isSupervisor || targetAssignUser.is_supervisor);
      if (isDesignatedSupervisor !== originalDesignation) {
        await apiDesignateSupervisor(targetAssignUser.id, isDesignatedSupervisor);
        updateUser(targetAssignUser.id, {
          ...targetAssignUser,
          isSupervisor: isDesignatedSupervisor,
          is_supervisor: isDesignatedSupervisor ? 1 : 0
        }).catch(() => { });
      }

      const supId = selectedSupervisorId === '' ? null : Number(selectedSupervisorId);
      await apiAssignSupervisor(targetAssignUser.id, supId);

      toast('Immediate supervisor assignment updated successfully.', 'success');
      setIsAssignSupervisorModalOpen(false);
      await refreshSupervisorsAndAssignments();
    } catch (requestError) {
      toast(requestError.message || 'Failed to update supervisor assignment.', 'error');
    } finally {
      setIsSavingSupervisor(false);
    }
  };

  const handleSaveEdit = (event) => {
    event.preventDefault();
    if (!editingUser) return;
    const roleFields = editForm.role === 'Maintenance'
      ? { role: 'Technician', userType: 'Maintenance' }
      : editForm.role === 'Campus Admin' || editForm.role === 'Approver'
        ? { role: 'campus_admin', userType: 'campus_admin' }
        : editForm.role === 'Super Admin'
          ? { role: 'superadmin', userType: 'superadmin' }
          : { role: editForm.role, userType: editForm.role };
    // The designation flag rides along with the profile fields, so a refused
    // save (bad role, server down) must say so: userDataError is never rendered.
    updateUser(editingUser.id, {
      ...editForm,
      ...roleFields,
      isSupervisor: Boolean(editForm.isSupervisor),
      is_supervisor: editForm.isSupervisor ? 1 : 0,
      academicRank: editForm.academicRank || undefined,
      specialization: editForm.role === 'Maintenance' ? editForm.specialization : undefined,
      availabilityStatus: editForm.role === 'Maintenance' ? editForm.availabilityStatus : undefined
    })
      .then(() => refreshSupervisorsAndAssignments())
      .catch(requestError => toast(requestError.message || 'The account changes could not be saved.', 'error'));
    setIsEditModalOpen(false);
    setEditingUser(null);
  };

  const handleConfirmRemove = () => {
    if (removingUser && !['admin', 'superadmin'].includes(String(removingUser.role || removingUser.userType || '').toLowerCase())) {
      removeUser(removingUser.id);
      setRemovingUser(null);
    }
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
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 className="page-title">Personnel Directory</h1>
            <span style={{
              background: '#ede9fe',
              color: '#5b21b6',
              fontSize: '11px',
              fontWeight: '700',
              padding: '2px 8px',
              borderRadius: '6px',
              textTransform: 'uppercase'
            }}>
              Super Admin Only
            </span>
          </div>
          <p className="page-subtitle">
            View and manage all verified campus personnel accounts
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setIsRegisterOpen(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '7px' }}
          >
            <UserPlus size={16} /> Register User
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
              <input className="form-input" value={newOffice ?? ''} onChange={event => setNewOffice(event.target.value)} placeholder="e.g. Office of the Registrar" required />
              <button type="submit" className="btn btn-primary"><Plus size={15} /> Add</button>
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '8px' }}>{offices.length} offices available</div>
          </form>
          <form onSubmit={handleAddDepartment}>
            <label className="form-label">Add Department / Program</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input className="form-input" value={newDepartment ?? ''} onChange={event => setNewDepartment(event.target.value)} placeholder="e.g. BS Architecture" required />
              <button type="submit" className="btn btn-primary"><Plus size={15} /> Add</button>
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '8px' }}>{departments.length} departments/programs available</div>
          </form>
        </div>
      </div>

      {/* View Switcher Dropdown Selector */}
      {(() => {
        const tabs = [
          {
            id: 'verified',
            label: 'Active Campus Personnel',
            count: users.length,
            icon: Users,
            desc: 'All registered accounts with active campus roles and permissions',
            badge: null
          },
        ];

        const currentTab = tabs.find(t => t.id === activeTab) || tabs[0];
        const CurrentIcon = currentTab.icon;

        return (
          <div ref={dropdownRef} style={{ position: 'relative', marginBottom: '20px' }}>
            <div
              onClick={() => setDropdownOpen(prev => !prev)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--bg-card, #ffffff)',
                border: `1px solid ${dropdownOpen ? 'var(--primary, #001f9c)' : 'var(--border-color, #c4cbdb)'}`,
                borderRadius: '12px',
                padding: '12px 18px',
                boxShadow: dropdownOpen ? '0 0 0 3px rgba(0, 31, 156, 0.1)' : '0 1px 3px rgba(0,0,0,0.04)',
                cursor: 'pointer',
                userSelect: 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: 0 }}>
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  background: 'var(--primary-light, #eff6ff)',
                  color: 'var(--primary, #001f9c)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <CurrentIcon size={20} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-light, #64748b)', letterSpacing: '0.05em' }}>
                      Personnel View
                    </span>
                    {currentTab.badge && (
                      <span style={{
                        fontSize: '10px',
                        fontWeight: '800',
                        textTransform: 'uppercase',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        background: currentTab.badgeColor || '#eff6ff',
                        color: '#ffffff',
                      }}>
                        {currentTab.badge}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-primary, #0f172a)', letterSpacing: '-0.01em', marginTop: '1px' }}>
                    {currentTab.label} <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-muted, #64748b)' }}>({currentTab.count})</span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted, #525d76)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {currentTab.desc}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, marginLeft: '12px' }}>
                <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--primary, #001f9c)' }}>
                  Change View
                </span>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: dropdownOpen ? 'var(--primary, #071746)' : 'var(--bg-sunken)',
                  color: dropdownOpen ? '#ffffff' : 'var(--text-primary, #1e293b)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s ease'
                }}>
                  <ChevronDown
                    size={18}
                    style={{
                      transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s ease'
                    }}
                  />
                </div>
              </div>
            </div>

            {dropdownOpen && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                left: 0,
                right: 0,
                background: 'var(--bg-card, #ffffff)',
                border: '1px solid var(--border-color, #c4cbdb)',
                borderRadius: '12px',
                boxShadow: '0 14px 30px rgba(0, 0, 0, 0.12), 0 6px 12px rgba(0, 0, 0, 0.06)',
                zIndex: 100,
                padding: '8px',
                overflowY: 'auto'
              }}>
                {tabs.map(tab => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setActiveTab(tab.id);
                        setDropdownOpen(false);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        width: '100%',
                        padding: '10px 12px',
                        border: 'none',
                        borderRadius: '8px',
                        background: isActive ? 'var(--primary-light, #eff6ff)' : 'transparent',
                        color: isActive ? 'var(--primary, #001f9c)' : 'var(--text-primary, #1e293b)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'background 0.15s ease'
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)';
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '6px',
                          background: isActive ? 'var(--primary, #071746)' : 'var(--bg-sunken)',
                          color: isActive ? '#ffffff' : 'var(--text-muted, #64748b)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          <Icon size={16} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '13.5px', fontWeight: isActive ? '800' : '600' }}>
                              {tab.label}
                            </span>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted, #64748b)', fontWeight: '600' }}>
                              ({tab.count})
                            </span>
                            {tab.badge && (
                              <span style={{
                                fontSize: '10px',
                                fontWeight: '700',
                                padding: '1px 5px',
                                borderRadius: '4px',
                                background: tab.badgeColor || '#eff6ff',
                                color: '#ffffff',
                              }}>
                                {tab.badge}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '11.5px', color: 'var(--text-muted, #64748b)', marginTop: '1px' }}>
                            {tab.desc}
                          </div>
                        </div>
                      </div>
                      {isActive && (
                        <div style={{ color: 'var(--primary, #001f9c)', marginLeft: '8px' }}>
                          <Check size={16} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

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
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              className="select-filter"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="all">All Roles</option>
              <option value="Super Admin">Super Admin</option>
              <option value="Faculty">Faculty</option>
              <option value="Staff">Staff</option>
              <option value="Supervisor">Immediate Supervisor</option>
              <option value="Maintenance">Maintenance Personnel</option>
              <option value="Approver">Approver (Campus Admin)</option>
              <option value="Admin">Admin</option>
            </select>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => handleOpenAssignSupervisor(null)}
              title="Assign an immediate supervisor to personnel"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap',
                padding: '8px 14px',
                fontSize: '12.5px',
                fontWeight: '600'
              }}
            >
              <UserCheck size={14} />
              <span>Assign Immediate Supervisor</span>
            </button>
          </div>
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
                  <th>ROLE</th>
                  <th>DEPARTMENT / SPECIALIZATION</th>
                  <th>CONTACT NUMBER</th>
                  <th>ID STATUS</th>
                  <th>ACCOUNT</th>
                  <th style={{ textAlign: 'right' }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(user => {
                  const displayName = user.name || `${user.firstName || ''} ${user.middleName ? user.middleName + ' ' : ''}${user.lastName || ''}${user.extName ? ' ' + user.extName : ''}`;
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
                        {(() => {
                          const badge = getRoleBadgeStyle(user);
                          return (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '3px 9px',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: '700',
                                background: badge.bg,
                                color: badge.color,
                                border: badge.border
                              }}>
                                {badge.icon}
                                {userRoleLabel(user)}
                              </span>
                              {Boolean(user.isSupervisor || user.is_supervisor) && (
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  fontSize: '11px',
                                  fontWeight: '700',
                                  background: '#e0e7ff',
                                  color: '#3730a3',
                                  border: '1px solid #c7d2fe'
                                }}>
                                  <UserCheck size={12} /> Immediate Supervisor
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td style={{ fontSize: '12.5px', color: '#334155' }}>
                        <div>{user.department}</div>
                        {user.office && (
                          <div style={{ fontSize: '11.5px', color: '#1d4ed8', fontWeight: '600' }}>
                            Office: {user.office}
                          </div>
                        )}
                        {user.academicRank && (
                          <div style={{ fontSize: '11.5px', color: '#6366f1', fontWeight: '600' }}>
                            Rank: {user.academicRank}
                          </div>
                        )}
                        {user.specialization && (
                          <div style={{ fontSize: '11px', color: '#d97706', fontWeight: '600' }}>
                            Trade: {user.specialization}
                          </div>
                        )}
                        {(() => {
                          const isAdmin = String(user.role || user.userType || '').toLowerCase() === 'admin';
                          if (isAdmin) return null;
                          const assignment = assignmentMap.get(Number(user.id));
                          if (assignment?.supervisor_name) {
                            return (
                              <div style={{
                                fontSize: '11px',
                                color: '#3730a3',
                                fontWeight: '600',
                                marginTop: '4px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                background: '#e0e7ff',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                border: '1px solid #c7d2fe'
                              }}>
                                <UserCheck size={11} /> Reports to: {assignment.supervisor_name}
                              </div>
                            );
                          }
                          if (!(user.isSupervisor || user.is_supervisor)) {
                            return (
                              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '3px' }}>
                                Reports to: <span style={{ color: '#d97706', fontWeight: '500' }}>Unassigned</span>
                              </div>
                            );
                          }
                          return null;
                        })()}
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
                        {(() => {
                          const isUserActive = String(user.status || '').trim().toLowerCase() === 'active';
                          const isTech = String(user.role || user.userType || '').toLowerCase() === 'technician' || String(user.role || user.userType || '').toLowerCase() === 'maintenance';
                          const availStatus = String(user.availabilityStatus || 'available').toLowerCase();
                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <span className={`badge ${isUserActive ? 'status-approved' : 'status-rejected'}`}>
                                <span className="badge-dot"></span>
                                {isUserActive ? 'Active' : 'Inactive'}
                              </span>
                              {isTech && (
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontSize: '11px',
                                  fontWeight: '700',
                                  padding: '2px 6px',
                                  borderRadius: '6px',
                                  background: availStatus === 'off_duty' ? '#fee2e2' : availStatus === 'busy' ? '#fef3c7' : '#ecfdf5',
                                  color: availStatus === 'off_duty' ? '#dc2626' : availStatus === 'busy' ? '#b45309' : '#047857',
                                  border: availStatus === 'off_duty' ? '1px solid #fecaca' : availStatus === 'busy' ? '1px solid #fde68a' : '1px solid #a7f3d0'
                                }}>
                                  {availStatus === 'off_duty' ? 'Off Duty' : availStatus === 'busy' ? 'Busy' : 'Available'}
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td style={{ textAlign: 'right', verticalAlign: 'middle', whiteSpace: 'nowrap', width: '100px' }}>
                        {(() => {
                          const isUserActive = String(user.status || '').trim().toLowerCase() === 'active';
                          const isAdminUser = ['admin', 'superadmin', 'super_admin'].includes(String(user.role || user.userType || '').toLowerCase());
                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'stretch', width: '92px', marginLeft: 'auto' }}>
                              {!isAdminUser && (
                                <button
                                  type="button"
                                  className="btn btn-sm"
                                  onClick={() => toggleUserStatus(user.id)}
                                  title={isUserActive ? 'Deactivate account access' : 'Activate account access'}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '4px',
                                    padding: '3px 6px',
                                    fontSize: '11px',
                                    fontWeight: '600',
                                    borderRadius: '5px',
                                    color: isUserActive ? '#b45309' : '#047857',
                                    background: isUserActive ? '#fffbeb' : '#ecfdf5',
                                    border: isUserActive ? '1px solid #fde68a' : '1px solid #a7f3d0'
                                  }}
                                >
                                  {isUserActive ? <UserX size={12} /> : <UserCheck size={12} />}
                                  <span>{isUserActive ? 'Deactivate' : 'Activate'}</span>
                                </button>
                              )}

                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleOpenEdit(user)}
                                title="Edit user profile"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '4px',
                                  padding: '3px 6px',
                                  fontSize: '11px',
                                  fontWeight: '600',
                                  borderRadius: '5px'
                                }}
                              >
                                <Pencil size={12} />
                                <span>Edit</span>
                              </button>

                              {!isAdminUser && (
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => setRemovingUser(user)}
                                  title="Archive account"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '4px',
                                    padding: '3px 6px',
                                    fontSize: '11px',
                                    fontWeight: '600',
                                    borderRadius: '5px',
                                    background: 'var(--bg-sunken)',
                                    color: '#475569',
                                    border: '1px solid #cbd5e1'
                                  }}
                                >
                                  <Archive size={12} />
                                  <span>Archive</span>
                                </button>
                              )}

                              {!isAdminUser && (
                                <button
                                  type="button"
                                  className="btn btn-sm"
                                  onClick={() => handleOpenAssignSupervisor(user)}
                                  title="Assign immediate supervisor"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '3px',
                                    padding: '2px 5px',
                                    fontSize: '10px',
                                    background: '#e0e7ff',
                                    color: '#3730a3',
                                    border: '1px solid #c7d2fe',
                                    fontWeight: '600',
                                    borderRadius: '5px'
                                  }}
                                >
                                  <UserCheck size={11} />
                                  <span>Supervisor</span>
                                </button>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} onBack={() => setIsEditModalOpen(false)} title="Edit User Account" maxWidth="520px">
        <form onSubmit={handleSaveEdit}>
          {['name', 'email', 'department', 'designation', 'phone'].map(field => (
            <div className="form-group" key={field}>
              <label className="form-label">{field === 'designation' ? 'Office' : field.charAt(0).toUpperCase() + field.slice(1)}</label>
              <input
                className="form-input"
                type={field === 'email' ? 'email' : 'text'}
                value={editForm[field] ?? ''}
                onChange={event => setEditForm({ ...editForm, [field]: event.target.value })}
                required={field === 'name' || field === 'email'}
              />
            </div>
          ))}
          <div className="form-group">
            <label className="form-label">Role *</label>
            <select
              className="form-select"
              value={editForm.role}
              onChange={event => setEditForm({ ...editForm, role: event.target.value })}
              disabled={['admin', 'superadmin', 'super_admin'].includes(String(editingUser?.role || editingUser?.userType || '').toLowerCase())}
            >
              <option value="Faculty">Faculty</option>
              <option value="Staff">Staff</option>
              <option value="Maintenance">Maintenance Personnel</option>
              <option value="Campus Admin">Campus Admin / Approver</option>
              <option value="Admin">PDAS Admin</option>
              <option value="Super Admin">Super Admin</option>
            </select>
          </div>

          {/* Academic Rank / Plantilla Position — for Faculty & Staff */}
          {(editForm.role === 'Faculty' || editForm.role === 'Staff') && (
            <div className="form-group">
              <label className="form-label">Academic Rank / Plantilla Position</label>
              <input
                className="form-input"
                type="text"
                value={editForm.academicRank ?? ''}
                onChange={e => setEditForm({ ...editForm, academicRank: e.target.value })}
                placeholder="e.g. Instructor I, Administrative Officer II"
              />
            </div>
          )}

          {/* Maintenance Personnel Trade Specialization & Availability Status */}
          {editForm.role === 'Maintenance' && (
            <div style={{ background: '#fffbeb', padding: '12px 14px', borderRadius: '8px', border: '1px solid #fde68a', marginBottom: '16px' }}>
              <div className="form-group" style={{ marginBottom: '10px' }}>
                <label className="form-label" style={{ fontWeight: '700', color: '#92400e' }}>Trade Specialization</label>
                <select
                  className="form-select"
                  value={editForm.specialization || 'General Campus Facility'}
                  onChange={e => setEditForm({ ...editForm, specialization: e.target.value })}
                >
                  <option value="Electrical & HVAC">Electrical &amp; HVAC Systems</option>
                  <option value="Plumbing & Drainage">Plumbing &amp; Water Systems</option>
                  <option value="Carpentry & Masonry">Carpentry &amp; Structural Masonry</option>
                  <option value="Network & IT Infrastructure">Network &amp; IT Hardware</option>
                  <option value="General Campus Facility">General Campus Maintenance</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '0' }}>
                <label className="form-label" style={{ fontWeight: '700', color: '#92400e' }}>Duty Availability Status</label>
                <select
                  className="form-select"
                  value={editForm.availabilityStatus || 'available'}
                  onChange={e => setEditForm({ ...editForm, availabilityStatus: e.target.value })}
                >
                  <option value="available">Available (On Duty - Ready for Dispatch)</option>
                  <option value="busy">Busy (Active On Field Job)</option>
                  <option value="off_duty">Off Duty / On Leave</option>
                </select>
              </div>
            </div>
          )}

          {/* Supervisor designation — available for any non-admin account so the
              admin can designate and assign supervisors to any Faculty, Staff,
              Maintenance, or Campus Admin account as needed. */}
          {!['admin', 'superadmin', 'super_admin'].includes(String(editingUser?.role || editingUser?.userType || '').toLowerCase()) && (
            <>
              <div className="form-group" style={{ background: 'var(--bg-sunken)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-subtle, #e2e8f0)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: '600', color: '#0f172a', fontSize: '13px' }}>
                  <input
                    type="checkbox"
                    checked={Boolean(editForm.isSupervisor)}
                    onChange={e => setEditForm({ ...editForm, isSupervisor: e.target.checked })}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  <span>Designate as Immediate Supervisor / Program Head</span>
                </label>
                <p style={{ margin: '4px 0 0 24px', fontSize: '11.5px', color: '#64748b' }}>
                  Grants approval authority over pending job requests submitted by department faculty and staff.
                </p>
              </div>

              {/* Employee → Supervisor side: which Supervisor this account falls under.
                  Saved immediately on change — the server owns the assignment. */}
              <div className="form-group">
                <label className="form-label">Reports to (Immediate Supervisor)</label>
                <select
                  className="form-select"
                  value={editSupervisorId}
                  onChange={handleChangeSupervisor}
                >
                  <option value="">Unassigned</option>
                  {supervisors
                    .filter(sup => Number(sup.id) !== Number(editingUser?.id))
                    .map(sup => (
                      <option key={sup.id} value={String(sup.id)}>
                        {sup.name}{sup.department ? ` — ${sup.department}` : ''}{sup.office ? ` (${sup.office})` : ''}
                      </option>
                    ))}
                </select>
                <div className="form-help">
                  Saved immediately when changed. Choose &quot;Unassigned&quot; to clear this account&apos;s supervisor.
                  {supervisors.length === 0 && (
                    <span style={{ color: '#b45309', fontWeight: '600' }}>
                      {' '}No designated supervisors yet — designate one first using the checkbox above.
                    </span>
                  )}
                </div>
              </div>
            </>
          )}
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Save Changes</button>
        </form>
      </Modal>

      {/* Assign Immediate Supervisor Modal */}
      <Modal
        isOpen={isAssignSupervisorModalOpen}
        onClose={() => setIsAssignSupervisorModalOpen(false)}
        onBack={() => setIsAssignSupervisorModalOpen(false)}
        title="Assign Immediate Supervisor"
        maxWidth="520px"
      >
        <form onSubmit={handleSaveSupervisorAssignment}>
          {/* Target Personnel Selection */}
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label" style={{ fontWeight: '700', marginBottom: '6px' }}>
              Personnel Member *
            </label>
            <select
              className="form-select"
              value={targetAssignUser?.id || ''}
              onChange={(e) => handleSelectTargetUser(e.target.value)}
              required
            >
              <option value="" disabled>-- Select a personnel member --</option>
              {users
                .filter(u => String(u.role || u.userType || '').toLowerCase() !== 'admin')
                .map(u => {
                  const name = u.name || `${u.firstName || ''} ${u.lastName || ''}`.trim();
                  const dept = u.department || u.office || userRoleLabel(u);
                  return (
                    <option key={u.id} value={u.id}>
                      {name} ({dept})
                    </option>
                  );
                })}
            </select>
          </div>

          {targetAssignUser && (
            <div style={{
              background: 'var(--bg-sunken)',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '12px 14px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px'
            }}>
              <div>
                <div style={{ fontWeight: '700', fontSize: '13.5px', color: '#0f172a' }}>
                  {targetAssignUser.name || `${targetAssignUser.firstName || ''} ${targetAssignUser.lastName || ''}`.trim()}
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                  {targetAssignUser.department || 'No department'} {targetAssignUser.office ? `· ${targetAssignUser.office}` : ''}
                </div>
              </div>
              <div>
                {assignmentMap.get(Number(targetAssignUser.id))?.supervisor_name ? (
                  <span style={{ fontSize: '11px', background: '#e0e7ff', color: '#3730a3', padding: '3px 8px', borderRadius: '6px', fontWeight: '600' }}>
                    Current: {assignmentMap.get(Number(targetAssignUser.id)).supervisor_name}
                  </span>
                ) : (
                  <span style={{ fontSize: '11px', background: '#fef3c7', color: '#92400e', padding: '3px 8px', borderRadius: '6px', fontWeight: '600' }}>
                    Current: Unassigned
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Assigned Immediate Supervisor Dropdown */}
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label" style={{ fontWeight: '700', marginBottom: '6px' }}>
              Immediate Supervisor (Reports To) *
            </label>
            <select
              className="form-select"
              value={selectedSupervisorId}
              onChange={(e) => setSelectedSupervisorId(e.target.value)}
            >
              <option value="">— None (Unassigned) —</option>
              {supervisors
                .filter(sup => Number(sup.id) !== Number(targetAssignUser?.id))
                .map(sup => (
                  <option key={sup.id} value={String(sup.id)}>
                    {sup.name}{sup.department ? ` — ${sup.department}` : ''}{sup.office ? ` (${sup.office})` : ''}
                  </option>
                ))}
            </select>
            <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#64748b', lineHeight: 1.4 }}>
              Job requests submitted by this employee will be automatically routed to this supervisor for first-line departmental endorsement.
            </p>
            {supervisors.length === 0 && (
              <div style={{ marginTop: '8px', fontSize: '12px', color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', padding: '8px 10px', borderRadius: '6px' }}>
                No active designated supervisors found. You can designate this user or another user as an immediate supervisor using the checkbox below.
              </div>
            )}
          </div>

          {/* Designation Checkbox */}
          <div style={{
            background: 'var(--bg-sunken)',
            padding: '12px 14px',
            borderRadius: '8px',
            border: '1px solid var(--border-subtle, #e2e8f0)',
            marginBottom: '20px'
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: '600', color: '#0f172a', fontSize: '13px' }}>
              <input
                type="checkbox"
                checked={isDesignatedSupervisor}
                onChange={(e) => setIsDesignatedSupervisor(e.target.checked)}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <span>Designate this user as an Immediate Supervisor / Program Head</span>
            </label>
            <p style={{ margin: '4px 0 0 24px', fontSize: '11.5px', color: '#64748b' }}>
              Grants review &amp; endorsement authority over pending facility job requests in their department/office.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsAssignSupervisorModalOpen(false)}
              disabled={isSavingSupervisor}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSavingSupervisor || !targetAssignUser}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Check size={16} />
              <span>{isSavingSupervisor ? 'Saving...' : 'Save Supervisor Assignment'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Personnel registration opens in place so the directory stays in view. */}
      <Modal
        isOpen={isRegisterOpen}
        onClose={handleCloseRegister}
        title="Register New User"
        maxWidth="920px"
      >
        <UserRegistrationForm variant="modal" onClose={handleCloseRegister} />
      </Modal>

      {/* Safe Archive Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(removingUser)}
        onClose={() => setRemovingUser(null)}
        onConfirm={handleConfirmRemove}
        title="Archive Personnel Account"
        message={`Are you sure you want to archive ${removingUser?.name || removingUser?.email || 'this personnel'} in FixIT? Their system access will be deactivated and preserved for institutional records.`}
        confirmText="Archive Account"
        cancelText="Cancel"
        isDanger={false}
      />
    </div>
  );
};

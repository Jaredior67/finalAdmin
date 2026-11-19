import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  User,
  Lock,
  Bell,
  Shield,
  Sliders,
  Camera,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Save,
  Mail,
  Building,
  IdCard,
  Key,
  Smartphone,
  Laptop,
  Clock,
  Check,
  Eye,
  EyeOff,
  LogOut,
  FileText,
  Wrench,
  Calendar,
  AlertTriangle,
  Layout,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData, toLocalISODate } from '../context/DataContext';
import { apiUpdateUser, apiChangePassword } from '../backend/api';
import { JobRequestPrintSheet } from '../components/common/JobRequestPrintSheet';

export const SettingsPage = () => {
  const { currentUser, updateCurrentUser, isMaintenance, isFacultyOrStaff, isAdmin } = useAuth();
  const {
    trackingConfig,
    updateTrackingConfig,
    peekNextTrackingNumber,
    formTemplateConfig,
    updateFormTemplateConfig,
    resetFormTemplateConfig
  } = useData();

  // Active Tab State
  const [activeTab, setActiveTabState] = useState(() => {
    return (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('fixit_settings_tab')) || 'profile';
  });
  const setActiveTab = (tab) => {
    setActiveTabState(tab);
    try { sessionStorage.setItem('fixit_settings_tab', tab); } catch { }
  };

  // Form State
  const [photo, setPhoto] = useState(currentUser?.avatarUrl || '');
  const [avatarColor, setAvatarColor] = useState(currentUser?.avatarColor || '#071746');
  const [name, setName] = useState(currentUser?.name || '');
  const [title, setTitle] = useState(currentUser?.roleTitle || currentUser?.title || '');
  const [academicRank, setAcademicRank] = useState(currentUser?.academicRank || '');
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [department, setDepartment] = useState(currentUser?.department || '');
  const [officeRoom, setOfficeRoom] = useState(currentUser?.officeRoom || 'CEA Building Room 204');
  const [altEmail, setAltEmail] = useState(currentUser?.altEmail || '');
  const [emergencyContact, setEmergencyContact] = useState(currentUser?.emergencyContact || '+63 917 555 0199');
  const [bio, setBio] = useState(currentUser?.bio || '');

  // Password / Security State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(currentUser?.twoFactorEnabled ?? true);

  // Notification Preferences
  const [notifPrefs, setNotifPrefs] = useState({
    statusUpdates: currentUser?.notifPrefs?.statusUpdates ?? true,
    urgentAlerts: currentUser?.notifPrefs?.urgentAlerts ?? true,
    signatureGate: currentUser?.notifPrefs?.signatureGate ?? true,
    evaluationReminders: currentUser?.notifPrefs?.evaluationReminders ?? true,
    preventiveCalendar: currentUser?.notifPrefs?.preventiveCalendar ?? true,
    systemAnnouncements: currentUser?.notifPrefs?.systemAnnouncements ?? true,
    soundEffects: currentUser?.notifPrefs?.soundEffects ?? true
  });

  // Display Preferences
  const [displayPrefs, setDisplayPrefs] = useState({
    tableDensity: currentUser?.displayPrefs?.tableDensity || 'comfortable',
    defaultView: currentUser?.displayPrefs?.defaultView || 'default',
    autoSaveDrafts: currentUser?.displayPrefs?.autoSaveDrafts ?? true,
    highContrastBadges: currentUser?.displayPrefs?.highContrastBadges ?? false
  });

  // Tracking Numbers (admin)
  const [trackingDraft, setTrackingDraft] = useState(null);
  const [trackingMsg, setTrackingMsg] = useState('');
  useEffect(() => {
    if (activeTab === 'tracking' && trackingConfig && !trackingDraft) setTrackingDraft({ ...trackingConfig });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Form Template Customizer (admin)
  const [templateDraft, setTemplateDraft] = useState(null);
  const [templateMsg, setTemplateMsg] = useState('');
  const [templateMessageType, setTemplateMessageType] = useState('success');
  const [showLivePreview, setShowLivePreview] = useState(true);
  useEffect(() => {
    if (activeTab === 'form-template' && formTemplateConfig && !templateDraft) {
      setTemplateDraft({ ...formTemplateConfig });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Feedback Messages
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

  // Active Sessions Mock Data
  const [sessions, setSessions] = useState([
    {
      id: 'sess-1',
      device: 'Windows 11 PC (Current Device)',
      browser: 'Chrome 122.0 / Edge',
      location: 'ISAT U Dumangas Campus Network (192.168.254.121)',
      lastActive: 'Active now',
      isCurrent: true
    },
    {
      id: 'sess-2',
      device: 'Android Smartphone',
      browser: 'FixIT Mobile Client v1.2',
      location: 'Dumangas, Iloilo',
      lastActive: '2 hours ago',
      isCurrent: false
    }
  ]);

  // Sync with current user on load
  useEffect(() => {
    if (currentUser) {
      setPhoto(currentUser.avatarUrl || '');
      setAvatarColor(currentUser.avatarColor || '#071746');
      setName(currentUser.name || '');
      setTitle(currentUser.roleTitle || currentUser.title || '');
      setAcademicRank(currentUser.academicRank || '');
      setPhone(currentUser.phone || '');
      setDepartment(currentUser.department || '');
      setOfficeRoom(currentUser.officeRoom || 'CEA Building Room 204');
      setAltEmail(currentUser.altEmail || '');
      setEmergencyContact(currentUser.emergencyContact || '+63 917 555 0199');
      setBio(currentUser.bio || '');
      setTwoFactorEnabled(currentUser.twoFactorEnabled ?? true);
      if (currentUser.notifPrefs) setNotifPrefs(currentUser.notifPrefs);
      if (currentUser.displayPrefs) setDisplayPrefs(currentUser.displayPrefs);
    }
  }, [currentUser?.id]);

  // Photo Uploader
  const handlePhotoUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPhoto(reader.result);
      showMessage('Profile photo uploaded. Click "Save Profile Changes" to persist.', 'success');
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setPhoto('');
    showMessage('Profile photo removed. Initial avatar will be displayed.', 'success');
  };

  const showMessage = (msg, type = 'success') => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => {
      setMessage('');
      setMessageType('');
    }, 4500);
  };

  // Password Strength Calculator
  const calculatePasswordStrength = (pass) => {
    if (!pass) return 0;
    let score = 0;
    if (pass.length >= 6) score += 1;
    if (pass.length >= 10) score += 1;
    if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score += 1;
    if (/[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;
    return Math.min(score, 4);
  };

  const passwordStrength = calculatePasswordStrength(newPassword);
  const strengthLabels = ['Too weak', 'Weak', 'Fair', 'Strong', 'Very Strong'];
  const strengthColors = ['#ef4444', '#f97316', '#f59e0b', '#10b981', '#059669'];

  // Save Profile
  const handleSaveProfile = async (e) => {
    e?.preventDefault();
    if (!name.trim()) {
      showMessage('Full Name is required.', 'error');
      return;
    }

    const profileUpdates = {
      name: name.trim(),
      roleTitle: title.trim(),
      academicRank: academicRank.trim(),
      phone: phone.trim(),
      contactNumber: phone.trim(),
      department: department.trim(),
      officeRoom: officeRoom.trim(),
      altEmail: altEmail.trim(),
      emergencyContact: emergencyContact.trim(),
      bio: bio.trim(),
      avatarUrl: photo,
      idPhotoUrl: photo,
      avatarColor: avatarColor,
      initial: name.trim().charAt(0).toUpperCase()
    };

    updateCurrentUser(profileUpdates);

    // Persist to backend (non-blocking — local state is already updated)
    if (currentUser?.id) {
      try {
        await apiUpdateUser(currentUser.id, {
          academicRank: academicRank.trim(),
          contactNumber: phone.trim(),
          idPhotoUrl: photo,
          department: department.trim(),
          office: officeRoom.trim(),
        });
      } catch (err) {
        console.warn('Profile backend sync failed (local state saved):', err.message);
      }
    }

    showMessage('Profile information updated successfully!', 'success');
  };

  // Save Security
  const handleSaveSecurity = async (e) => {
    e?.preventDefault();
    if (!newPassword && !currentPassword) {
      updateCurrentUser({ twoFactorEnabled });
      showMessage('Security preferences updated.', 'success');
      return;
    }

    if (!currentPassword) {
      showMessage('Please enter your current password.', 'error');
      return;
    }

    if (newPassword && newPassword.length < 8) {
      showMessage('New password must contain at least 8 characters.', 'error');
      return;
    }

    if (!/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      showMessage('New password must include both letters and numbers.', 'error');
      return;
    }

    if (newPassword !== confirmPassword) {
      showMessage('New passwords do not match.', 'error');
      return;
    }

    try {
      await apiChangePassword(currentPassword, newPassword);
      updateCurrentUser({ twoFactorEnabled });
      setNewPassword('');
      setConfirmPassword('');
      setCurrentPassword('');
      showMessage('Password updated successfully! Please keep your new password safe.', 'success');
    } catch (err) {
      showMessage(err.message || 'Failed to update password. Please check your current password.', 'error');
    }
  };

  // Save Notifications
  const handleSaveNotifications = () => {
    updateCurrentUser({ notifPrefs });
    showMessage('Notification preferences saved successfully.', 'success');
  };

  // Save Display Preferences
  const handleSaveDisplay = () => {
    updateCurrentUser({ displayPrefs });
    showMessage('Display & interface settings saved successfully.', 'success');
  };

  // Terminate other sessions
  const handleTerminateOtherSessions = () => {
    setSessions(prev => prev.filter(s => s.isCurrent));
    showMessage('All other active sessions have been terminated.', 'success');
  };

  // Pre-set avatar colors
  const avatarColors = ['#071746', '#059669', '#d97706', '#7c3aed', '#dc2626', '#0284c7', '#475569'];

  // Unsaved Changes Tracking (for Floating Sticky Bar)
  const isProfileDirty = useMemo(() => {
    return name !== (currentUser?.name || '') ||
      academicRank !== (currentUser?.academicRank || '') ||
      phone !== (currentUser?.phone || '') ||
      department !== (currentUser?.department || '') ||
      officeRoom !== (currentUser?.officeRoom || 'CEA Building Room 204') ||
      photo !== (currentUser?.avatarUrl || '');
  }, [name, academicRank, phone, department, officeRoom, photo, currentUser]);

  const isSecurityDirty = useMemo(() => {
    return Boolean(currentPassword || newPassword || confirmPassword || twoFactorEnabled !== (currentUser?.twoFactorEnabled ?? true));
  }, [currentPassword, newPassword, confirmPassword, twoFactorEnabled, currentUser]);

  const isNotifDirty = useMemo(() => {
    const orig = currentUser?.notifPrefs || {};
    return Object.keys(notifPrefs).some(k => notifPrefs[k] !== (orig[k] ?? true));
  }, [notifPrefs, currentUser]);

  const isDisplayDirty = useMemo(() => {
    const orig = currentUser?.displayPrefs || {};
    return displayPrefs.tableDensity !== (orig.tableDensity || 'comfortable') ||
      displayPrefs.defaultView !== (orig.defaultView || 'default') ||
      displayPrefs.autoSaveDrafts !== (orig.autoSaveDrafts ?? true) ||
      displayPrefs.highContrastBadges !== (orig.highContrastBadges ?? false);
  }, [displayPrefs, currentUser]);

  const isCurrentTabDirty = (
    (activeTab === 'profile' && isProfileDirty) ||
    (activeTab === 'security' && isSecurityDirty) ||
    (activeTab === 'notifications' && isNotifDirty) ||
    (activeTab === 'preferences' && isDisplayDirty)
  );

  const handleResetActiveTab = () => {
    if (activeTab === 'profile') {
      setName(currentUser?.name || '');
      setAcademicRank(currentUser?.academicRank || '');
      setPhone(currentUser?.phone || '');
      setDepartment(currentUser?.department || '');
      setOfficeRoom(currentUser?.officeRoom || 'CEA Building Room 204');
      setPhoto(currentUser?.avatarUrl || '');
    } else if (activeTab === 'security') {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTwoFactorEnabled(currentUser?.twoFactorEnabled ?? true);
    } else if (activeTab === 'notifications') {
      setNotifPrefs({
        statusUpdates: currentUser?.notifPrefs?.statusUpdates ?? true,
        urgentAlerts: currentUser?.notifPrefs?.urgentAlerts ?? true,
        signatureGate: currentUser?.notifPrefs?.signatureGate ?? true,
        evaluationReminders: currentUser?.notifPrefs?.evaluationReminders ?? true,
        preventiveCalendar: currentUser?.notifPrefs?.preventiveCalendar ?? true,
        systemAnnouncements: currentUser?.notifPrefs?.systemAnnouncements ?? true,
        soundEffects: currentUser?.notifPrefs?.soundEffects ?? true
      });
    } else if (activeTab === 'preferences') {
      setDisplayPrefs({
        tableDensity: currentUser?.displayPrefs?.tableDensity || 'comfortable',
        defaultView: currentUser?.displayPrefs?.defaultView || 'default',
        autoSaveDrafts: currentUser?.displayPrefs?.autoSaveDrafts ?? true,
        highContrastBadges: currentUser?.displayPrefs?.highContrastBadges ?? false
      });
    }
    showMessage('Changes reset to last saved state.', 'info');
  };

  const handleSaveActiveTab = () => {
    if (activeTab === 'profile') handleSaveProfile();
    else if (activeTab === 'security') handleSaveSecurity();
    else if (activeTab === 'notifications') handleSaveNotifications();
    else if (activeTab === 'preferences') handleSaveDisplay();
  };

  return (
    <div style={{ maxWidth: '1080px', margin: '0 auto' }}>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 className="page-title" style={{ fontSize: '26px', fontWeight: '800', color: '#071746', margin: 0 }}>
              Account Settings &amp; Profile
            </h1>
            <span style={{
              background: '#eff6ff',
              color: '#071746',
              border: '1px solid #bfdbfe',
              fontSize: '11px',
              fontWeight: '700',
              padding: '2px 8px',
              borderRadius: '6px'
            }}>
              ISAT U Identity &amp; Security
            </span>
          </div>
          <p className="page-subtitle">
            Manage your personal profile, credentials, security, communication preferences, and institutional role
          </p>
        </div>
      </div>

      {/* Hero Profile Banner */}
      <div className="settings-hero-card">
        <div className="settings-hero-content">
          <div style={{ display: 'flex', alignItems: 'center', gap: '22px', flexWrap: 'wrap' }}>
            <div className="settings-avatar-wrapper" style={{ backgroundColor: avatarColor || '#071746' }}>
              {photo ? (
                <img src={photo} alt="Avatar" className="settings-avatar-img" />
              ) : (
                currentUser?.initial || name?.charAt(0) || 'U'
              )}
              <label className="settings-avatar-edit-btn" title="Upload new photo">
                <Camera size={14} />
                <input type="file" accept="image/*" onChange={handlePhotoUpload} hidden />
              </label>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: '22px', fontWeight: '800', margin: 0, letterSpacing: '-0.01em', color: '#071746' }}>
                  {name || 'FixIT User'}
                </h2>
                <span style={{
                  background: '#ecfdf5',
                  color: '#047857',
                  border: '1px solid #a7f3d0',
                  fontSize: '11px',
                  fontWeight: '700',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <CheckCircle2 size={12} /> Verified Personnel
                </span>
              </div>

              <div style={{ color: '#475569', fontSize: '13.5px', marginTop: '4px', fontWeight: '600' }}>
                {title || (isMaintenance ? 'Maintenance Specialist' : isFacultyOrStaff ? 'Faculty Requester' : 'Physical Plant Administrator')}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '10px', fontSize: '12.5px', color: '#64748b', flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Building size={14} color="#071746" /> {department || 'Physical Development & Auxiliary Services'}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <IdCard size={14} color="#071746" /> ID: {currentUser?.idNumber || 'ISATU-EMP-2026'}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Mail size={14} color="#071746" /> {currentUser?.email || currentUser?.gmail || 'user@gmail.com'}
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <Camera size={14} /> Upload Photo
              <input type="file" accept="image/*" onChange={handlePhotoUpload} hidden />
            </label>
            {photo && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleRemovePhoto}
                style={{ color: '#dc2626', borderColor: '#fca5a5', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Trash2 size={14} /> Remove Photo
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Feedback Alert Toast */}
      {message && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 16px',
          borderRadius: '10px',
          marginBottom: '20px',
          fontSize: '13.5px',
          fontWeight: '600',
          background: messageType === 'success' ? '#ecfdf5' : '#fef2f2',
          border: `1px solid ${messageType === 'success' ? '#a7f3d0' : '#fecaca'}`,
          color: messageType === 'success' ? '#047857' : '#b91c1c',
          boxShadow: '0 2px 6px rgba(0, 0, 0, 0.04)'
        }}>
          {messageType === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{message}</span>
        </div>
      )}

      {/* Settings Navigation Tabs Bar */}
      {(() => {
        const settingsTabs = [
          { id: 'profile', label: 'Profile & Identity', icon: User },
          { id: 'security', label: 'Security & Password', icon: Lock },
          { id: 'notifications', label: 'Notifications & Alerts', icon: Bell },
          { id: 'permissions', label: 'Role & Permissions', icon: Shield },
          { id: 'preferences', label: 'System & Display', icon: Sliders },
          ...(isAdmin ? [
            { id: 'form-template', label: 'Form Template (QF-PDAS-DC-01)', icon: Layout, badge: 'Admin' },
            { id: 'tracking', label: 'Tracking Numbers', icon: FileText, badge: 'Admin' },
          ] : [])
        ];

        return (
          <div
            className="hide-scrollbar"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              overflowX: 'auto',
              paddingBottom: '8px',
              marginBottom: '20px',
              WebkitOverflowScrolling: 'touch'
            }}
          >
            {settingsTabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 16px',
                    borderRadius: '9999px',
                    fontSize: '13px',
                    fontWeight: isActive ? '700' : '600',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease',
                    background: isActive ? '#071746' : 'var(--bg-card, #ffffff)',
                    color: isActive ? '#ffffff' : 'var(--text-primary, #334155)',
                    border: isActive ? '1.5px solid #071746' : '1.5px solid var(--border-color, #cbd5e1)',
                    boxShadow: isActive ? '0 2px 6px rgba(7, 23, 70, 0.2)' : 'none'
                  }}
                >
                  <Icon size={15} color={isActive ? '#ffffff' : '#64748b'} />
                  <span>{tab.label}</span>
                  {tab.badge && (
                    <span style={{
                      fontSize: '10px',
                      fontWeight: '800',
                      textTransform: 'uppercase',
                      padding: '1px 6px',
                      borderRadius: '10px',
                      background: isActive ? 'rgba(255, 255, 255, 0.25)' : '#eff6ff',
                      color: isActive ? '#ffffff' : '#071746',
                      border: isActive ? 'none' : '1px solid #bfdbfe'
                    }}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        );
      })()}

      {/* TAB 1: PROFILE & IDENTITY */}
      {activeTab === 'profile' && (
        <div>
          <div className="settings-card">
            <div className="settings-card-header">
              <div>
                <div className="settings-card-title">
                  <User size={18} color="#071746" /> Personal & Institutional Profile
                </div>
                <div className="settings-card-subtitle">
                  Information used on official QF-PDAS-DC-01 request forms, job orders, and campus communications.
                </div>
              </div>
            </div>

            <form onSubmit={handleSaveProfile}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Official Designation / Title</label>
                  <input
                    type="text"
                    className="form-input"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Associate Professor / Maintenance Specialist"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Academic Rank / Plantilla Position</label>
                  <input
                    type="text"
                    className="form-input"
                    value={academicRank}
                    onChange={(e) => setAcademicRank(e.target.value)}
                    placeholder="e.g. Instructor I, Administrative Officer II, Administrative Aide III"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Department / Academic Office</label>
                  <input
                    type="text"
                    className="form-input"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="e.g. Technology Building"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Campus Office / Station Room</label>
                  <input
                    type="text"
                    className="form-input"
                    value={officeRoom}
                    onChange={(e) => setOfficeRoom(e.target.value)}
                    placeholder="e.g. CEA Building Room 204"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Primary Mobile / Contact Number</label>
                  <input
                    type="text"
                    className="form-input"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+63 917 123 4567"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Alternate Email (Optional)</label>
                  <input
                    type="email"
                    className="form-input"
                    value={altEmail}
                    onChange={(e) => setAltEmail(e.target.value)}
                    placeholder="alternate.email@gmail.com"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Institutional Account Email (Read-Only)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={currentUser?.email || currentUser?.gmail || 'user@gmail.com'}
                    disabled
                    style={{ background: 'var(--bg-muted)', color: '#64748b', cursor: 'not-allowed' }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Institutional Employee/Faculty ID (Read-Only)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={currentUser?.idNumber || 'ISATU-EMP-2026-001'}
                    disabled
                    style={{ background: 'var(--bg-muted)', color: '#64748b', cursor: 'not-allowed' }}
                  />
                </div>
              </div>

              {/* Avatar Accent Color Picker */}
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">Avatar Badge Accent Color (When no photo is set)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
                  {avatarColors.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setAvatarColor(color)}
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        backgroundColor: color,
                        border: avatarColor === color ? '3px solid #0f172a' : '2px solid #ffffff',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                        cursor: 'pointer',
                        transform: avatarColor === color ? 'scale(1.15)' : 'none',
                        transition: 'transform 0.15s ease'
                      }}
                      title={color}
                    />
                  ))}
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label">Bio / Facility Request Notes</label>
                <textarea
                  className="form-textarea"
                  rows="3"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Add any specific notes regarding your department station, maintenance coverage, or request preferences..."
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="submit" className="btn btn-primary">
                  <Save size={16} /> Save Profile Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB 2: SECURITY & PASSWORD */}
      {activeTab === 'security' && (
        <div>
          {/* Change Password Card */}
          <div className="settings-card">
            <div className="settings-card-header">
              <div>
                <div className="settings-card-title">
                  <Key size={18} color="#071746" /> Password & Credential Management
                </div>
                <div className="settings-card-subtitle">
                  Ensure your account has a strong, unique password to safeguard ISAT U PDAS records.
                </div>
              </div>
            </div>

            <form onSubmit={handleSaveSecurity}>
              <div className="form-group" style={{ maxWidth: '480px', marginBottom: '16px' }}>
                <label className="form-label">Current Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    className="form-input"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    style={{ paddingRight: '40px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', color: '#64748b', cursor: 'pointer' }}
                  >
                    {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                <div className="form-group">
                  <label className="form-label">New Password</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      className="form-input"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      style={{ paddingRight: '40px' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', color: '#64748b', cursor: 'pointer' }}
                    >
                      {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>

                  {newPassword && (
                    <div style={{ marginTop: '8px' }}>
                      <div className="strength-meter-bar">
                        {[1, 2, 3, 4].map(step => (
                          <div
                            key={step}
                            className="strength-segment"
                            style={{
                              backgroundColor: step <= passwordStrength ? strengthColors[passwordStrength] : '#e2e8f0'
                            }}
                          />
                        ))}
                      </div>
                      <div style={{ fontSize: '11.5px', marginTop: '4px', fontWeight: '700', color: strengthColors[passwordStrength] }}>
                        Strength: {strengthLabels[passwordStrength]}
                      </div>
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Confirm New Password</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      className="form-input"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-type new password"
                      style={{ paddingRight: '40px' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', color: '#64748b', cursor: 'pointer' }}
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* 2FA Toggle Switch */}
              <div className="toggle-switch-container">
                <div>
                  <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '13.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Shield size={16} color="#071746" />
                    Two-Factor Authentication (2FA) for Critical Actions
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                    Require email one-time passcodes when performing high-risk actions (e.g. signature confirmations or role assignments).
                  </div>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={twoFactorEnabled}
                    onChange={(e) => setTwoFactorEnabled(e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button type="submit" className="btn btn-primary">
                  <Save size={16} /> Update Security Settings
                </button>
              </div>
            </form>
          </div>

          {/* Active Sessions Card */}
          <div className="settings-card">
            <div className="settings-card-header">
              <div>
                <div className="settings-card-title">
                  <Laptop size={18} color="#071746" /> Active Sessions & Device Activity
                </div>
                <div className="settings-card-subtitle">
                  Review devices currently logged into this FixIT account.
                </div>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleTerminateOtherSessions}
                style={{ color: '#dc2626', borderColor: '#fca5a5' }}
              >
                <LogOut size={14} /> Sign Out Other Devices
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {sessions.map(sess => (
                <div
                  key={sess.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 16px',
                    background: sess.isCurrent ? '#eff6ff' : 'var(--bg-sunken)',
                    border: sess.isCurrent ? '1.5px solid #bfdbfe' : '1px solid #e2e8f0',
                    borderRadius: '10px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '8px',
                      background: sess.isCurrent ? '#071746' : '#e2e8f0',
                      color: sess.isCurrent ? '#ffffff' : '#64748b',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {sess.device.includes('Phone') ? <Smartphone size={20} /> : <Laptop size={20} />}
                    </div>
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '13.5px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {sess.device}
                        {sess.isCurrent && (
                          <span style={{ fontSize: '10.5px', background: '#10b981', color: '#ffffff', padding: '1px 6px', borderRadius: '10px', fontWeight: '700' }}>
                            Current Session
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                        {sess.browser} • {sess.location}
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize: '12px', color: sess.isCurrent ? '#047857' : '#64748b', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={13} /> {sess.lastActive}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: NOTIFICATIONS & ALERTS */}
      {activeTab === 'notifications' && (
        <div className="settings-card">
          <div className="settings-card-header">
            <div>
              <div className="settings-card-title">
                <Bell size={18} color="#071746" /> Communication & Notification Preferences
              </div>
              <div className="settings-card-subtitle">
                Customize how and when you receive automated notifications from the FixIT PDAS tracking engine.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div className="toggle-switch-container">
              <div>
                <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '13.5px' }}>
                  Request Lifecycle Updates
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                  Receive alerts when ticket status updates (Pending → Under Review → Pending Final Approval → Approved → Ongoing → Completed).
                </div>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={notifPrefs.statusUpdates}
                  onChange={(e) => setNotifPrefs({ ...notifPrefs, statusUpdates: e.target.checked })}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <div className="toggle-switch-container">
              <div>
                <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '13.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: '#dc2626' }}>●</span> Urgent Ticket Flash Alerts
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                  High-priority immediate audio & visual alert when an urgent hazard or safety ticket is dispatched.
                </div>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={notifPrefs.urgentAlerts}
                  onChange={(e) => setNotifPrefs({ ...notifPrefs, urgentAlerts: e.target.checked })}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <div className="toggle-switch-container">
              <div>
                <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '13.5px' }}>
                  Physical Signature Verification Reminders
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                  Notify requesters to print and route the official QF-PDAS-DC-01 form for wet-ink signatures.
                </div>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={notifPrefs.signatureGate}
                  onChange={(e) => setNotifPrefs({ ...notifPrefs, signatureGate: e.target.checked })}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <div className="toggle-switch-container">
              <div>
                <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '13.5px' }}>
                  ISO/IEC 25010 Post-Completion Feedback Reminders
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                  Prompt requesters to submit service quality ratings once a maintenance requests is marked Completed.
                </div>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={notifPrefs.evaluationReminders}
                  onChange={(e) => setNotifPrefs({ ...notifPrefs, evaluationReminders: e.target.checked })}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <div className="toggle-switch-container">
              <div>
                <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '13.5px' }}>
                  Preventive Maintenance Schedule Alerts
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                  Receive reminders 48 hours before scheduled facility inspections (HVAC, Electrical, Water Sanitation).
                </div>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={notifPrefs.preventiveCalendar}
                  onChange={(e) => setNotifPrefs({ ...notifPrefs, preventiveCalendar: e.target.checked })}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <div className="toggle-switch-container">
              <div>
                <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '13.5px' }}>
                  Sound Effects on Incoming Notifications
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                  Play subtle chimes when new notifications or direct messages arrive in your drawer.
                </div>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={notifPrefs.soundEffects}
                  onChange={(e) => setNotifPrefs({ ...notifPrefs, soundEffects: e.target.checked })}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
            <button type="button" className="btn btn-primary" onClick={handleSaveNotifications}>
              <Save size={16} /> Save Notification Preferences
            </button>
          </div>
        </div>
      )}

      {/* TAB 4: ROLE & PERMISSIONS MATRIX */}
      {activeTab === 'permissions' && (
        <div className="settings-card">
          <div className="settings-card-header">
            <div>
              <div className="settings-card-title">
                <Shield size={18} color="#071746" /> Role & Institutional Capabilities Matrix
              </div>
              <div className="settings-card-subtitle">
                System permissions associated with your active role tier: <strong>{currentUser?.roleTitle || currentUser?.title || (isMaintenance ? 'Maintenance' : isFacultyOrStaff ? 'Faculty/Staff' : 'Administrator')}</strong>
              </div>
            </div>
          </div>

          <div className="permission-matrix-grid">
            <div className="permission-matrix-item">
              <div className="permission-icon-box" style={{ background: '#ecfdf5', color: '#059669' }}>
                <FileText size={18} />
              </div>
              <div>
                <div style={{ fontWeight: '700', fontSize: '13.5px', color: '#0f172a' }}>
                  Job Request Submission
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                  Submit work orders across all 6 official PDAS categories with photo and QR location tags.
                </div>
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#059669', display: 'inline-flex', alignItems: 'center', gap: '3px', marginTop: '6px' }}>
                  <Check size={13} /> Granted
                </span>
              </div>
            </div>

            <div className="permission-matrix-item">
              <div className="permission-icon-box" style={{ background: isFacultyOrStaff ? 'var(--bg-sunken)' : '#eff6ff', color: isFacultyOrStaff ? 'var(--text-light)' : '#001f9c' }}>
                <Key size={18} />
              </div>
              <div>
                <div style={{ fontWeight: '700', fontSize: '13.5px', color: '#0f172a' }}>
                  Electronic Signature & Archive Verification Gate
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                  Verify electronic endorsements and optional archive attachments for completed records.
                </div>
                <span style={{ fontSize: '11px', fontWeight: '700', color: isFacultyOrStaff ? '#64748b' : '#001f9c', display: 'inline-flex', alignItems: 'center', gap: '3px', marginTop: '6px' }}>
                  {isFacultyOrStaff ? 'Restricted to PDAS Admin' : <><Check size={13} /> Granted</>}
                </span>
              </div>
            </div>

            <div className="permission-matrix-item">
              <div className="permission-icon-box" style={{ background: !isMaintenance && isFacultyOrStaff ? 'var(--bg-sunken)' : '#fffbeb', color: !isMaintenance && isFacultyOrStaff ? 'var(--text-light)' : '#d97706' }}>
                <Wrench size={18} />
              </div>
              <div>
                <div style={{ fontWeight: '700', fontSize: '13.5px', color: '#0f172a' }}>
                  Maintenance Execution & Status Updates
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                  Accept assigned work orders, post work logs, and advance jobs to In Progress and Completed.
                </div>
                <span style={{ fontSize: '11px', fontWeight: '700', color: !isMaintenance && isFacultyOrStaff ? '#64748b' : '#059669', display: 'inline-flex', alignItems: 'center', gap: '3px', marginTop: '6px' }}>
                  {!isMaintenance && isFacultyOrStaff ? 'Technicians & Admin only' : <><Check size={13} /> Granted</>}
                </span>
              </div>
            </div>

            <div className="permission-matrix-item">
              <div className="permission-icon-box" style={{ background: !isMaintenance && isFacultyOrStaff ? 'var(--bg-sunken)' : '#fef2f2', color: !isMaintenance && isFacultyOrStaff ? 'var(--text-light)' : '#dc2626' }}>
                <AlertTriangle size={18} />
              </div>
              <div>
                <div style={{ fontWeight: '700', fontSize: '13.5px', color: '#0f172a' }}>
                  Irreparable Item Flagging
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                  Flag defective assets as irreparable and initiate the university procurement workflow.
                </div>
                <span style={{ fontSize: '11px', fontWeight: '700', color: !isMaintenance && isFacultyOrStaff ? '#64748b' : '#059669', display: 'inline-flex', alignItems: 'center', gap: '3px', marginTop: '6px' }}>
                  {!isMaintenance && isFacultyOrStaff ? 'Technicians & Admin only' : <><Check size={13} /> Granted</>}
                </span>
              </div>
            </div>

            <div className="permission-matrix-item">
              <div className="permission-icon-box" style={{ background: '#eff6ff', color: '#001f9c' }}>
                <Calendar size={18} />
              </div>
              <div>
                <div style={{ fontWeight: '700', fontSize: '13.5px', color: '#0f172a' }}>
                  Preventive Maintenance Calendar
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                  View scheduled campus maintenance windows and equipment inspection dates.
                </div>
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#059669', display: 'inline-flex', alignItems: 'center', gap: '3px', marginTop: '6px' }}>
                  <Check size={13} /> Granted (All Personnel)
                </span>
              </div>
            </div>

            <div className="permission-matrix-item">
              <div className="permission-icon-box" style={{ background: isFacultyOrStaff ? 'var(--bg-sunken)' : '#eff6ff', color: isFacultyOrStaff ? 'var(--text-light)' : '#001f9c' }}>
                <Sliders size={18} />
              </div>
              <div>
                <div style={{ fontWeight: '700', fontSize: '13.5px', color: '#0f172a' }}>
                  User Management & Registration Approval
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                  Authorize pending faculty accounts and create maintenance staff credentials.
                </div>
                <span style={{ fontSize: '11px', fontWeight: '700', color: isFacultyOrStaff ? '#64748b' : '#001f9c', display: 'inline-flex', alignItems: 'center', gap: '3px', marginTop: '6px' }}>
                  {isFacultyOrStaff ? 'Restricted to PDAS Admin' : <><Check size={13} /> Granted</>}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: SYSTEM & DISPLAY PREFERENCES */}
      {activeTab === 'preferences' && (
        <div className="settings-card">
          <div className="settings-card-header">
            <div>
              <div className="settings-card-title">
                <Sliders size={18} color="#001f9c" /> Interface & System Preferences
              </div>
              <div className="settings-card-subtitle">
                Customize your viewing density, default landing modules, and local drafting settings.
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '20px' }}>
            <div className="form-group">
              <label className="form-label">Table & List Display Density</label>
              <select
                className="form-select"
                value={displayPrefs.tableDensity}
                onChange={(e) => setDisplayPrefs({ ...displayPrefs, tableDensity: e.target.value })}
              >
                <option value="comfortable">Comfortable (Standard Row Height with Badges)</option>
                <option value="compact">Compact (Higher Row Density for Faster Scanning)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Default Navigation View on Sign-In</label>
              <select
                className="form-select"
                value={displayPrefs.defaultView}
                onChange={(e) => setDisplayPrefs({ ...displayPrefs, defaultView: e.target.value })}
              >
                <option value="default">Default Role Home (Dashboard / Active Tickets)</option>
                <option value="job-requests">Job Requests Queue</option>
                <option value="calendar">Preventive Maintenance Calendar</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div className="toggle-switch-container">
              <div>
                <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '13.5px' }}>
                  Auto-Save Request Drafts Locally
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                  Automatically preserve unsubmitted job request form entries so you never lose progress if interrupted.
                </div>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={displayPrefs.autoSaveDrafts}
                  onChange={(e) => setDisplayPrefs({ ...displayPrefs, autoSaveDrafts: e.target.checked })}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <div className="toggle-switch-container">
              <div>
                <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '13.5px' }}>
                  High-Contrast Status Indicators
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                  Render status tags with high-contrast border outlines for increased outdoor and mobile legibility.
                </div>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={displayPrefs.highContrastBadges}
                  onChange={(e) => setDisplayPrefs({ ...displayPrefs, highContrastBadges: e.target.checked })}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
            <button type="button" className="btn btn-primary" onClick={handleSaveDisplay}>
              <Save size={16} /> Save Display Settings
            </button>
          </div>
        </div>
      )}

      {/* TAB: FORM TEMPLATE & LAYOUT EDITOR (ADMIN ONLY) */}
      {activeTab === 'form-template' && isAdmin && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="settings-card">
            <div className="settings-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div className="settings-card-title">
                  <Layout size={18} color="#001f9c" /> Form Template &amp; Layout Customization (QF-PDAS-DC-01)
                </div>
                <div className="settings-card-subtitle">
                  Configure the official university header, body metadata labels, layout typography, attached photo visibility, and footer signatories. Changes reflect on all printed slips and document previews.
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowLivePreview(!showLivePreview)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                >
                  <Eye size={14} /> {showLivePreview ? 'Hide Live Preview' : 'Show Live Preview'}
                </button>
              </div>
            </div>

            {(() => {
              const d = templateDraft || formTemplateConfig || {};
              const setD = (patch) => setTemplateDraft(prev => ({ ...(prev || formTemplateConfig), ...patch }));

              const sampleTicket = {
                id: 'JR-2026-0001',
                controlNo: 'JR-2026-0001',
                title: 'Aircon Maintenance & Electrical Repair',
                category: 'Electrical',
                date: toLocalISODate(new Date()),
                requestedBy: currentUser?.name || 'Prof. Maria Santos',
                department: currentUser?.department || 'College of Engineering & Architecture',
                location: 'CEA Building - Room 204',
                immediateSupervisor: 'Dr. Carmelo V. Ramos',
                contactNumber: '0912-345-6789',
                requesterApproved: true,
                requesterApprovedAt: new Date().toISOString(),
                supervisorApproved: true,
                supervisorApprovedAt: new Date().toISOString(),
                adminApproved: true,
                adminApprovedAt: new Date().toISOString(),
                campusAdminApproved: true,
                campusAdminApprovedAt: new Date().toISOString(),
                scopeOfWorks: {
                  electrical: {
                    checked: true,
                    options: ['Repair', 'Installation/Replacement'],
                    description: 'Inspect circuit breaker and clean air conditioning filter coils.',
                    dateComplied: toLocalISODate(new Date())
                  }
                },
                actionTaken: {
                  endorsedGSMHead: { checked: true, receivedBy: 'Engr. Maintenance Crew', date: toLocalISODate(new Date()) },
                  pdasHeadName: 'Engr. Alex Rivera'
                },
                finalAction: {
                  status: 'Approved',
                  remarks: 'Approved for urgent repair and inspection.',
                  approverName: 'Dr. Carmelo V. Ramos'
                }
              };

              return (
                <div>
                  {/* Section 1: Official Header Configuration */}
                  <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '18px', marginBottom: '18px' }}>
                    <div style={{ fontSize: '13px', fontWeight: '800', color: '#001f9c', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '12px' }}>
                      1. Official Header &amp; Institutional Identity
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
                      <div className="form-group">
                        <label className="form-label">Republic / State Header</label>
                        <input className="form-input" value={d.republicLine || ''} onChange={e => setD({ republicLine: e.target.value })} placeholder="Republic of the Philippines" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Institution / University Name *</label>
                        <input className="form-input" value={d.institutionName || ''} onChange={e => setD({ institutionName: e.target.value })} placeholder="ILOILO SCIENCE AND TECHNOLOGY UNIVERSITY" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Campus Name *</label>
                        <input className="form-input" value={d.campusName || ''} onChange={e => setD({ campusName: e.target.value })} placeholder="DUMANGAS CAMPUS" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Campus Address</label>
                        <input className="form-input" value={d.campusAddress || ''} onChange={e => setD({ campusAddress: e.target.value })} placeholder="P.D. Monfort South, Dumangas, Iloilo" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Document Title *</label>
                        <input className="form-input" value={d.documentTitle || ''} onChange={e => setD({ documentTitle: e.target.value })} placeholder="JOB REQUEST FOR REPAIR, MAINTENANCE AND CONSTRUCTION" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Department / Unit</label>
                        <input className="form-input" value={d.department || ''} onChange={e => setD({ department: e.target.value })} placeholder="Department: PDAS" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Document Code (ISO)</label>
                        <input className="form-input" value={d.documentCode || ''} onChange={e => setD({ documentCode: e.target.value })} placeholder="QF-PDAS-DC-01" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Revision Number</label>
                        <input className="form-input" value={d.revisionNo || ''} onChange={e => setD({ revisionNo: e.target.value })} placeholder="00" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Effective Date</label>
                        <input className="form-input" value={d.effectiveDate || ''} onChange={e => setD({ effectiveDate: e.target.value })} placeholder="February 3, 2025" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Custom Logo (Upload or URL)</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <input
                            type="text"
                            className="form-input"
                            value={d.customLogoUrl || ''}
                            onChange={e => setD({ customLogoUrl: e.target.value })}
                            placeholder="Leave blank for official ISAT U logo"
                            style={{ flex: 1 }}
                          />
                          <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}>
                            Upload
                            <input
                              type="file"
                              accept="image/*"
                              style={{ display: 'none' }}
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (!f) return;
                                const r = new FileReader();
                                r.onload = () => setD({ customLogoUrl: r.result });
                                r.readAsDataURL(f);
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Body Typography & Field Labels */}
                  <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '18px', marginBottom: '18px' }}>
                    <div style={{ fontSize: '13px', fontWeight: '800', color: '#001f9c', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '12px' }}>
                      2. Body Layout &amp; Field Labels
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px', marginBottom: '14px' }}>
                      <div className="form-group">
                        <label className="form-label">Document Font Family</label>
                        <select
                          className="form-select"
                          value={d.fontFamily || 'serif'}
                          onChange={e => setD({ fontFamily: e.target.value })}
                        >
                          <option value="serif">Times New Roman (Standard Government / ISO Serif)</option>
                          <option value="sans">Inter / Arial (Modern Clean Sans-Serif)</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Tracking Number Label</label>
                        <input className="form-input" value={d.trackingLabel || ''} onChange={e => setD({ trackingLabel: e.target.value })} placeholder="Tracking Number:" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Date of Request Label</label>
                        <input className="form-input" value={d.dateLabel || ''} onChange={e => setD({ dateLabel: e.target.value })} placeholder="Date of Request:" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Client Name Label</label>
                        <input className="form-input" value={d.clientNameLabel || ''} onChange={e => setD({ clientNameLabel: e.target.value })} placeholder="Name of Client:" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Client Office Label</label>
                        <input className="form-input" value={d.clientOfficeLabel || ''} onChange={e => setD({ clientOfficeLabel: e.target.value })} placeholder="Office of Client:" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Immediate Supervisor Label</label>
                        <input className="form-input" value={d.supervisorLabel || ''} onChange={e => setD({ supervisorLabel: e.target.value })} placeholder="Immediate Supervisor:" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Location Label</label>
                        <input className="form-input" value={d.locationLabel || ''} onChange={e => setD({ locationLabel: e.target.value })} placeholder="Location:" />
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginTop: '6px' }}>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>
                        <input
                          type="checkbox"
                          checked={d.showDefectPhoto !== false}
                          onChange={e => setD({ showDefectPhoto: e.target.checked })}
                        />
                        Include attached photo on printed slip
                      </label>

                    </div>
                  </div>

                  {/* Section 3: Footer & Signatories */}
                  <div style={{ marginBottom: '18px' }}>
                    <div style={{ fontSize: '13px', fontWeight: '800', color: '#001f9c', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '12px' }}>
                      3. Footer, Signatories &amp; Compliance Notices
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px', marginBottom: '14px' }}>
                      <div className="form-group">
                        <label className="form-label">PDAS Office Head Designation Title</label>
                        <input className="form-input" value={d.pdasHeadTitle || ''} onChange={e => setD({ pdasHeadTitle: e.target.value })} placeholder="Head, PDAS / Director, Planning Development..." />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Approver Designation Title</label>
                        <input className="form-input" value={d.approverTitle || ''} onChange={e => setD({ approverTitle: e.target.value })} placeholder="Campus Administrator" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Copy Distribution Notice</label>
                        <input className="form-input" value={d.copyDistribution || ''} onChange={e => setD({ copyDistribution: e.target.value })} placeholder="Copy distribution: 1 – PDAS, 1 – GSM, 1 – Client" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Hardcopy Verification Strip Notice</label>
                        <input className="form-input" value={d.verificationText || ''} onChange={e => setD({ verificationText: e.target.value })} placeholder="Verify this form: scan to check tracking against..." />
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Legal &amp; ISO Compliance Disclaimer</label>
                      <textarea
                        className="form-input"
                        rows={2}
                        value={d.disclaimerNotice || ''}
                        onChange={e => setD({ disclaimerNotice: e.target.value })}
                        placeholder="The electronic approvals recorded on this form are internal..."
                      />
                    </div>
                  </div>

                  {templateMsg && (
                    <div style={{
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: templateMessageType === 'success' ? '#ecfdf5' : '#fef2f2',
                      border: `1px solid ${templateMessageType === 'success' ? '#a7f3d0' : '#fecaca'}`,
                      color: templateMessageType === 'success' ? '#047857' : '#b91c1c',
                      fontSize: '13px',
                      fontWeight: '600',
                      marginBottom: '14px'
                    }}>
                      {templateMsg}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        resetFormTemplateConfig();
                        setTemplateDraft(null);
                        setTemplateMsg('Form template reset to ISO/IEC defaults.');
                        setTemplateMessageType('success');
                      }}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      <RefreshCw size={15} /> Reset to Defaults
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => {
                        updateFormTemplateConfig(templateDraft || {});
                        setTemplateMsg('Form template & layout configuration successfully saved.');
                        setTemplateMessageType('success');
                      }}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Save size={15} /> Save Form Template
                    </button>
                  </div>

                  {/* Section 4: Real-time Live Document Preview */}
                  {showLivePreview && (
                    <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '2px dashed #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <div style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Live Preview of Form (QF-PDAS-DC-01)
                        </div>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>
                          Updates in real-time as you type
                        </span>
                      </div>
                      <div style={{
                        background: 'var(--bg-sunken)',
                        padding: '20px',
                        borderRadius: '10px',
                        border: '1px solid #cbd5e1',
                        maxHeight: '650px',
                        overflowY: 'auto'
                      }}>
                        <div style={{ maxWidth: '750px', margin: '0 auto', background: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
                          <JobRequestPrintSheet req={sampleTicket} customConfig={d} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* TAB 6: TRACKING NUMBERS (ADMIN ONLY) */}
      {activeTab === 'tracking' && isAdmin && (
        <div className="settings-card">
          <div className="settings-card-header">
            <div>
              <div className="settings-card-title"><FileText size={18} color="#001f9c" /> Tracking Number Sequence (QF-PDAS-DC-01)</div>
              <div className="settings-card-subtitle">Issued when the work order is assigned, after final approval. Set where numbering starts / ends. Example preview: <strong>{peekNextTrackingNumber?.() || '—'}</strong></div>
            </div>
          </div>
          {(() => {
            const d = trackingDraft || trackingConfig || {};
            const setD = (patch) => setTrackingDraft(prev => ({ ...(prev || trackingConfig), ...patch }));
            return (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                  <div className="form-group"><label className="form-label">Prefix</label><input className="form-input" value={d.prefix || ''} onChange={e => setD({ prefix: e.target.value })} placeholder="REQ-2026-" /></div>
                  <div className="form-group"><label className="form-label">Start (where to start)</label><input type="number" className="form-input" value={d.start ?? 1} onChange={e => setD({ start: Number(e.target.value) })} /></div>
                  <div className="form-group"><label className="form-label">Next number</label><input type="number" className="form-input" value={d.next ?? 1} onChange={e => setD({ next: Number(e.target.value) })} /></div>
                  <div className="form-group"><label className="form-label">End (where to end)</label><input type="number" className="form-input" value={d.end ?? 9999} onChange={e => setD({ end: Number(e.target.value) })} /></div>
                  <div className="form-group"><label className="form-label">Zero-pad digits</label><input type="number" min={1} max={6} className="form-input" value={d.pad ?? 3} onChange={e => setD({ pad: Number(e.target.value) })} /></div>
                </div>
                {trackingMsg && <div style={{ fontSize: '12.5px', marginBottom: '10px', color: '#047857' }}>{trackingMsg}</div>}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => { setTrackingDraft({ ...trackingConfig }); setTrackingMsg(''); }}>Reset</button>
                  <button type="button" className="btn btn-primary" onClick={() => { updateTrackingConfig(trackingDraft || {}); setTrackingMsg(`Saved. Next tracking: ${peekNextTrackingNumber?.() || '—'}`); }}><Save size={16} /> Save Sequence</button>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Floating Sticky Save Bar on Unsaved Changes */}
      {isCurrentTabDirty && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            bottom: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            background: '#071746',
            color: '#ffffff',
            borderRadius: '12px',
            padding: '12px 20px',
            boxShadow: '0 8px 30px rgba(7, 23, 70, 0.35)',
            display: 'flex',
            alignItems: 'center',
            gap: '18px',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            maxWidth: '90vw'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', fontWeight: '600' }}>
            <AlertCircle size={17} color="#f59e0b" />
            <span>Careful — you have unsaved changes!</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={handleResetActiveTab}
              style={{
                background: 'transparent',
                color: '#cbd5e1',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '8px',
                padding: '6px 14px',
                fontSize: '12.5px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#ffffff'; e.currentTarget.style.borderColor = '#ffffff'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#cbd5e1'; e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)'; }}
            >
              Reset
            </button>
            <button
              type="button"
              onClick={handleSaveActiveTab}
              style={{
                background: '#f59e0b',
                color: '#071746',
                border: 'none',
                borderRadius: '8px',
                padding: '6px 16px',
                fontSize: '12.5px',
                fontWeight: '800',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 6px rgba(245, 158, 11, 0.3)'
              }}
            >
              <Save size={14} /> Save Changes
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

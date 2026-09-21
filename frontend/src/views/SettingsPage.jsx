import React, { useState, useEffect } from 'react';
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
  AlertTriangle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';

export const SettingsPage = () => {
  const { currentUser, updateCurrentUser, isMaintenance, isFacultyOrStaff, isAdmin } = useAuth();
  const { trackingConfig, updateTrackingConfig, peekNextTrackingNumber } = useData();

  // Active Tab State
  const [activeTab, setActiveTab] = useState('profile');

  // Form State
  const [photo, setPhoto] = useState(currentUser?.avatarUrl || '');
  const [avatarColor, setAvatarColor] = useState(currentUser?.avatarColor || '#001f9c');
  const [name, setName] = useState(currentUser?.name || '');
  const [title, setTitle] = useState(currentUser?.roleTitle || currentUser?.title || '');
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
      setAvatarColor(currentUser.avatarColor || '#001f9c');
      setName(currentUser.name || '');
      setTitle(currentUser.roleTitle || currentUser.title || '');
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
  const handleSaveProfile = (e) => {
    e?.preventDefault();
    if (!name.trim()) {
      showMessage('Full Name is required.', 'error');
      return;
    }

    updateCurrentUser({
      name: name.trim(),
      roleTitle: title.trim(),
      phone: phone.trim(),
      department: department.trim(),
      officeRoom: officeRoom.trim(),
      altEmail: altEmail.trim(),
      emergencyContact: emergencyContact.trim(),
      bio: bio.trim(),
      avatarUrl: photo,
      avatarColor: avatarColor,
      initial: name.trim().charAt(0).toUpperCase()
    });

    showMessage('Profile information updated successfully!', 'success');
  };

  // Save Security
  const handleSaveSecurity = (e) => {
    e?.preventDefault();
    if (!newPassword && !currentPassword) {
      updateCurrentUser({ twoFactorEnabled });
      showMessage('Security preferences updated.', 'success');
      return;
    }

    if (newPassword && newPassword.length < 6) {
      showMessage('New password must contain at least 6 characters.', 'error');
      return;
    }

    if (newPassword !== confirmPassword) {
      showMessage('New passwords do not match.', 'error');
      return;
    }

    updateCurrentUser({
      password: newPassword,
      twoFactorEnabled
    });

    setNewPassword('');
    setConfirmPassword('');
    setCurrentPassword('');
    showMessage('Password and security settings updated successfully!', 'success');
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
  const avatarColors = ['#001f9c', '#059669', '#d97706', '#7c3aed', '#dc2626', '#0284c7', '#475569'];

  return (
    <div style={{ maxWidth: '1080px', margin: '0 auto' }}>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 className="page-title">Account Settings & Profile</h1>
            <span style={{
              background: '#eff6ff',
              color: '#001f9c',
              fontSize: '11px',
              fontWeight: '700',
              padding: '2px 8px',
              borderRadius: '6px'
            }}>
              ISAT U Identity & Security
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
            <div className="settings-avatar-wrapper" style={{ backgroundColor: avatarColor }}>
              {photo ? (
                <img src={photo} alt="Avatar" className="settings-avatar-img" />
              ) : (
                currentUser?.initial || name?.charAt(0) || 'U'
              )}
              <label className="settings-avatar-edit-btn" title="Upload new photo">
                <Camera size={15} />
                <input type="file" accept="image/*" onChange={handlePhotoUpload} hidden />
              </label>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: '22px', fontWeight: '800', margin: 0, letterSpacing: '-0.01em' }}>
                  {name || 'FixIT User'}
                </h2>
                <span style={{
                  background: 'rgba(16, 185, 129, 0.2)',
                  color: '#34d399',
                  border: '1px solid rgba(52, 211, 153, 0.4)',
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

              <div style={{ color: '#cbd5e1', fontSize: '13.5px', marginTop: '4px', fontWeight: '500' }}>
                {title || (isMaintenance ? 'Maintenance Specialist' : isFacultyOrStaff ? 'Faculty Requisitioner' : 'Physical Plant Administrator')}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '10px', fontSize: '12.5px', color: '#94a3b8', flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Building size={14} color="#f59e0b" /> {department || 'Physical Development & Auxiliary Services'}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <IdCard size={14} color="#38bdf8" /> ID: {currentUser?.idNumber || 'ISATU-EMP-2026'}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Mail size={14} color="#a78bfa" /> {currentUser?.email || currentUser?.gmail || 'user@isatu.edu.ph'}
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <label className="btn btn-secondary btn-sm" style={{ background: 'rgba(255, 255, 255, 0.15)', color: '#ffffff', border: '1px solid rgba(255, 255, 255, 0.25)', cursor: 'pointer' }}>
              <Camera size={14} /> Upload Photo
              <input type="file" accept="image/*" onChange={handlePhotoUpload} hidden />
            </label>
            {photo && (
              <button 
                type="button" 
                className="btn btn-secondary btn-sm" 
                onClick={handleRemovePhoto}
                style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.4)' }}
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

      {/* Settings Navigation Tabs */}
      <div className="settings-nav-tabs">
        {[
          { id: 'profile', label: 'Profile & Identity', icon: User },
          { id: 'security', label: 'Security & Password', icon: Lock },
          { id: 'notifications', label: 'Notifications & Alerts', icon: Bell },
          { id: 'permissions', label: 'Role & Permissions', icon: Shield },
          { id: 'preferences', label: 'System & Display', icon: Sliders },
          ...(isAdmin ? [{ id: 'tracking', label: 'Tracking Numbers', icon: FileText }] : []),
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              className={`settings-nav-btn ${isActive ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: PROFILE & IDENTITY */}
      {activeTab === 'profile' && (
        <div>
          <div className="settings-card">
            <div className="settings-card-header">
              <div>
                <div className="settings-card-title">
                  <User size={18} color="#001f9c" /> Personal & Institutional Profile
                </div>
                <div className="settings-card-subtitle">
                  Information used on official QF-PDAS-DC-01 requisition forms, job orders, and campus communications.
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
                  <label className="form-label">Department / Academic Office</label>
                  <input
                    type="text"
                    className="form-input"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="e.g. College of Engineering and Architecture (CEA)"
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
                    value={currentUser?.email || currentUser?.gmail || 'user@isatu.edu.ph'}
                    disabled
                    style={{ background: '#f1f5f9', color: '#64748b', cursor: 'not-allowed' }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Institutional Employee/Faculty ID (Read-Only)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={currentUser?.idNumber || 'ISATU-EMP-2026-001'}
                    disabled
                    style={{ background: '#f1f5f9', color: '#64748b', cursor: 'not-allowed' }}
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
                <label className="form-label">Bio / Facility Requisition Notes</label>
                <textarea
                  className="form-textarea"
                  rows="3"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Add any specific notes regarding your department station, maintenance coverage, or requisition preferences..."
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
                  <Key size={18} color="#001f9c" /> Password & Credential Management
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
                    <Shield size={16} color="#001f9c" />
                    Two-Factor Authentication (2FA) for Critical Actions
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                    Require institutional email one-time passcodes when performing high-risk actions (e.g. signature confirmations or role assignments).
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
                  <Laptop size={18} color="#001f9c" /> Active Sessions & Device Activity
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
                    background: sess.isCurrent ? '#eff6ff' : '#f8fafc',
                    border: sess.isCurrent ? '1.5px solid #bfdbfe' : '1px solid #e2e8f0',
                    borderRadius: '10px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '8px',
                      background: sess.isCurrent ? '#001f9c' : '#e2e8f0',
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
                <Bell size={18} color="#001f9c" /> Communication & Notification Preferences
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
                  Requisition Lifecycle Updates
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                  Receive alerts when ticket status updates (Pending → Under Review → Awaiting Signatures → Approved → In Progress → Completed).
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
                  Notify requisitioners to print and route the official QF-PDAS-DC-01 form for wet-ink signatures.
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
                  Prompt requisitioners to submit service quality ratings once a maintenance work order is marked Completed.
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
                <Shield size={18} color="#001f9c" /> Role & Institutional Capabilities Matrix
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
                  Job Requisition Submission
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
              <div className="permission-icon-box" style={{ background: isFacultyOrStaff ? '#f8fafc' : '#eff6ff', color: isFacultyOrStaff ? '#94a3b8' : '#001f9c' }}>
                <Key size={18} />
              </div>
              <div>
                <div style={{ fontWeight: '700', fontSize: '13.5px', color: '#0f172a' }}>
                  Physical Signature Verification Gate
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                  Verify receipt of signed hardcopy QF-PDAS-DC-01 forms and advance tickets to Approved.
                </div>
                <span style={{ fontSize: '11px', fontWeight: '700', color: isFacultyOrStaff ? '#64748b' : '#001f9c', display: 'inline-flex', alignItems: 'center', gap: '3px', marginTop: '6px' }}>
                  {isFacultyOrStaff ? 'Restricted to PDAS Admin' : <><Check size={13} /> Granted</>}
                </span>
              </div>
            </div>

            <div className="permission-matrix-item">
              <div className="permission-icon-box" style={{ background: !isMaintenance && isFacultyOrStaff ? '#f8fafc' : '#fffbeb', color: !isMaintenance && isFacultyOrStaff ? '#94a3b8' : '#d97706' }}>
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
              <div className="permission-icon-box" style={{ background: !isMaintenance && isFacultyOrStaff ? '#f8fafc' : '#fef2f2', color: !isMaintenance && isFacultyOrStaff ? '#94a3b8' : '#dc2626' }}>
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
              <div className="permission-icon-box" style={{ background: isFacultyOrStaff ? '#f8fafc' : '#eff6ff', color: isFacultyOrStaff ? '#94a3b8' : '#001f9c' }}>
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
                  Auto-Save Requisition Drafts Locally
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

      {/* TAB 6: TRACKING NUMBERS (ADMIN ONLY) */}
      {activeTab === 'tracking' && isAdmin && (
        <div className="settings-card">
          <div className="settings-card-header">
            <div>
              <div className="settings-card-title"><FileText size={18} color="#001f9c" /> Tracking Number Sequence (QF-PDAS-DC-01)</div>
              <div className="settings-card-subtitle">Issued ONLY on Final Approver approval. Set where numbering starts / ends. Example preview: <strong>{peekNextTrackingNumber?.() || '—'}</strong></div>
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
    </div>
  );
};

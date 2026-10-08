import React, { useEffect, useState } from 'react';
import {
  Camera,
  Trash2,
  Lock,
  Save,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  User,
  Shield
} from 'lucide-react';
import { Modal } from './Modal';
import { useAuth } from '../../context/AuthContext';

export const SettingsModal = ({ isOpen, onClose }) => {
  const { currentUser, updateCurrentUser } = useAuth();
  
  const [modalTab, setModalTab] = useState('profile');
  const [photo, setPhoto] = useState(currentUser?.avatarUrl || '');
  const [avatarColor, setAvatarColor] = useState(currentUser?.avatarColor || '#001f9c');
  const [name, setName] = useState(currentUser?.name || '');
  const [title, setTitle] = useState(currentUser?.roleTitle || currentUser?.title || '');
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [department, setDepartment] = useState(currentUser?.department || '');
  const [officeRoom, setOfficeRoom] = useState(currentUser?.officeRoom || 'CEA Building Room 204');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(currentUser?.twoFactorEnabled ?? true);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

  useEffect(() => {
    if (currentUser) {
      setPhoto(currentUser.avatarUrl || '');
      setAvatarColor(currentUser.avatarColor || '#001f9c');
      setName(currentUser.name || '');
      setTitle(currentUser.roleTitle || currentUser.title || '');
      setPhone(currentUser.phone || '');
      setDepartment(currentUser.department || '');
      setOfficeRoom(currentUser.officeRoom || 'CEA Building Room 204');
      setNewPassword('');
      setConfirmPassword('');
      setShowNewPassword(false);
      setShowConfirmPassword(false);
      setTwoFactorEnabled(currentUser.twoFactorEnabled ?? true);
      setMessage('');
      setMessageType('');
    }
  }, [currentUser?.id, currentUser?.avatarUrl, isOpen]);

  const handlePhoto = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhoto(reader.result);
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setPhoto('');
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setMessage('');
    setMessageType('');
    if (!name.trim()) {
      setMessage('Full name is required.');
      setMessageType('error');
      return;
    }
    if (newPassword && newPassword.length < 6) {
      setMessage('Password must contain at least 6 characters.');
      setMessageType('error');
      return;
    }
    if (newPassword && newPassword !== confirmPassword) {
      setMessage('Passwords do not match.');
      setMessageType('error');
      return;
    }
    updateCurrentUser({
      avatarUrl: photo,
      avatarColor: avatarColor,
      name: name.trim(),
      roleTitle: title.trim(),
      phone: phone.trim(),
      department: department.trim(),
      officeRoom: officeRoom.trim(),
      initial: name.trim().charAt(0).toUpperCase(),
      twoFactorEnabled,
      ...(newPassword ? { password: newPassword } : {})
    });
    setNewPassword('');
    setConfirmPassword('');
    setMessage('Settings saved successfully.');
    setMessageType('success');
    setTimeout(() => {
      onClose?.();
    }, 1200);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} onBack={onClose} title="Account Settings" maxWidth="600px">
      {/* Mini Tabs */}
      <div style={{ display: 'flex', gap: '6px', borderBottom: '1.5px solid #e2e8f0', marginBottom: '18px', paddingBottom: '2px' }}>
        <button
          type="button"
          onClick={() => setModalTab('profile')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 14px',
            border: 'none',
            background: 'none',
            color: modalTab === 'profile' ? '#001f9c' : '#64748b',
            borderBottom: modalTab === 'profile' ? '2.5px solid #001f9c' : '2.5px solid transparent',
            fontWeight: '700',
            fontSize: '13px',
            cursor: 'pointer'
          }}
        >
          <User size={15} /> Profile Info
        </button>
        <button
          type="button"
          onClick={() => setModalTab('security')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 14px',
            border: 'none',
            background: 'none',
            color: modalTab === 'security' ? '#001f9c' : '#64748b',
            borderBottom: modalTab === 'security' ? '2.5px solid #001f9c' : '2.5px solid transparent',
            fontWeight: '700',
            fontSize: '13px',
            cursor: 'pointer'
          }}
        >
          <Lock size={15} /> Security & Password
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        {modalTab === 'profile' && (
          <div>
            {/* Avatar block */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '18px', padding: '14px', background: 'var(--bg-sunken)', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div className="user-avatar-circle" style={{ backgroundColor: avatarColor, width: '56px', height: '56px', fontSize: '22px', overflow: 'hidden' }}>
                  {photo ? <img src={photo} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (currentUser?.initial || currentUser?.name?.charAt(0) || 'U')}
                </div>
                <div>
                  <div style={{ fontWeight: '800', color: '#0f172a', fontSize: '14px' }}>{name || 'FixIT User'}</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>{currentUser?.email || 'user@isatu.edu.ph'}</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', fontSize: '12px' }}>
                  <Camera size={14} /> Upload
                  <input type="file" accept="image/*" onChange={handlePhoto} hidden />
                </label>
                {photo && (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={handleRemovePhoto} style={{ color: '#dc2626', borderColor: '#fca5a5', padding: '6px' }}>
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div className="form-group">
                <label className="form-label">Full name *</label>
                <input className="form-input" value={name ?? ''} onChange={event => setName(event.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Title / Designation</label>
                <input className="form-input" value={title ?? ''} onChange={event => setTitle(event.target.value)} placeholder="e.g. Associate Professor" />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div className="form-group">
                <label className="form-label">Department / Office</label>
                <input className="form-input" value={department ?? ''} onChange={event => setDepartment(event.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Campus Office / Room</label>
                <input className="form-input" value={officeRoom ?? ''} onChange={event => setOfficeRoom(event.target.value)} placeholder="e.g. CEA Room 204" />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div className="form-group">
                <label className="form-label">Contact number</label>
                <input className="form-input" value={phone ?? ''} onChange={event => setPhone(event.target.value)} placeholder="+63 917 123 4567" />
              </div>
              <div className="form-group">
                <label className="form-label">Institutional ID</label>
                <input className="form-input" value={currentUser?.idNumber || 'Not assigned'} disabled style={{ background: 'var(--bg-muted)', color: '#64748b' }} />
              </div>
            </div>
          </div>
        )}

        {modalTab === 'security' && (
          <div>
            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label className="form-label"><Lock size={14} /> New password</label>
              <div style={{ position: 'relative' }}>
                <input 
                  className="form-input" 
                  style={{ paddingRight: '42px' }} 
                  type={showNewPassword ? 'text' : 'password'} 
                  value={newPassword} 
                  onChange={event => setNewPassword(event.target.value)} 
                  placeholder="Leave blank to keep current password" 
                />
                <button 
                  type="button" 
                  onClick={() => setShowNewPassword(value => !value)} 
                  aria-label={showNewPassword ? 'Hide new password' : 'Show new password'} 
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 0, background: 'none', color: '#64748b', cursor: 'pointer' }}
                >
                  {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label">Confirm new password</label>
              <div style={{ position: 'relative' }}>
                <input 
                  className="form-input" 
                  style={{ paddingRight: '42px' }} 
                  type={showConfirmPassword ? 'text' : 'password'} 
                  value={confirmPassword} 
                  onChange={event => setConfirmPassword(event.target.value)} 
                  placeholder="Re-type new password"
                />
                <button 
                  type="button" 
                  onClick={() => setShowConfirmPassword(value => !value)} 
                  aria-label={showConfirmPassword ? 'Hide password confirmation' : 'Show password confirmation'} 
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 0, background: 'none', color: '#64748b', cursor: 'pointer' }}
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="toggle-switch-container" style={{ marginBottom: '16px' }}>
              <div>
                <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Shield size={15} color="#001f9c" />
                  Two-Factor Authentication (2FA)
                </div>
                <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
                  Institutional email passcodes for high-security actions.
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
          </div>
        )}

        {message && (
          <div 
            role="status" 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '7px', 
              color: messageType === 'success' ? '#047857' : '#b91c1c', 
              background: messageType === 'success' ? '#ecfdf5' : '#fff1f2', 
              border: `1px solid ${messageType === 'success' ? '#a7f3d0' : '#fecdd3'}`, 
              borderRadius: '8px', 
              padding: '10px 12px', 
              fontSize: '13px', 
              margin: '14px 0' 
            }}
          >
            {messageType === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
            {message}
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} style={{ flex: 1 }}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" style={{ flex: 2 }}>
            <Save size={16} /> Save Changes
          </button>
        </div>
      </form>
    </Modal>
  );
};

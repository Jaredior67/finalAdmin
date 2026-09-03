import React, { useEffect, useState } from 'react';
import { Camera, Lock, Save } from 'lucide-react';
import { Modal } from './Modal';
import { useAuth } from '../../context/AuthContext';

export const SettingsModal = ({ isOpen, onClose }) => {
  const { currentUser, updateCurrentUser } = useAuth();
  const [photo, setPhoto] = useState(currentUser?.avatarUrl || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    setPhoto(currentUser?.avatarUrl || '');
    setMessage('');
  }, [currentUser?.id, currentUser?.avatarUrl]);

  const handlePhoto = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhoto(reader.result);
    reader.readAsDataURL(file);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (newPassword && newPassword.length < 6) {
      setMessage('Password must contain at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage('Passwords do not match.');
      return;
    }
    updateCurrentUser({
      avatarUrl: photo,
      initial: currentUser?.initial || currentUser?.name?.charAt(0) || 'U',
      ...(newPassword ? { password: newPassword } : {})
    });
    setNewPassword('');
    setConfirmPassword('');
    setMessage('Settings saved successfully.');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Account Settings" maxWidth="480px">
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
          <div className="user-avatar-circle" style={{ backgroundColor: currentUser?.avatarColor || '#001f9c', overflow: 'hidden' }}>
            {photo ? <img src={photo} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (currentUser?.initial || currentUser?.name?.charAt(0) || 'U')}
          </div>
          <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
            <Camera size={15} /> Change profile photo
            <input type="file" accept="image/*" onChange={handlePhoto} hidden />
          </label>
        </div>
        <div className="form-group">
          <label className="form-label">Account email</label>
          <input className="form-input" value={currentUser?.email || currentUser?.gmail || ''} disabled />
        </div>
        <div className="form-group">
          <label className="form-label"><Lock size={14} /> New password</label>
          <input className="form-input" type="password" value={newPassword} onChange={event => setNewPassword(event.target.value)} placeholder="Leave blank to keep current password" />
        </div>
        <div className="form-group">
          <label className="form-label">Confirm new password</label>
          <input className="form-input" type="password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} />
        </div>
        {message && <p style={{ color: message.includes('successfully') ? '#059669' : '#dc2626', fontSize: '13px', margin: '12px 0' }}>{message}</p>}
        <button type="submit" className="btn btn-primary" style={{ width: '100%' }}><Save size={16} /> Save settings</button>
      </form>
    </Modal>
  );
};

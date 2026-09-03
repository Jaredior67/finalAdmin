import React, { useState } from 'react';
import { Lock, AlertCircle, UserPlus, Eye, EyeOff } from 'lucide-react';
import { Modal } from '../common/Modal';
import { useAuth, TEST_PERSONAS } from '../../context/AuthContext';
import { RegisterModal } from './RegisterModal';
import fixitLogo from '../../assets/fixit-logo.png';

export const LoginModal = () => {
  const { isLoginModalOpen, setIsLoginModalOpen, loginWithCredentials } = useAuth();
  const [email, setEmail] = useState('pdas.director@dumangas.isatu.edu.ph');
  const [password, setPassword] = useState('admin123');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);

  const handleSelectPersona = (persona) => {
    setEmail(persona.email);
    setPassword(persona.password);
    setError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please provide your admin username/email and password.');
      return;
    }
    const res = loginWithCredentials(email, password);
    if (res.success) {
      setError('');
      setIsLoginModalOpen(false);
    } else {
      setError(res.error || 'Access restricted: Only authorized accounts can sign in.');
    }
  };

  const handleOpenRegister = () => {
    setIsLoginModalOpen(false);
    setIsRegisterOpen(true);
  };

  return (
    <>
      <Modal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        title="PDAS Portal Authentication"
        maxWidth="480px"
      >
        <form onSubmit={handleSubmit}>
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <div style={{
              width: '60px',
              height: '60px',
              borderRadius: '16px',
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '10px',
              boxShadow: '0 4px 12px rgba(0, 31, 156, 0.12)'
            }}>
              <img 
                src={fixitLogo} 
                alt="PDAS Logo" 
                style={{ width: '48px', height: '48px', objectFit: 'contain' }}
                onError={(e) => { e.target.src = '/fixit-logo.png'; }}
              />
            </div>
            <div style={{ fontSize: '18px', fontWeight: '900', color: '#001f9c', letterSpacing: '0.04em' }}>
              PDAS Administrative Portal
            </div>
            <div style={{ fontSize: '12.5px', color: '#64748b' }}>
              ISAT U Dumangas Campus Facility Management System
            </div>
          </div>

          {/* Quick Demo Persona Pills */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '10px',
            marginBottom: '16px'
          }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>
              Select Account Role: Faculty / Admin / Maintenance Staff
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
              {TEST_PERSONAS.map(p => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => handleSelectPersona(p)}
                  style={{
                    background: email === p.email ? '#eff4ff' : '#ffffff',
                    border: email === p.email ? '1px solid #001f9c' : '1px solid #cbd5e1',
                    borderRadius: '8px',
                    padding: '8px 6px',
                    fontSize: '11px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    fontWeight: email === p.email ? '700' : '600',
                    color: email === p.email ? '#001f9c' : '#334155'
                  }}
                >
                  <span style={{ fontSize: '15px' }}>{p.iconText}</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
                    {p.roleName || p.title}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#b91c1c',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Email or Username</label>
            <input
              type="text"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. pdas.director@dumangas.isatu.edu.ph"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password / PIN</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '4px' }}>
              Default demo password: <code>admin123</code> (or select persona above)
            </div>
          </div>

          <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ flex: 1 }}
              onClick={() => setIsLoginModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ flex: 2 }}
            >
              <Lock size={16} />
              Sign In
            </button>
          </div>

          <div style={{ marginTop: '18px', textAlign: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '14px' }}>
            <button
              type="button"
              onClick={handleOpenRegister}
              style={{
                background: 'none',
                border: 'none',
                color: '#001f9c',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <UserPlus size={14} />
              Register account? Submit Student/Campus ID
            </button>
          </div>
        </form>
      </Modal>

      <RegisterModal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        onSwitchToLogin={() => {
          setIsRegisterOpen(false);
          setIsLoginModalOpen(true);
        }}
      />
    </>
  );
};

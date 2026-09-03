import React, { useState } from 'react';
import { ShieldAlert, UserCheck, LogIn, UserPlus, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { RegisterModal } from './RegisterModal';
import fixitLogo from '../../assets/fixit-logo.png';

export const AdminGuard = ({ children }) => {
  const { currentUser, isAdmin, loginAsAdmin, setIsLoginModalOpen } = useAuth();
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);

  if (isAdmin) {
    return <>{children}</>;
  }

  return (
    <>
      <div className="admin-guard-container">
        <div className="access-denied-card">
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '20px',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            boxShadow: '0 8px 24px rgba(0, 31, 156, 0.15)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px auto'
          }}>
            <img 
              src={fixitLogo} 
              alt="FixIT Logo" 
              style={{ width: '64px', height: '64px', objectFit: 'contain' }}
              onError={(e) => { e.target.src = '/fixit-logo.png'; }}
            />
          </div>
          
          <h2 className="access-denied-title">
            <span style={{ color: '#001f9c' }}>PDAS</span> Administrator Console
          </h2>
          
          <p className="access-denied-desc">
            Administrative facility controls and executive approvals are restricted <strong>strictly to PDAS Administrators</strong> (ISAT U DUMANGAS CAMPUS 2026).
          </p>

          <div className="current-role-badge-box">
            {currentUser ? (
              <div>
                Current Session: <strong>{currentUser.name}</strong> ({currentUser.roleTitle || currentUser.role})
                <div style={{ fontSize: '11.5px', color: '#ef4444', marginTop: '4px', fontWeight: '600' }}>
                  ⛔ Current role has read-only/standard access
                </div>
              </div>
            ) : (
              <div>
                Status: <strong>Not Authenticated</strong>
                <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '4px' }}>
                  Please sign in with an Administrator account
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button 
              type="button" 
              className="btn btn-primary" 
              style={{ width: '100%', padding: '12px' }}
              onClick={() => loginAsAdmin()}
            >
              <UserCheck size={18} />
              Switch to PDAS Director (Admin)
            </button>
            
            <button 
              type="button" 
              className="btn btn-secondary" 
              style={{ width: '100%', padding: '12px' }}
              onClick={() => setIsLoginModalOpen(true)}
            >
              <LogIn size={18} />
              Sign In with Other Admin Credentials
            </button>

            <button 
              type="button" 
              className="btn btn-outline-primary" 
              style={{ width: '100%', padding: '12px', background: '#fffbeb', borderColor: '#fde68a', color: '#b45309' }}
              onClick={() => setIsRegisterOpen(true)}
            >
              <UserPlus size={18} />
              Register Account (Submit Campus ID)
            </button>
          </div>

          <div style={{ marginTop: '24px', fontSize: '12px', color: '#94a3b8', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
            ISAT U Dumangas Campus • Security & RBAC Enforcement v2.4
          </div>
        </div>
      </div>

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

import React, { useState } from 'react';
import { Bell, LogOut, ChevronDown, UserCheck, AlertTriangle, Settings } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { NotificationDrawer } from './NotificationDrawer';
import { Modal } from '../common/Modal';
import { SettingsModal } from '../common/SettingsModal';
import pdasLogo from '../../assets/fixit-logo.png';

export const Navbar = () => {
  const { currentUser, logout, setIsLoginModalOpen, isMaintenance, isFacultyOrStaff } = useAuth();
  const { notifications } = useData();
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isSignOutConfirmOpen, setIsSignOutConfirmOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const unreadNotifs = notifications.filter(n => n.unread).length;

  const getPortalBadge = () => {
    if (isMaintenance) {
      return {
        chip: 'Field Unit',
        title: 'Maintenance & Technical Operations',
        color: '#d97706'
      };
    }
    if (isFacultyOrStaff) {
      return {
        chip: 'Requisition Desk',
        title: 'Faculty & Staff Requisition Services',
        color: '#001f9c'
      };
    }
    return {
      chip: 'Admin Portal',
      title: 'ISAT U DUMANGAS CAMPUS 2026',
      color: '#001f9c'
    };
  };

  const portalInfo = getPortalBadge();

  return (
    <header className="top-navbar">
      {/* Brand & System Title */}
      <div className="navbar-brand-section">
        <div className="brand-badge">
          <img 
            src={pdasLogo} 
            alt="Official Logo" 
            className="brand-logo-img"
            onError={(e) => { e.target.src = '/fixit-logo.png'; }}
          />
          <div className="brand-text-block">
            <span className="brand-subtitle" style={{ fontSize: '13px', fontWeight: '900', color: '#001f9c' }}>
              ISAT U DUMANGAS CAMPUS
            </span>
          </div>
        </div>

        <div className="navbar-center-tag">
          <span className="pdas-admin-chip">
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: portalInfo.color }}></span>
            {portalInfo.chip}
          </span>
          <span className="campus-system-title">
            {portalInfo.title}
          </span>
        </div>
      </div>

      {/* Right Controls */}
      <div className="navbar-actions-section">
        {/* Notification Bell */}
        <div style={{ position: 'relative' }}>
          <button 
            type="button" 
            className="nav-icon-btn" 
            onClick={() => setIsNotifOpen(!isNotifOpen)}
            aria-label="View notifications"
          >
            <Bell size={18} />
            {unreadNotifs > 0 && <span className="nav-badge-dot"></span>}
          </button>
          
          <NotificationDrawer 
            isOpen={isNotifOpen} 
            onClose={() => setIsNotifOpen(false)} 
          />
        </div>

        {/* User Profile Block & Persona Dropdown */}
        {currentUser ? (
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div 
              className="user-profile-widget"
              onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
              title="Open account menu"
              style={{
                border: isProfileMenuOpen ? '1px solid #001f9c' : '1px solid transparent',
                background: isProfileMenuOpen ? '#eff4ff' : 'transparent'
              }}
            >
              <div className="user-meta-info">
                <span className="user-full-name">{currentUser.name}</span>
                <span className="user-role-label">{currentUser.roleTitle || currentUser.title || currentUser.department}</span>
              </div>
              <div 
                className="user-avatar-circle"
                style={{ backgroundColor: currentUser.avatarColor || '#001f9c' }}
              >
                {currentUser.avatarUrl ? (
                  <img src={currentUser.avatarUrl} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (currentUser.initial || currentUser.name.charAt(0))}
              </div>
              <ChevronDown size={14} color="#64748b" />
            </div>

            {/* Persona Switcher Dropdown */}
            {isProfileMenuOpen && (
              <div style={{
                position: 'absolute',
                top: '100%',
                right: '40px',
                marginTop: '8px',
                width: '280px',
                background: '#ffffff',
                borderRadius: '14px',
                boxShadow: '0 12px 32px rgba(0, 0, 0, 0.15)',
                border: '1px solid #e2e8f0',
                padding: '12px',
                zIndex: 100,
                animation: 'slideUp 0.15s ease'
              }}>
                <button
                  type="button"
                  onClick={() => {
                    setIsProfileMenuOpen(false);
                    setIsSettingsOpen(true);
                  }}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 4px 4px', marginTop: '8px', border: 'none', borderTop: '1px solid #f1f5f9', background: 'none', color: '#334155', fontSize: '12px', fontWeight: '700', cursor: 'pointer', textAlign: 'left' }}
                >
                  <Settings size={14} /> Account Settings
                </button>

                <div style={{
                  borderTop: '1px solid #f1f5f9',
                  marginTop: '8px',
                  paddingTop: '8px',
                  display: 'flex',
                  justifyContent: 'space-between'
                }}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      setIsSignOutConfirmOpen(true);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#ef4444',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '4px'
                    }}
                  >
                    <LogOut size={13} />
                    Sign Out
                  </button>
                </div>
              </div>
            )}

            <button 
              type="button" 
              className="logout-nav-btn" 
              onClick={() => setIsSignOutConfirmOpen(true)}
              title="Sign Out of PDAS"
              aria-label="Log out"
            >
              <LogOut size={18} />
            </button>
          </div>
        ) : (
          <button 
            type="button" 
            className="btn btn-primary btn-sm"
            onClick={() => setIsLoginModalOpen(true)}
          >
            Sign In
          </button>
        )}
      </div>

      {/* Sign Out Confirmation Modal */}
      <Modal
        isOpen={isSignOutConfirmOpen}
        onClose={() => setIsSignOutConfirmOpen(false)}
        title="Sign Out Confirmation"
        maxWidth="420px"
      >
        <div style={{ textAlign: 'center', padding: '10px 0' }}>
          <div style={{
            width: '54px',
            height: '54px',
            borderRadius: '50%',
            background: '#fee2e2',
            color: '#dc2626',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px'
          }}>
            <LogOut size={26} />
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', marginBottom: '8px' }}>
            Sign Out of PDAS?
          </h3>
          <p style={{ fontSize: '13.5px', color: '#475569', lineHeight: '1.5', marginBottom: '24px' }}>
            Are you sure you want to end your current session? You will need to log back in to access facility management features.
          </p>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ flex: 1 }}
              onClick={() => setIsSignOutConfirmOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-danger"
              style={{ flex: 1 }}
              onClick={() => {
                setIsSignOutConfirmOpen(false);
                logout();
              }}
            >
              Sign Out
            </button>
          </div>
        </div>
      </Modal>
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </header>
  );
};


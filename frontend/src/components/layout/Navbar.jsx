import React, { useState } from 'react';
import { Bell, LogOut, ChevronDown, Settings, Search } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { NotificationDrawer } from './NotificationDrawer';
import { Modal } from '../common/Modal';
import { SettingsModal } from '../common/SettingsModal';
import pdasLogo from '../../assets/fixit-logo.png';

export const Navbar = ({ onSearch = null, onToggleSidebar = null }) => {
  const { currentUser, logout, setIsLoginModalOpen } = useAuth();
  const { notifications } = useData();
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isSignOutConfirmOpen, setIsSignOutConfirmOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const unreadNotifs = notifications ? notifications.filter(n => n.unread).length : 0;

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (onSearch) onSearch(val);
  };

  return (
    <header className="top-navbar" style={{ height: '64px', background: '#ffffff', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', position: 'sticky', top: 0, zIndex: 100 }}>
      {/* Left Brand Section: sidebar toggle + FixIT logo + ISAT U Dumangas Campus */}
      <div className="navbar-brand-section" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <img 
          src={pdasLogo} 
          alt="FixIT Logo" 
          style={{ height: '36px', width: 'auto', objectFit: 'contain', flexShrink: 0 }}
          onError={(e) => { e.target.src = '/fixit-logo.png'; }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', whiteSpace: 'nowrap', lineHeight: 1.25 }}>
          <span style={{ fontSize: '13.5px', fontWeight: '800', color: '#001f9c', letterSpacing: '0.02em' }}>
            ISAT U Dumangas Campus
          </span>
          <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>
            PDAS Facility Management
          </span>
        </div>
      </div>

      {/* Global Search Bar */}
      <div className="navbar-search-bar" style={{ flex: '1', maxWidth: '400px', margin: '0 24px', position: 'relative' }}>
        <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
        <input
          type="text"
          value={searchQuery}
          onChange={handleSearchChange}
          placeholder="Search tracking no., location, requester..."
          style={{
            width: '100%',
            height: '38px',
            paddingLeft: '38px',
            paddingRight: '12px',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            background: '#f8fafc',
            fontSize: '13px',
            color: '#0f172a',
            outline: 'none',
            transition: 'all 0.15s'
          }}
          onFocus={(e) => { e.target.style.background = '#ffffff'; e.target.style.borderColor = '#001f9c'; }}
          onBlur={(e) => { e.target.style.background = '#f8fafc'; e.target.style.borderColor = '#cbd5e1'; }}
        />
      </div>

      {/* Right Controls */}
      <div className="navbar-actions-section" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        {/* Notification Bell */}
        <div style={{ position: 'relative' }}>
          <button 
            type="button" 
            className="nav-icon-btn" 
            onClick={() => setIsNotifOpen(!isNotifOpen)}
            aria-label="View notifications"
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              background: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#475569',
              cursor: 'pointer',
              position: 'relative'
            }}
          >
            <Bell size={18} />
            {unreadNotifs > 0 && (
              <span style={{
                position: 'absolute',
                top: '6px',
                right: '6px',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#dc2626'
              }} />
            )}
          </button>
          
          <NotificationDrawer 
            isOpen={isNotifOpen} 
            onClose={() => setIsNotifOpen(false)} 
          />
        </div>

        {/* User Profile Block & Persona Menu */}
        {currentUser ? (
          <div style={{ position: 'relative' }}>
            <div 
              className="user-profile-widget"
              onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
              title="Open account menu"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '4px 8px',
                borderRadius: '8px',
                border: isProfileMenuOpen ? '1px solid #001f9c' : '1px solid transparent',
                background: isProfileMenuOpen ? '#eff4ff' : 'transparent',
                cursor: 'pointer'
              }}
            >
              <div 
                className="user-avatar-circle"
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  backgroundColor: currentUser.avatarColor || '#001f9c',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '700',
                  fontSize: '13px'
                }}
              >
                {currentUser.avatarUrl ? (
                  <img src={currentUser.avatarUrl} alt="Profile" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                ) : (currentUser.initial || (currentUser.name && currentUser.name.charAt(0)) || 'U')}
              </div>
              <div className="user-meta-info" style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                <span className="user-full-name" style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', lineHeight: 1.2 }}>
                  {currentUser.name}
                </span>
                <span className="user-role-label" style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>
                  {currentUser.roleTitle || currentUser.role || 'User'}
                </span>
              </div>
              <ChevronDown size={14} color="#64748b" />
            </div>

            {/* Profile Dropdown */}
            {isProfileMenuOpen && (
              <div style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '8px',
                width: '240px',
                background: '#ffffff',
                borderRadius: '12px',
                boxShadow: '0 12px 32px rgba(0, 0, 0, 0.12)',
                border: '1px solid #e2e8f0',
                padding: '8px',
                zIndex: 100
              }}>
                <div style={{ padding: '8px 10px', borderBottom: '1px solid #f1f5f9', marginBottom: '4px' }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>{currentUser.name}</div>
                  <div style={{ fontSize: '11.5px', color: '#64748b' }}>{currentUser.email}</div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsProfileMenuOpen(false);
                    setIsSettingsOpen(true);
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 10px',
                    border: 'none',
                    borderRadius: '6px',
                    background: 'none',
                    color: '#334155',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#f8fafc'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
                >
                  <Settings size={15} color="#64748b" /> Profile & Settings
                </button>

                <div style={{ borderTop: '1px solid #f1f5f9', marginTop: '4px', paddingTop: '4px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      setIsSignOutConfirmOpen(true);
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 10px',
                      border: 'none',
                      borderRadius: '6px',
                      background: 'none',
                      color: '#dc2626',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#fef2f2'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
                  >
                    <LogOut size={15} /> Sign Out
                  </button>
                </div>
              </div>
            )}
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
              style={{ flex: 1, background: '#dc2626', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: '700' }}
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

import React from 'react';
import { Bell, Check, Clock, AlertTriangle, ShieldCheck, X } from 'lucide-react';
import { useData } from '../../context/DataContext';

export const NotificationDrawer = ({ isOpen, onClose }) => {
  const { notifications, setNotifications } = useData();

  if (!isOpen) return null;

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
  };

  return (
    <div 
      style={{
        position: 'absolute',
        top: '60px',
        right: '24px',
        width: '360px',
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '16px',
        boxShadow: '0 20px 30px -10px rgba(15, 23, 42, 0.15)',
        zIndex: 50,
        overflow: 'hidden',
        animation: 'slideUp 0.15s ease'
      }}
    >
      <div style={{
        padding: '16px 18px',
        borderBottom: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: '#f8fafc'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Bell size={18} color="#001f9c" />
          <span style={{ fontWeight: '700', fontSize: '14px', color: '#0f172a' }}>Admin Notifications</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            type="button"
            onClick={markAllAsRead}
            style={{
              background: 'none',
              border: 'none',
              color: '#2563eb',
              fontSize: '11.5px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Mark all read
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#64748b',
              cursor: 'pointer',
              padding: '2px'
            }}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
        {notifications.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
            No new notifications
          </div>
        ) : (
          notifications.map(n => (
            <div
              key={n.id}
              style={{
                padding: '14px 18px',
                borderBottom: '1px solid #f1f5f9',
                background: n.unread ? '#eff6ff' : '#ffffff',
                display: 'flex',
                gap: '12px',
                transition: 'background 0.15s'
              }}
            >
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: n.title.includes('Emergency') ? '#fee2e2' : '#e0e7ff',
                color: n.title.includes('Emergency') ? '#dc2626' : '#1d4ed8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                {n.title.includes('Emergency') ? <AlertTriangle size={16} /> : <ShieldCheck size={16} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>{n.title}</span>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>{n.time}</span>
                </div>
                <p style={{ fontSize: '12px', color: '#475569', lineHeight: 1.4, margin: 0 }}>
                  {n.text}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      <div style={{ padding: '10px', textAlign: 'center', background: '#f8fafc', borderTop: '1px solid #f1f5f9' }}>
        <span style={{ fontSize: '11.5px', color: '#64748b' }}>
          ISAT U DUMANGAS CAMPUS 2026
        </span>
      </div>
    </div>
  );
};

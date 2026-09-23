import React, { useState } from 'react';
import { Bell, BellOff, AlertTriangle, ShieldCheck, X, Trash2 } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { ConfirmDialog } from '../common/ConfirmDialog';

export const NotificationDrawer = ({ isOpen, onClose }) => {
  const {
    notifications,
    markAllNotificationsRead,
    markNotificationRead,
    deleteNotification,
    clearAllNotifications,
  } = useData();
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isClearAllOpen, setIsClearAllOpen] = useState(false);

  if (!isOpen) return null;

  const unreadCount = notifications.filter(n => n.unread).length;

  const handleConfirmDelete = () => {
    if (deleteTarget) deleteNotification(deleteTarget.id);
    setDeleteTarget(null);
  };

  const handleConfirmClearAll = () => {
    clearAllNotifications();
    setIsClearAllOpen(false);
  };

  return (
    <>
      <div
        style={{
          position: 'absolute',
          top: '60px',
          right: '24px',
          width: 'min(380px, calc(100vw - 32px))',
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
            <span style={{ fontWeight: '700', fontSize: '14px', color: '#0f172a' }}>Notifications</span>
            {unreadCount > 0 && (
              <span style={{ fontSize: '11px', fontWeight: '700', color: '#ffffff', background: '#dc2626', borderRadius: '9999px', padding: '1px 8px' }}>
                {unreadCount} new
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {notifications.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={markAllNotificationsRead}
                  style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '11.5px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Mark all read
                </button>
                <button
                  type="button"
                  onClick={() => setIsClearAllOpen(true)}
                  title="Delete all notifications"
                  style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '11.5px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Clear all
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close notifications"
              style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '2px', display: 'flex' }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
          {notifications.length === 0 ? (
            <div style={{ padding: '36px 24px', textAlign: 'center' }}>
              <BellOff size={32} color="#cbd5e1" style={{ margin: '0 auto 10px auto' }} />
              <div style={{ fontSize: '13.5px', fontWeight: '700', color: '#334155' }}>You're all caught up</div>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>New ticket updates will appear here.</div>
            </div>
          ) : (
            notifications.map(n => (
              <div
                key={n.id}
                onClick={() => n.unread && markNotificationRead(n.id)}
                title={n.unread ? 'Click to mark as read' : undefined}
                style={{
                  padding: '14px 18px',
                  borderBottom: '1px solid #f1f5f9',
                  background: n.unread ? '#eff6ff' : '#ffffff',
                  display: 'flex',
                  gap: '12px',
                  transition: 'background 0.15s',
                  cursor: n.unread ? 'pointer' : 'default'
                }}
              >
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: n.title.includes('Urgent') ? '#fee2e2' : '#e0e7ff',
                  color: n.title.includes('Urgent') ? '#dc2626' : '#1d4ed8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  {n.title.includes('Urgent') ? <AlertTriangle size={16} /> : <ShieldCheck size={16} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      {n.unread && <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#2563eb', flexShrink: 0 }} />}
                      {n.title}
                    </span>
                    <span style={{ fontSize: '11px', color: '#94a3b8', flexShrink: 0 }}>{n.time}</span>
                  </div>
                  <p style={{ fontSize: '12px', color: '#475569', lineHeight: 1.4, margin: 0 }}>
                    {n.text}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setDeleteTarget(n); }}
                  title="Delete this notification"
                  aria-label={`Delete notification: ${n.title}`}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#cbd5e1',
                    cursor: 'pointer',
                    padding: '4px',
                    alignSelf: 'flex-start',
                    display: 'flex',
                    borderRadius: '6px'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#dc2626'; e.currentTarget.style.background = '#fef2f2'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = '#cbd5e1'; e.currentTarget.style.background = 'none'; }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Delete this notification?"
        message={`"${deleteTarget?.title || ''}" will be permanently removed from your list.`}
        confirmText="Delete"
        isDanger
      />

      <ConfirmDialog
        isOpen={isClearAllOpen}
        onClose={() => setIsClearAllOpen(false)}
        onConfirm={handleConfirmClearAll}
        title="Clear all notifications?"
        message="Every notification in your list will be permanently removed."
        confirmText="Clear All"
        isDanger
      />
    </>
  );
};

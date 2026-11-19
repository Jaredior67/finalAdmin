import React, { useState, useMemo } from 'react';
import {
  Bell,
  CheckCheck,
  Archive,
  RotateCcw,
  Trash2,
  Search,
  Filter,
  AlertTriangle,
  Clock,
  ArrowRight,
  ExternalLink,
  ShieldAlert,
  CheckCircle2,
  Wrench,
  FileText,
  Mail,
  X
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { PageHeader } from '../components/common/PageHeader';

// Pull a ticket reference out of any notification shape
const extractTicketRef = (n) => {
  if (!n) return null;
  if (n.ticketRef || n.controlNo || n.ticket_no || n.reqId) {
    return String(n.ticketRef || n.controlNo || n.ticket_no || n.reqId).trim();
  }
  const haystack = `${n.title || ''} ${n.text || ''} ${n.message || ''}`;
  const tracked = haystack.match(/([A-Z]{2,4}-\d{4}-\d+|REQ-[A-Z0-9-]+|JR-[A-Z0-9-]+|TKT-[A-Z0-9-]+|TRK-[A-Z0-9-]+)/i);
  if (tracked) return tracked[0].replace(/[.,:;)]+$/, '').trim();
  const linkMatch = String(n.link || '').match(/(?:job-requests|job_requests|requests)\/([^/?#]+)/);
  if (linkMatch) return decodeURIComponent(linkMatch[1]).replace(/[.,:;)]+$/, '').trim();
  return null;
};

// Format timestamp cleanly
const formatNotificationDate = (dateVal) => {
  if (!dateVal) return 'Recently';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return String(dateVal);

  const now = new Date();
  const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);

  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 172800) return 'Yesterday';

  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    hour: 'numeric',
    minute: '2-digit'
  });
};

// Categorize notification into organized buckets
const getNotificationCategory = (n) => {
  const text = `${n.title || ''} ${n.text || ''} ${n.message || ''}`.toLowerCase();
  if (text.includes('urgent') || text.includes('emergency') || text.includes('hazard') || text.includes('high risk')) {
    return 'urgent';
  }
  if (text.includes('endorse') || text.includes('approval') || text.includes('approved') || text.includes('rejected') || text.includes('returned')) {
    return 'approvals';
  }
  if (text.includes('assigned') || text.includes('work order') || text.includes('dispatch') || text.includes('completed') || text.includes('repair') || text.includes('maintenance')) {
    return 'requests';
  }
  return 'system';
};

export const NotificationsCenter = ({ onNavigateTab }) => {
  const {
    notifications,
    archivedNotifications,
    markAllNotificationsRead,
    markNotificationRead,
    archiveNotification,
    restoreNotification,
    deleteNotification,
    clearAllNotifications,
    setFocusedTicketRef,
  } = useData();

  const { isCampusAdmin, isMaintenance, isFacultyOrStaff, isSupervisor } = useAuth();

  const [activeFilter, setActiveFilter] = useState('all');
  const [viewMode, setViewMode] = useState('inbox');
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isClearAllOpen, setIsClearAllOpen] = useState(false);

  const safeNotifications = useMemo(() => {
    return (Array.isArray(notifications) ? notifications : [])
      .filter(n => n && typeof n === 'object');
  }, [notifications]);

  const safeArchivedNotifications = useMemo(() => {
    return (Array.isArray(archivedNotifications) ? archivedNotifications : [])
      .filter(n => n && typeof n === 'object');
  }, [archivedNotifications]);

  const counts = useMemo(() => {
    const total = safeNotifications.length;
    const unread = safeNotifications.filter(n => n.unread).length;
    const urgent = safeNotifications.filter(n => getNotificationCategory(n) === 'urgent').length;
    const requests = safeNotifications.filter(n => getNotificationCategory(n) === 'requests').length;
    const approvals = safeNotifications.filter(n => getNotificationCategory(n) === 'approvals').length;
    const archived = safeArchivedNotifications.length;
    return { total, unread, urgent, requests, approvals, archived };
  }, [safeNotifications, safeArchivedNotifications]);

  const visibleNotifications = viewMode === 'archived' ? safeArchivedNotifications : safeNotifications;

  const filteredNotifications = useMemo(() => {
    return visibleNotifications.filter(n => {
      // Category filter
      if (activeFilter === 'unread' && !n.unread) return false;
      if (activeFilter === 'urgent' && getNotificationCategory(n) !== 'urgent') return false;
      if (activeFilter === 'requests' && getNotificationCategory(n) !== 'requests') return false;
      if (activeFilter === 'approvals' && getNotificationCategory(n) !== 'approvals') return false;

      // Search query
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const hay = `${n.title || ''} ${n.text || ''} ${n.message || ''} ${n.created_at || ''}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });
  }, [visibleNotifications, activeFilter, searchTerm]);

  // Navigate to ticket or relevant section
  const handleOpenTicket = (n) => {
    if (n.unread) markNotificationRead(n.id);
    const link = String(n.link || '').toLowerCase();
    const title = String(n.title || '').toLowerCase();
    const text = String(n.text || n.message || '').toLowerCase();

    // 1. Job request tickets (highest priority: if notification is about a ticket)
    const ref = extractTicketRef(n);
    if (ref) {
      setFocusedTicketRef(ref);

      let targetTab = 'job-requests';
      if (isCampusAdmin) {
        targetTab = 'campus-admin-dashboard';
      } else if (isMaintenance) {
        targetTab = 'tech-tasks';
      } else if (isSupervisor && (title.includes('supervisor') || text.includes('endorse') || text.includes('supervisee'))) {
        targetTab = 'supervisor-queue';
      } else if (isFacultyOrStaff) {
        targetTab = 'faculty-history';
      }

      if (onNavigateTab) onNavigateTab(targetTab);
      return;
    }

    // 2. Messages / Chat
    if (link.includes('/messages') || title.startsWith('new message') || title.startsWith('reply:') || text.includes('sent a direct message')) {
      const msgTab = isFacultyOrStaff ? 'faculty-messages' : isMaintenance ? 'tech-messages' : 'communication-box';
      if (onNavigateTab) onNavigateTab(msgTab);
      return;
    }

    // 3. Supervisor Assignment
    if (title.includes('supervisor assigned') || title.includes('supervisee assigned') || title.includes('supervision assigned') || (title.includes('supervisor') && (text.includes('assigned as your') || text.includes('assigned under your')))) {
      const supTab = isSupervisor ? 'supervisor-queue' : 'settings';
      if (onNavigateTab) onNavigateTab(supTab);
      return;
    }

    // 4. User registration approval
    if (link.includes('/users') || link.includes('registration') || title.includes('registration')) {
      if (onNavigateTab) onNavigateTab('user-management');
      return;
    }

    // 5. Preventive maintenance schedule
    if (link.includes('preventive') || title.includes('preventive') || title.includes('schedule')) {
      const calTab = isMaintenance ? 'tech-calendar' : 'preventive-calendar';
      if (onNavigateTab) onNavigateTab(calTab);
      return;
    }

    // Fallback: default role view
    const defaultTab = isCampusAdmin ? 'campus-admin-dashboard' : isMaintenance ? 'tech-tasks' : isFacultyOrStaff ? 'faculty-history' : 'job-requests';
    if (onNavigateTab) onNavigateTab(defaultTab);
  };

  const getCategoryStyles = (category, isUrgent) => {
    if (isUrgent || category === 'urgent') {
      return {
        bg: '#fff1f2',
        border: '#fecdd3',
        text: '#b91c1c',
        badgeBg: '#ffe4e6',
        badgeColor: '#9f1239',
        icon: AlertTriangle,
        iconBg: '#991b1b',
        iconColor: '#ffffff'
      };
    }
    if (category === 'requests') {
      return {
        bg: '#f0f9ff',
        border: '#bae6fd',
        text: '#0369a1',
        badgeBg: '#e0f2fe',
        badgeColor: '#0284c7',
        icon: Wrench,
        iconBg: '#0284c7',
        iconColor: '#ffffff'
      };
    }
    if (category === 'approvals') {
      return {
        bg: '#f0fdf4',
        border: '#bbf7d0',
        text: '#15803d',
        badgeBg: '#dcfce7',
        badgeColor: '#16a34a',
        icon: CheckCircle2,
        iconBg: '#16a34a',
        iconColor: '#ffffff'
      };
    }
    return {
      bg: '#f8fafc',
      border: '#e2e8f0',
      text: '#475569',
      badgeBg: '#f1f5f9',
      badgeColor: '#475569',
      icon: Bell,
      iconBg: '#64748b',
      iconColor: '#ffffff'
    };
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', paddingBottom: '40px' }}>
      {/* Top Page Header */}
      <PageHeader
        breadcrumbs={['Communications', 'Notifications']}
        title="Notifications"
        description="Real-time alerts, maintenance dispatches, and workflow notifications."
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {viewMode === 'inbox' && counts.unread > 0 && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={markAllNotificationsRead}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: '600' }}
              >
                <CheckCheck size={15} color="#001f9c" />
                Mark all read
              </button>
            )}
            {viewMode === 'inbox' && counts.total > 0 && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setIsClearAllOpen(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#b91c1c', borderColor: '#fca5a5' }}
              >
                <Trash2 size={15} />
                Clear all
              </button>
            )}
          </div>
        }
      />

      {/* Filter Tabs & Search Bar Card */}
      <div className="content-card" style={{ padding: '16px 20px', marginBottom: '20px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexWrap: 'wrap',
          marginBottom: '14px',
          paddingBottom: '14px',
          borderBottom: '1px solid var(--border-subtle, #e2e8f0)'
        }}>
          <button
            type="button"
            onClick={() => { setViewMode('inbox'); setActiveFilter('all'); }}
            style={{
              padding: '7px 14px',
              borderRadius: '8px',
              border: viewMode === 'inbox' ? '1px solid #001f9c' : '1px solid transparent',
              background: viewMode === 'inbox' ? '#001f9c' : 'transparent',
              color: viewMode === 'inbox' ? '#ffffff' : '#475569',
              fontSize: '12.5px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Bell size={14} />
            Inbox
            <span style={{ fontSize: '11px', padding: '1px 7px', borderRadius: '999px', background: viewMode === 'inbox' ? 'rgba(255,255,255,0.22)' : 'var(--bg-sunken)', color: viewMode === 'inbox' ? '#ffffff' : '#64748b' }}>
              {counts.total}
            </span>
          </button>
          <button
            type="button"
            onClick={() => { setViewMode('archived'); setActiveFilter('all'); }}
            style={{
              padding: '7px 14px',
              borderRadius: '8px',
              border: viewMode === 'archived' ? '1px solid #001f9c' : '1px solid transparent',
              background: viewMode === 'archived' ? '#001f9c' : 'transparent',
              color: viewMode === 'archived' ? '#ffffff' : '#475569',
              fontSize: '12.5px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Archive size={14} />
            Archived
            <span style={{ fontSize: '11px', padding: '1px 7px', borderRadius: '999px', background: viewMode === 'archived' ? 'rgba(255,255,255,0.22)' : 'var(--bg-sunken)', color: viewMode === 'archived' ? '#ffffff' : '#64748b' }}>
              {counts.archived}
            </span>
          </button>
          {viewMode === 'archived' && (
            <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#64748b' }}>
              Archived notifications are hidden from the inbox and unread badge.
            </span>
          )}
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px'
        }}>
          {/* Category Filter Pills */}
          {viewMode === 'inbox' && (
          <div style={{ display: 'inline-flex', background: 'var(--bg-sunken)', padding: '4px', borderRadius: '10px', gap: '4px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              style={{
                padding: '6px 14px',
                borderRadius: '7px',
                border: 'none',
                fontSize: '12.5px',
                fontWeight: activeFilter === 'all' ? '700' : '500',
                background: activeFilter === 'all' ? '#001f9c' : 'transparent',
                color: activeFilter === 'all' ? '#ffffff' : '#475569',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              All Notifications
              <span style={{
                fontSize: '11px',
                padding: '1px 6px',
                borderRadius: '8px',
                background: activeFilter === 'all' ? 'rgba(255,255,255,0.25)' : '#e2e8f0',
                color: activeFilter === 'all' ? '#ffffff' : '#64748b',
                fontWeight: '700'
              }}>
                {counts.total}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter('unread')}
              style={{
                padding: '6px 14px',
                borderRadius: '7px',
                border: 'none',
                fontSize: '12.5px',
                fontWeight: activeFilter === 'unread' ? '700' : '500',
                background: activeFilter === 'unread' ? '#001f9c' : 'transparent',
                color: activeFilter === 'unread' ? '#ffffff' : '#475569',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              Unread
              {counts.unread > 0 && (
                <span style={{
                  fontSize: '11px',
                  padding: '1px 6px',
                  borderRadius: '8px',
                  background: activeFilter === 'unread' ? '#ef4444' : '#fee2e2',
                  color: activeFilter === 'unread' ? '#ffffff' : '#dc2626',
                  fontWeight: '700'
                }}>
                  {counts.unread}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter('urgent')}
              style={{
                padding: '6px 14px',
                borderRadius: '7px',
                border: 'none',
                fontSize: '12.5px',
                fontWeight: activeFilter === 'urgent' ? '700' : '500',
                background: activeFilter === 'urgent' ? '#001f9c' : 'transparent',
                color: activeFilter === 'urgent' ? '#ffffff' : '#475569',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              Urgent &amp; Emergencies
              {counts.urgent > 0 && (
                <span style={{
                  fontSize: '11px',
                  padding: '1px 6px',
                  borderRadius: '8px',
                  background: activeFilter === 'urgent' ? 'rgba(255,255,255,0.25)' : '#fee2e2',
                  color: activeFilter === 'urgent' ? '#ffffff' : '#b91c1c',
                  fontWeight: '700'
                }}>
                  {counts.urgent}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter('requests')}
              style={{
                padding: '6px 14px',
                borderRadius: '7px',
                border: 'none',
                fontSize: '12.5px',
                fontWeight: activeFilter === 'requests' ? '700' : '500',
                background: activeFilter === 'requests' ? '#001f9c' : 'transparent',
                color: activeFilter === 'requests' ? '#ffffff' : '#475569',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              Work Orders &amp; Dispatches
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter('approvals')}
              style={{
                padding: '6px 14px',
                borderRadius: '7px',
                border: 'none',
                fontSize: '12.5px',
                fontWeight: activeFilter === 'approvals' ? '700' : '500',
                background: activeFilter === 'approvals' ? '#001f9c' : 'transparent',
                color: activeFilter === 'approvals' ? '#ffffff' : '#475569',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              Approvals &amp; Reviews
            </button>
          </div>
          )}

          {/* Search Input */}
          <div style={{ position: 'relative', width: '280px', minWidth: '220px' }}>
            <Search size={15} style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search notifications..."
              className="form-input"
              style={{ paddingLeft: '32px', paddingRight: searchTerm ? '28px' : '10px', height: '34px', fontSize: '12.5px', borderRadius: '8px' }}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                aria-label="Clear search"
                style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center' }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Notifications List Card */}
      <div className="content-card" style={{ padding: '0', overflow: 'hidden' }}>
        {filteredNotifications.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b' }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: 'var(--bg-sunken)',
              color: '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px auto'
            }}>
              <Bell size={26} />
            </div>
            <div style={{ fontSize: '15px', fontWeight: '700', color: '#334155' }}>
              {viewMode === 'archived' ? 'No archived notifications found' : 'No notifications found'}
            </div>
            <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px', maxWidth: '320px', margin: '4px auto 0 auto' }}>
              {searchTerm
                ? `No notifications matched "${searchTerm}". Try a different keyword.`
                : viewMode === 'archived'
                  ? 'Notifications you archive from the inbox will appear here.'
                  : activeFilter === 'unread'
                    ? "You're all caught up! No unread notifications at this time."
                    : 'Your notification inbox is currently clear.'}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {filteredNotifications.map((n, idx) => {
              const category = getNotificationCategory(n);
              const title = String(n.title || 'Notification');
              const body = String(n.text ?? n.message ?? '');
              const isUrgent = title.toLowerCase().includes('urgent') || body.toLowerCase().includes('urgent');
              const ref = extractTicketRef(n);
              const styles = getCategoryStyles(category, isUrgent);
              const CategoryIcon = styles.icon;

              return (
                <div
                  key={n.id || `notif-${idx}`}
                  className="notif-center-row"
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    padding: '16px 24px',
                    borderBottom: idx < filteredNotifications.length - 1 ? '1px solid var(--border-subtle, #e2e8f0)' : 'none',
                    background: n.unread ? 'var(--primary-light, #edf3ff)' : 'var(--bg-card, #ffffff)',
                    transition: 'background 0.15s ease',
                    gap: '16px'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = n.unread ? 'var(--primary-surface, #dfe9ff)' : 'var(--bg-hover, #cdd4e2)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = n.unread ? 'var(--primary-light, #edf3ff)' : 'var(--bg-card, #ffffff)'; }}
                >
                  {/* Left Icon & Body */}
                  <div className="notif-center-main" style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', flex: 1, minWidth: 0 }}>
                    <div style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '10px',
                      background: styles.iconBg,
                      color: styles.iconColor,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginTop: '2px',
                      boxShadow: isUrgent ? '0 2px 8px rgba(153, 27, 27, 0.25)' : 'none'
                    }}>
                      <CategoryIcon size={18} />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '3px' }}>
                        {n.unread && (
                          <span style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: '#2563eb',
                            display: 'inline-block',
                            flexShrink: 0
                          }} />
                        )}
                        <span style={{
                          fontSize: '14px',
                          fontWeight: n.unread ? '800' : '700',
                          color: isUrgent ? '#991b1b' : '#0f172a'
                        }}>
                          {title}
                        </span>

                        {isUrgent && (
                          <span style={{
                            fontSize: '10.5px',
                            fontWeight: '700',
                            padding: '1px 7px',
                            borderRadius: '6px',
                            background: '#fee2e2',
                            color: '#b91c1c'
                          }}>
                            URGENT
                          </span>
                        )}

                        {ref && (
                          <span style={{
                            fontSize: '11px',
                            fontWeight: '700',
                            padding: '1px 7px',
                            borderRadius: '6px',
                            background: '#eff6ff',
                            color: '#1d4ed8',
                            border: '1px solid #dbeafe',
                            fontFamily: 'monospace'
                          }}>
                            {ref}
                          </span>
                        )}
                      </div>

                      <div style={{
                        fontSize: '13px',
                        color: '#475569',
                        lineHeight: 1.45,
                        wordBreak: 'break-word',
                        marginBottom: '6px'
                      }}>
                        {body}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11.5px', color: '#94a3b8' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={12} />
                          {formatNotificationDate(n.created_at || n.time || n.date)}
                        </span>
                        {(n.created_at || n.time) && (
                          <span style={{ color: '#cbd5e1' }}>•</span>
                        )}
                        {(n.created_at || n.time) && (
                          <span>{String(n.created_at || n.time).slice(0, 19).replace('T', ' ')}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Action Buttons */}
                  <div className="notif-center-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, marginTop: '2px' }}>
                    {viewMode === 'inbox' && (
                      <button
                        type="button"
                        onClick={() => handleOpenTicket(n)}
                        className={`btn btn-sm notif-view-btn ${ref ? 'btn-primary' : 'btn-secondary'}`}
                        style={{
                          fontSize: '12px',
                          padding: '5px 12px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontWeight: '600',
                          background: ref ? (isUrgent ? '#991b1b' : '#001f9c') : undefined,
                          borderColor: ref ? (isUrgent ? '#7f1d1d' : '#001f9c') : undefined
                        }}
                      >
                        <span>{ref ? 'View Request' : 'Open Details'}</span>
                        <ArrowRight size={13} />
                      </button>
                    )}

                    {viewMode === 'inbox' && n.unread ? (
                      <button
                        type="button"
                        onClick={() => markNotificationRead(n.id)}
                        className="btn btn-secondary btn-sm"
                        title="Mark as read"
                        style={{ padding: '6px 8px', color: '#001f9c' }}
                      >
                        <CheckCheck size={14} />
                      </button>
                    ) : null}

                    {viewMode === 'archived' ? (
                      <button
                        type="button"
                        onClick={() => restoreNotification(n.id)}
                        className="btn btn-secondary btn-sm"
                        title="Restore notification to the inbox"
                        style={{ padding: '6px 8px', color: '#047857', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                      >
                        <RotateCcw size={14} />
                        Restore
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => archiveNotification(n.id)}
                        className="btn btn-secondary btn-sm"
                        title="Archive notification"
                        style={{ padding: '6px 8px', color: '#64748b' }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = '#001f9c'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = '#64748b'; }}
                      >
                        <Archive size={14} />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setDeleteTarget(n)}
                      className="btn btn-secondary btn-sm"
                      title="Delete notification permanently"
                      style={{ padding: '6px 8px', color: '#94a3b8' }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = '#94a3b8'; }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete Single Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteNotification(deleteTarget.id);
          setDeleteTarget(null);
        }}
        title="Delete Notification?"
        message="Are you sure you want to delete this notification record?"
        confirmLabel="Delete"
        variant="danger"
      />

      {/* Clear All Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isClearAllOpen}
        onClose={() => setIsClearAllOpen(false)}
        onConfirm={() => {
          clearAllNotifications();
          setIsClearAllOpen(false);
        }}
        title="Clear All Notifications?"
        message="Are you sure you want to clear all your notification records? This action cannot be undone."
        confirmLabel="Clear All"
        variant="danger"
      />
    </div>
  );
};

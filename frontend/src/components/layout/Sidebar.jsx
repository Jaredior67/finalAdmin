import React, { useState, useEffect } from 'react';
import {
  Menu,
  LogOut
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { adminNavigation } from '../../navigation/adminNavigation';
import { facultyNavigation } from '../../navigation/facultyNavigation';
import { maintenanceNavigation } from '../../navigation/maintenanceNavigation';
import { campusAdminNavigation } from '../../navigation/campusAdminNavigation';
import { ConfirmDialog } from '../common/ConfirmDialog';

const SECTION_LABEL = {
  fontSize: '10px',
  fontWeight: '700',
  color: '#94a3b8',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  paddingLeft: '8px',
};

export const Sidebar = ({ activeTab, onTabChange, collapsed = false, onToggleCollapse }) => {
  const { currentUser, logout, isAdmin, isCampusAdmin, isMaintenance, isFacultyOrStaff } = useAuth();
  const { unreadMessagesCount, pendingApprovals, pendingRegistrationsCount, requisitions } = useData();

  // Collapse control can live in the navbar or the sidebar header — the
  // setter is passed down so the toggle stays on one organized row.
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const setCollapsed = onToggleCollapse || setInternalCollapsed;
  const isCollapsed = onToggleCollapse ? collapsed : internalCollapsed;
  const [isSignOutConfirmOpen, setIsSignOutConfirmOpen] = useState(false);

  // Stay functional when the user zooms the browser in: zooming shrinks the
  // effective CSS viewport, so collapse to icons on narrow widths. Manual
  // toggles are never overridden.
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth < 1100) setCollapsed(true);
    };
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const workspaceName = isCampusAdmin
    ? 'CAMPUS ADMIN'
    : isMaintenance
      ? 'MAINTENANCE'
      : isFacultyOrStaff
        ? 'FACULTY & STAFF'
        : 'PDAS ADMIN';

  // Counts for Dynamic Badges
  const pendingCampusAdminApprovalsCount = (requisitions || []).filter(r => !r.isArchived && (!r.finalAction?.status || r.finalAction?.status === 'Pending')).length;

  const facultyTickets = (requisitions || []).filter(r =>
    (currentUser?.email && r.requesterEmail?.toLowerCase() === currentUser.email.toLowerCase()) ||
    (currentUser?.name && r.requestedBy?.toLowerCase().includes(currentUser.name.toLowerCase()))
  );
  const facultyActiveTicketsCount = facultyTickets.filter(r => r.status !== 'Completed' && r.status !== 'Rejected').length;

  const techTasks = (requisitions || []).filter(r =>
    !currentUser?.name ||
    r.assignedTo?.toLowerCase().includes(currentUser.name.toLowerCase()) ||
    r.assignedTo?.toLowerCase().includes('mark') ||
    r.assignedTo?.toLowerCase().includes('villanueva') ||
    r.status === 'Ongoing' ||
    r.status === 'In Progress' ||
    r.status === 'On Hold' ||
    r.status === 'Pending'
  );
  const techActiveCount = techTasks.filter(r => r.status !== 'Completed').length;
  const techEmergencyCount = techTasks.filter(r => (r.urgency === 'Urgent' || r.urgency === 'High') && r.status !== 'Completed').length;
  const replacementCount = (requisitions || []).filter(r => r.replacementFlag?.isFlagged).length;

  const renderNavList = (items) => (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
      {items.map((item) => {
        const isActive = activeTab === item.id;
        const Icon = item.icon;
        return (
          <li
            key={item.id}
            role="button"
            tabIndex={0}
            title={item.label}
            onClick={() => onTabChange(item.id)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onTabChange(item.id); }}
            onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = '#f1f5f9'; }}
            onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: isCollapsed ? 'center' : 'space-between',
              padding: isCollapsed ? '8px 0' : '7px 10px',
              borderRadius: '7px',
              cursor: 'pointer',
              background: isActive ? '#001f9c' : 'transparent',
              color: isActive ? '#ffffff' : '#475569',
              fontWeight: isActive ? '600' : '500',
              fontSize: '12.5px',
              lineHeight: 1.25,
              transition: 'background 0.14s, color 0.14s',
              border: isActive ? '1px solid #001f9c' : '1px solid transparent',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0 }}>
              <span style={{ display: 'flex', alignItems: 'center', color: isActive ? '#ffffff' : '#64748b', flexShrink: 0 }}>
                <Icon size={16} strokeWidth={isActive ? 2.2 : 2} />
              </span>
              {!isCollapsed && (
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>
              )}
            </span>
            {!isCollapsed && item.badge ? (
              <span style={{
                backgroundColor: isActive ? '#ffffff' : (item.badgeColor || '#d97706'),
                color: isActive ? '#001f9c' : '#ffffff',
                fontSize: '10.5px',
                fontWeight: '700',
                padding: '1px 6px',
                borderRadius: '999px',
                lineHeight: '1.4',
                flexShrink: 0,
              }}>
                {item.badge}
              </span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );

  const renderSection = (label, content, marginTop = false) => (
    <>
      {!isCollapsed && (
        <div style={{ ...SECTION_LABEL, marginTop: marginTop ? '14px' : '0', marginBottom: '6px' }}>
          {label}
        </div>
      )}
      {marginTop && isCollapsed && <div style={{ height: '10px' }} />}
      {content}
    </>
  );

  return (
    <aside className={`app-sidebar ${isCollapsed ? 'is-collapsed' : ''}`}>
      {/* Workspace header: workspace label + hamburger toggle */}
      <div style={{
        flexShrink: 0,
        padding: isCollapsed ? '8px 0' : '8px 10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: isCollapsed ? 'center' : 'space-between',
        borderBottom: '1px solid #f1f5f9',
      }}>
        {!isCollapsed && (
          <span style={{ fontSize: '10px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {workspaceName}
          </span>
        )}
        <button
          type="button"
          onClick={() => setCollapsed(!isCollapsed)}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '6px',
            width: '26px',
            height: '26px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#475569',
            cursor: 'pointer',
          }}
        >
          <Menu size={14} />
        </button>
      </div>

      {/* Scrollable Navigation Body — bottom padding keeps the last item visible above Sign Out */}
      <div style={{
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        overflowX: 'hidden',
        padding: isCollapsed ? '8px 6px 16px 6px' : '10px 8px 16px 8px',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Role-Based Navigation Sections */}
        {isCampusAdmin && (
          <>
            {renderSection('Executive Approvals', renderNavList(campusAdminNavigation.approvals.map(item => ({
              ...item,
              badge: item.badgeKey === 'pendingCampusAdminApprovalsCount' ? (pendingCampusAdminApprovalsCount || null) : null
            }))))}
            {renderSection('Executive Oversight', renderNavList(campusAdminNavigation.management.map(item => ({
              ...item,
              badge: item.badgeKey === 'unreadMessagesCount' ? (unreadMessagesCount || null) : null
            }))), true)}
          </>
        )}

        {isAdmin && !isCampusAdmin && (
          <>
            {renderSection('Overview', renderNavList(adminNavigation.operations.slice(0, 1)))}
            {renderSection('Operations', renderNavList(adminNavigation.operations.slice(1).map(item => ({
              ...item,
              badge: item.badgeKey === 'pendingApprovals' ? (pendingApprovals || null) : null
            }))), true)}
            {renderSection('Management', renderNavList(adminNavigation.management.map(item => ({
              ...item,
              badge: item.badgeKey === 'pendingRegistrationsCount'
                ? (pendingRegistrationsCount || null)
                : item.badgeKey === 'unreadMessagesCount'
                  ? (unreadMessagesCount || null)
                  : item.badgeKey === 'replacementCount'
                    ? (replacementCount || null)
                    : null
            }))), true)}
          </>
        )}

        {isFacultyOrStaff && (
          <>
            {renderSection('Overview', renderNavList(facultyNavigation.requisition.slice(0, 1)))}
            {renderSection('Requests', renderNavList(facultyNavigation.requisition.slice(1).map(item => ({
              ...item,
              badge: item.badgeKey === 'facultyActiveTicketsCount'
                ? (facultyActiveTicketsCount || null)
                : item.badgeKey === 'replacementCount'
                  ? (replacementCount || null)
                  : null
            }))), true)}
            {renderSection('Services', renderNavList(facultyNavigation.campus.map(item => ({
              ...item,
              badge: item.badgeKey === 'unreadMessagesCount' ? (unreadMessagesCount || null) : null
            }))), true)}
          </>
        )}

        {isMaintenance && (
          <>
            {renderSection('Work Queue', renderNavList(maintenanceNavigation.operations.map(item => ({
              ...item,
              badge: item.badgeKey === 'techActiveCount'
                ? (techActiveCount || null)
                : item.badgeKey === 'techEmergencyCount'
                  ? (techEmergencyCount || null)
                  : item.badgeKey === 'replacementCount'
                    ? (replacementCount || null)
                    : null
            }))))}
            {renderSection('Support', renderNavList(maintenanceNavigation.facility.map(item => ({
              ...item,
              badge: item.badgeKey === 'unreadMessagesCount' ? (unreadMessagesCount || null) : null
            }))), true)}
          </>
        )}
      </div>

      {/* Sidebar Bottom Action Bar — always pinned at bottom */}
      <div style={{ flexShrink: 0, padding: '10px 8px', borderTop: '1px solid #f1f5f9', background: '#ffffff' }}>
        <button
          type="button"
          onClick={() => setIsSignOutConfirmOpen(true)}
          title="Sign Out"
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: isCollapsed ? 'center' : 'flex-start',
            gap: '9px',
            padding: isCollapsed ? '8px 0' : '7px 10px',
            borderRadius: '7px',
            border: '1px solid #fecaca',
            background: '#fef2f2',
            color: '#dc2626',
            fontSize: '12.5px',
            fontWeight: '600',
            cursor: 'pointer',
          }}
        >
          <LogOut size={15} />
          {!isCollapsed && <span>Sign Out</span>}
        </button>
      </div>

      {/* Sign Out Confirmation Modal */}
      <ConfirmDialog
        isOpen={isSignOutConfirmOpen}
        onClose={() => setIsSignOutConfirmOpen(false)}
        onConfirm={() => {
          setIsSignOutConfirmOpen(false);
          logout();
        }}
        title="Sign Out of FixIT?"
        message="Are you sure you want to end your current session? You will need to sign back in to access facility management features."
        confirmText="Sign Out"
        isDanger={true}
      />
    </aside>
  );
};

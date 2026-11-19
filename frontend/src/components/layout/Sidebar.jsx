import React, { useState, useEffect } from 'react';
import {
  Menu,
  LogOut,
  X,
  History
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { superAdminNavigation } from '../../navigation/superAdminNavigation';
import { adminNavigation } from '../../navigation/adminNavigation';
import { facultyNavigation } from '../../navigation/facultyNavigation';
import { maintenanceNavigation } from '../../navigation/maintenanceNavigation';
import { campusAdminNavigation } from '../../navigation/campusAdminNavigation';
import { supervisorNavigation } from '../../navigation/supervisorNavigation';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { buildMyQueue } from '../maintenance/queueConfig';
import { filterMyRequests } from '../../utils/myRequests';


const SECTION_LABEL = {
  fontSize: '10px',
  fontWeight: '700',
  color: '#798dbd',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  paddingLeft: '12px',
};

export const Sidebar = ({ activeTab, onTabChange, collapsed = false, onToggleCollapse, mobileOpen = false, onCloseMobile = null }) => {
  const { currentUser, logout, isSuperAdmin, isAdmin, isCampusAdmin, isSupervisor, isMaintenance, isFacultyOrStaff } = useAuth();
  const { unreadMessagesCount, pendingApprovals, pendingRegistrationsCount, requisitions, notifications } = useData();

  // Collapse control can live in the navbar or the sidebar header
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const setCollapsed = onToggleCollapse || setInternalCollapsed;
  const isCollapsed = onToggleCollapse ? collapsed : internalCollapsed;
  const effectiveCollapsed = isCollapsed && !mobileOpen;
  const [isSignOutConfirmOpen, setIsSignOutConfirmOpen] = useState(false);

  // Auto-collapse only on desktop/tablet widths (between 768px and 1100px)
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 768 && window.innerWidth < 1100) {
        setCollapsed(true);
      }
    };
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [setCollapsed]);

  const workspaceName = isSuperAdmin
    ? 'System Administration'
    : isCampusAdmin
      ? 'Campus Administration'
      : isMaintenance
        ? 'Facility Maintenance'
        : isFacultyOrStaff
          ? (isSupervisor ? 'Immediate Supervisor' : 'Faculty & Staff Portal')
          : 'PDAS Facility Management';

  // Counts for Dynamic Badges
  const pendingCampusAdminApprovalsCount = (requisitions || []).filter(r =>
    !r.isArchived &&
    (!r.finalAction?.status || r.finalAction?.status === 'Pending') &&
    (r.status === 'Pending Final Approval' || r.status === 'Awaiting Signatures' || (!['Draft', 'Pending Supervisor Approval', 'Pending', 'Under Review', 'Completed', 'Rejected'].includes(r.status)))
  ).length;
  const pendingSupervisorApprovalsCount = (requisitions || []).filter(r =>
    !r.isArchived && (r.status === 'Pending Supervisor Approval' || (!r.supervisorApproved && r.status === 'Pending' && r.immediateSupervisor))
  ).length;

  /* Same predicate as the Dashboard tiles and the ticket lists, so this badge
     never reports a number those pages would not show. */
  const facultyActiveTicketsCount = filterMyRequests(requisitions, currentUser)
    .filter(r => r.status !== 'Completed' && r.status !== 'Rejected').length;

  // The maintenance queue badge must agree with the Work Queue page, so both
  // derive the ticket set from the same shared helper.
  const techQueue = buildMyQueue(requisitions, currentUser);
  const techActiveCount = techQueue.filter(r => r.status !== 'Completed').length;
  const replacementCount = techQueue.filter(r => r.replacementFlag?.isFlagged || r.maintenanceFlag?.type === 'Disposal').length;

  const unreadNotificationsCount = (Array.isArray(notifications) ? notifications : [])
    .filter(n => n && typeof n === 'object' && n.unread).length;

  // badgeKey -> count, so nav items stay declarative instead of nested ternaries
  const maintenanceBadges = {
    techActiveCount: techActiveCount || null,
    replacementCount: replacementCount || null,
    unreadMessagesCount: unreadMessagesCount || null,
    unreadNotificationsCount: unreadNotificationsCount || null,
    unreadNotifications: unreadNotificationsCount || null
  };
  const badgeFor = (item) => (item.badgeKey ? maintenanceBadges[item.badgeKey] ?? null : null);

  const renderNavList = (items) => (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '3px' }}>
      {items.map((item) => {
        const isActive = activeTab === item.id;
        const Icon = item.icon;
        return (
          <li
            key={item.id}
            role="button"
            tabIndex={0}
            title={item.label}
            className={`sidebar-nav-item ${isActive ? 'is-active' : ''}`}
            onClick={() => {
              onTabChange(item.id);
              if (onCloseMobile) onCloseMobile();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                onTabChange(item.id);
                if (onCloseMobile) onCloseMobile();
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: effectiveCollapsed ? 'center' : 'space-between',
              padding: effectiveCollapsed ? '9px 0' : '8px 12px',
              borderRadius: '8px',
              cursor: 'pointer',
              background: isActive ? 'rgba(255, 255, 255, 0.14)' : 'transparent',
              color: isActive ? '#ffffff' : '#c5d2eb',
              fontWeight: isActive ? '600' : '500',
              fontSize: '13px',
              lineHeight: 1.25,
              position: 'relative',
              boxShadow: isActive ? 'inset 0 1px 0 rgba(255, 255, 255, 0.1)' : 'none',
              border: 'none',
              transition: 'background 0.15s ease, color 0.15s ease'
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                e.currentTarget.style.color = '#ffffff';
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = '#c5d2eb';
              }
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
              <span className="nav-icon" style={{ display: 'flex', alignItems: 'center', color: isActive ? '#ffffff' : '#8da2c9', flexShrink: 0 }}>
                <Icon size={16} strokeWidth={isActive ? 2.2 : 2} />
              </span>
              {!effectiveCollapsed && (
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>
              )}
            </span>
            {!effectiveCollapsed && item.badge ? (
              <span style={{
                backgroundColor: '#f59e0b',
                color: '#071746',
                fontSize: '11px',
                fontWeight: '800',
                padding: '1px 7px',
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
      {!effectiveCollapsed && (
        <div style={{ ...SECTION_LABEL, marginTop: marginTop ? '14px' : '0', marginBottom: '6px' }}>
          {label}
        </div>
      )}
      {marginTop && effectiveCollapsed && <div style={{ height: '10px' }} />}
      {content}
    </>
  );

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {mobileOpen && (
        <div
          className="sidebar-backdrop is-visible"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}
      <aside className={`app-sidebar ${effectiveCollapsed ? 'is-collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
        {/* Sidebar top header bar with collapse toggle */}
        <div style={{
          flexShrink: 0,
          padding: effectiveCollapsed ? '8px 6px' : '8px 12px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: effectiveCollapsed ? 'center' : 'flex-end',
          minHeight: '40px',
        }}>
          {/* Collapse/expand toggle */}
          <button
            type="button"
            onClick={() => setCollapsed(!isCollapsed)}
            aria-label={effectiveCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={effectiveCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              borderRadius: '6px',
              width: '26px',
              height: '26px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#c5d2eb',
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'; }}
          >
            <Menu size={14} />
          </button>

          {/* Mobile close button */}
          {mobileOpen && (
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="Close navigation menu"
              title="Close menu"
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                borderRadius: '8px',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                cursor: 'pointer',
                marginLeft: '8px'
              }}
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Scrollable Navigation Body */}
        <div style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: effectiveCollapsed ? '8px 6px 16px 6px' : '10px 8px 16px 8px',
          display: 'flex',
          flexDirection: 'column',
        }}>
        {/* Role-Based Navigation Sections */}
        {isSuperAdmin && (
          <>
            {renderSection('Overview', renderNavList(superAdminNavigation.overview))}
            {renderSection('Administration', renderNavList(superAdminNavigation.administration.map(item => ({
              ...item,
              badge: item.badgeKey === 'pendingRegistrationsCount' ? (pendingRegistrationsCount || null) : null
            }))), true)}
            {renderSection('Management', renderNavList(superAdminNavigation.system.map(item => ({
              ...item,
              badge: item.badgeKey === 'unreadMessagesCount'
                ? (unreadMessagesCount || null)
                : item.badgeKey === 'unreadNotificationsCount'
                  ? (unreadNotificationsCount || null)
                  : null
            }))), true)}
          </>
        )}

        {isCampusAdmin && (
          <>
            {renderSection('Overview', renderNavList(campusAdminNavigation.approvals.map(item => ({
              ...item,
              badge: item.badgeKey === 'pendingCampusAdminApprovalsCount' ? (pendingCampusAdminApprovalsCount || null) : null
            }))))}
            {renderSection('Management', renderNavList(campusAdminNavigation.management.map(item => ({
              ...item,
              badge: item.badgeKey === 'unreadMessagesCount'
                ? (unreadMessagesCount || null)
                : item.badgeKey === 'unreadNotificationsCount'
                  ? (unreadNotificationsCount || null)
                  : null
            }))), true)}
          </>
        )}

        {isAdmin && !isCampusAdmin && !isSuperAdmin && (
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
                  : item.badgeKey === 'unreadNotificationsCount'
                    ? (unreadNotificationsCount || null)
                    : item.badgeKey === 'replacementCount'
                      ? (replacementCount || null)
                      : null
            }))), true)}
          </>
        )}

        {isFacultyOrStaff && (
          <>
            {/* Supervisor queue — shown above own requests when designated */}
            {isSupervisor && (
              <>
                {renderSection('Immediate Supervisor Queue', renderNavList([
                  {
                    id: 'supervisor-queue',
                    label: 'My Supervisees\u2019 Requests',
                    icon: supervisorNavigation[0].icon,
                    badge: pendingSupervisorApprovalsCount || null,
                    badgeColor: '#d97706'
                  }
                ]))}
              </>
            )}
            {isSupervisor
              ? renderNavList(facultyNavigation.requisition.slice(0, 1))
              : renderSection('Overview', renderNavList(facultyNavigation.requisition.slice(0, 1)))}
            {renderSection('Operations', renderNavList(facultyNavigation.requisition.slice(1).map(item => ({
              ...item,
              badge: item.id === 'faculty-history' || item.badgeKey === 'facultyActiveTicketsCount'
                ? (facultyActiveTicketsCount || null)
                : item.badgeKey === 'replacementCount'
                  ? (replacementCount || null)
                  : null
            }))), true)}
            {renderSection('Management', renderNavList(facultyNavigation.campus.map(item => ({
              ...item,
              badge: item.badgeKey === 'unreadMessagesCount'
                ? (unreadMessagesCount || null)
                : item.badgeKey === 'unreadNotificationsCount'
                  ? (unreadNotificationsCount || null)
                  : null
            }))), true)}
          </>
        )}

        {isMaintenance && (
          <>
            {maintenanceNavigation.overview && (
              renderSection('Overview', renderNavList(maintenanceNavigation.overview.map(item => ({
                ...item,
                badge: badgeFor(item)
              }))))
            )}
            {renderSection('Operations', renderNavList(maintenanceNavigation.operations.map(item => ({
              ...item,
              badge: badgeFor(item)
            }))), !!maintenanceNavigation.overview)}
            {renderSection('Management', renderNavList(maintenanceNavigation.facility.map(item => ({
              ...item,
              badge: badgeFor(item)
            }))), true)}
          </>
        )}
      </div>

        {/* Sidebar Bottom Action Bar — pinned at bottom matching prototype */}
        <div style={{ flexShrink: 0, padding: '10px 8px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', background: 'transparent' }}>
          <button
            type="button"
            onClick={() => setIsSignOutConfirmOpen(true)}
            title="Sign Out"
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: effectiveCollapsed ? 'center' : 'flex-start',
              gap: '9px',
              padding: effectiveCollapsed ? '8px 0' : '8px 12px',
              borderRadius: '8px',
              border: 'none',
              background: 'transparent',
              color: '#c5d2eb',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#ef4444';
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.12)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#c5d2eb';
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <LogOut size={16} />
            {!effectiveCollapsed && <span>Sign out</span>}
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
    </>
  );
};

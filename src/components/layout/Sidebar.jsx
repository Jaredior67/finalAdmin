import React from 'react';
import { 
  LayoutGrid, 
  Mail, 
  Clock, 
  Folder, 
  Calendar, 
  Archive, 
  Users, 
  MessageSquare, 
  BarChart3, 
  ShieldCheck, 
  CheckCircle2,
  PlusCircle,
  FileText,
  Wrench,
  AlertTriangle,
  History,
  FilePlus,
  Send,
  Zap
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';

export const Sidebar = ({ activeTab, onTabChange }) => {
  const { currentUser, isAdmin, isMaintenance, isFacultyOrStaff, isFaculty, isStaff } = useAuth();
  const { unreadMessagesCount, pendingApprovals, pendingRegistrationsCount, requisitions } = useData();

  // 1. Admin Navigation Configuration
  const adminOperationsNav = [
    {
      id: 'executive-dashboard',
      label: 'Executive Dashboard',
      icon: <LayoutGrid size={18} />,
    },
    {
      id: 'job-requests',
      label: 'Job Requests',
      icon: <Mail size={18} />,
      badge: pendingApprovals > 0 ? pendingApprovals : null,
      badgeColor: '#f59e0b'
    },
    {
      id: 'approval-history',
      label: 'Approval History',
      icon: <Clock size={18} />,
    },
    {
      id: 'preventive-calendar',
      label: 'Preventive Calendar',
      icon: <Calendar size={18} />,
    }
  ];

  const adminManagementNav = [
    {
      id: 'official-documents',
      label: 'Official Documents',
      icon: <Folder size={18} />,
    },
    {
      id: 'user-management',
      label: 'User Management',
      icon: <Users size={18} />,
      badge: pendingRegistrationsCount > 0 ? pendingRegistrationsCount : null,
      badgeColor: '#3b82f6'
    },
    {
      id: 'communication-box',
      label: 'Communication Box',
      icon: <MessageSquare size={18} />,
      badge: unreadMessagesCount > 0 ? unreadMessagesCount : 1,
      badgeColor: '#f59e0b'
    },
    {
      id: 'analytics-reports',
      label: 'Analytics & Reports',
      icon: <BarChart3 size={18} />,
    },
    {
      id: 'archived-requests',
      label: 'Archived Requests',
      icon: <Archive size={18} />,
    },
  ];

  // 2. Faculty & Staff Requisitioner Navigation Configuration
  const facultyTickets = requisitions.filter(r => 
    (currentUser?.email && r.requesterEmail?.toLowerCase() === currentUser.email.toLowerCase()) ||
    (currentUser?.name && r.requestedBy?.toLowerCase().includes(currentUser.name.toLowerCase()))
  );
  const facultyActiveTicketsCount = facultyTickets.filter(r => r.status !== 'Completed' && r.status !== 'Rejected').length;

  const facultyRequisitionNav = [
    {
      id: 'faculty-submit',
      label: 'Submit Job Request',
      icon: <PlusCircle size={18} />,
    },
    {
      id: 'faculty-tickets',
      label: 'My Active Tickets',
      icon: <FileText size={18} />,
      badge: facultyActiveTicketsCount > 0 ? facultyActiveTicketsCount : null,
      badgeColor: '#001f9c'
    },
    {
      id: 'faculty-history',
      label: 'Requisition History',
      icon: <History size={18} />,
    }
  ];

  const facultyCampusNav = [
    {
      id: 'faculty-messages',
      label: 'PDAS Communication',
      icon: <MessageSquare size={18} />,
      badge: unreadMessagesCount > 0 ? unreadMessagesCount : null,
      badgeColor: '#f59e0b'
    },
    {
      id: 'faculty-calendar',
      label: 'Campus Maintenance',
      icon: <Calendar size={18} />,
    },
    {
      id: 'faculty-documents',
      label: 'Official Job Orders',
      icon: <Folder size={18} />,
    }
  ];

  // 3. Maintenance Personnel Navigation Configuration
  const techTasks = requisitions.filter(r => 
    !currentUser?.name || 
    r.assignedTo?.toLowerCase().includes(currentUser.name.toLowerCase()) || 
    r.assignedTo?.toLowerCase().includes('mark') ||
    r.assignedTo?.toLowerCase().includes('villanueva') ||
    r.status === 'In Progress' ||
    r.status === 'Pending'
  );
  const techActiveCount = techTasks.filter(r => r.status !== 'Completed').length;
  const techEmergencyCount = techTasks.filter(r => (r.urgency === 'Emergency' || r.urgency === 'High') && r.status !== 'Completed').length;

  const techOperationsNav = [
    {
      id: 'tech-tasks',
      label: 'Assigned Work Orders',
      icon: <Wrench size={18} />,
      badge: techActiveCount > 0 ? techActiveCount : null,
      badgeColor: '#d97706'
    },
    {
      id: 'tech-emergency',
      label: 'Emergency Queue',
      icon: <AlertTriangle size={18} />,
      badge: techEmergencyCount > 0 ? techEmergencyCount : null,
      badgeColor: '#dc2626'
    },
    {
      id: 'tech-history',
      label: 'Completed Work Logs',
      icon: <CheckCircle2 size={18} />,
    }
  ];

  const techFacilityNav = [
    {
      id: 'tech-calendar',
      label: 'Preventive Calendar',
      icon: <Calendar size={18} />,
    },
    {
      id: 'tech-messages',
      label: 'Dispatch Desk',
      icon: <MessageSquare size={18} />,
      badge: unreadMessagesCount > 0 ? unreadMessagesCount : null,
      badgeColor: '#f59e0b'
    },
    {
      id: 'tech-documents',
      label: 'Equipment & Safety Docs',
      icon: <Folder size={18} />,
    }
  ];

  const renderNavList = (items) => (
    <ul className="sidebar-nav-list">
      {items.map((item) => {
        const isActive = activeTab === item.id;
        return (
          <li
            key={item.id}
            className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
            onClick={() => onTabChange(item.id)}
            role="button"
            tabIndex={0}
          >
            <div className="nav-item-content">
              <span className="nav-item-icon">{item.icon}</span>
              <span>{item.label}</span>
            </div>
            {item.badge && (
              <span 
                className="nav-badge-count" 
                style={{ 
                  backgroundColor: isActive ? '#ffffff' : (item.badgeColor || '#f59e0b'),
                  color: isActive ? '#001f9c' : '#ffffff'
                }}
              >
                {item.badge}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );

  return (
    <aside className="app-sidebar">
      <div>
        {/* Role-Based Navigation Sections */}
        {isAdmin && (
          <>
            <div className="sidebar-category-header">
              OPERATIONS & REQUISITIONS
            </div>
            {renderNavList(adminOperationsNav)}

            <div className="sidebar-category-header" style={{ marginTop: '16px' }}>
              MANAGEMENT & RECORDS
            </div>
            {renderNavList(adminManagementNav)}
          </>
        )}

        {isFacultyOrStaff && (
          <>
            <div className="sidebar-category-header">
              REQUISITION DESK
            </div>
            {renderNavList(facultyRequisitionNav)}

            <div className="sidebar-category-header" style={{ marginTop: '16px' }}>
              CAMPUS & COMMUNICATION
            </div>
            {renderNavList(facultyCampusNav)}
          </>
        )}

        {isMaintenance && (
          <>
            <div className="sidebar-category-header">
              FIELD OPERATIONS
            </div>
            {renderNavList(techOperationsNav)}

            <div className="sidebar-category-header" style={{ marginTop: '16px' }}>
              FACILITY & DISPATCH
            </div>
            {renderNavList(techFacilityNav)}
          </>
        )}
      </div>

      {/* Bottom User Pill */}
      <div className="sidebar-footer-card">
        <div 
          className="sidebar-user-avatar"
          style={{ backgroundColor: currentUser?.avatarColor || '#001f9c' }}
        >
          {currentUser?.initial || (currentUser?.name ? currentUser.name.charAt(0) : 'U')}
        </div>
        <div className="sidebar-user-details">
          <span className="sidebar-user-name">
            {currentUser?.name || 'Authorized User'}
          </span>
          <span className="sidebar-user-dept" title={currentUser?.department || currentUser?.roleTitle || 'ISAT U Dumangas'}>
            {currentUser?.roleTitle || currentUser?.department || 'ISAT U Dumangas'}
          </span>
        </div>
      </div>
    </aside>
  );
};


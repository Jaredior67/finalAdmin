import React, { useMemo } from 'react';
import {
  Users,
  QrCode,
  Shield,
  Clock,
  UserCheck,
  CheckCircle2,
  ArrowRight,
  GraduationCap,
  Briefcase,
  Wrench,
  Building,
  Landmark,
  UserPlus
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { PageHeader } from '../../components/common/PageHeader';
import { PageTransition } from '../../components/common/PageTransition';
import { formatHeaderDate } from '../../components/common/TimeGreeting';

export const SuperAdminDashboard = ({ onNavigate }) => {
  const { currentUser } = useAuth();
  const {
    users = [],
    pendingRegistrations = [],
    pendingRegistrationsCount = 0,
    campusLocations = [],
    isLoadingUsers
  } = useData();

  // Active users count
  const activeUsersCount = useMemo(() => {
    return users.filter(u => String(u.status || '').toLowerCase() !== 'inactive').length;
  }, [users]);

  // Maintenance & Tech count
  const techCount = useMemo(() => {
    return users.filter(u => {
      const r = String(u.role || u.userType || '').toLowerCase();
      return r === 'maintenance' || r === 'technician';
    }).length;
  }, [users]);

  // Role Distribution
  const roleStats = useMemo(() => {
    const counts = {
      superadmin: 0,
      admin: 0,
      campus_admin: 0,
      faculty: 0,
      staff: 0,
      maintenance: 0
    };
    users.forEach(u => {
      const r = String(u.role || u.userType || '').toLowerCase();
      if (r === 'superadmin' || r === 'super_admin') counts.superadmin++;
      else if (r === 'admin') counts.admin++;
      else if (r === 'campus_admin' || r === 'campus_administrator' || r === 'approver') counts.campus_admin++;
      else if (r === 'faculty') counts.faculty++;
      else if (r === 'staff') counts.staff++;
      else if (r === 'maintenance' || r === 'technician') counts.maintenance++;
      else counts.faculty++;
    });
    return counts;
  }, [users]);

  // Unique Buildings
  const uniqueBuildingsCount = useMemo(() => {
    const set = new Set();
    campusLocations.forEach(loc => {
      if (loc.building) set.add(loc.building.trim().toLowerCase());
    });
    return set.size;
  }, [campusLocations]);

  // QR tagged locations count
  const qrTaggedCount = useMemo(() => {
    return campusLocations.filter(loc => Boolean(loc.qr_code || loc.qrCode)).length;
  }, [campusLocations]);

  const recentPending = useMemo(() => {
    return (pendingRegistrations || []).slice(0, 5);
  }, [pendingRegistrations]);

  return (
    <PageTransition>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingTop: '16px', fontFamily: "'Inter', Verdana, Geneva, Tahoma, sans-serif" }}>
        
        {/* Page Header */}
        <PageHeader
          breadcrumbs={['System Administration', 'Overview']}
          title={`Welcome, ${currentUser?.name || 'Super Administrator'}!`}
          description={`System Governance, User Management & Campus Infrastructure Registry · ${formatHeaderDate(new Date())}`}
        />

        {/* Welcome Banner */}
        <div style={{
          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)',
          borderRadius: '16px',
          padding: '24px 28px',
          color: '#ffffff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          boxShadow: '0 10px 25px -5px rgba(49, 46, 129, 0.3)'
        }}>
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: '800', margin: '0 0 6px 0', letterSpacing: '-0.02em' }}>
              Welcome back, {currentUser?.name || 'Super Administrator'}
            </h2>
            <p style={{ margin: 0, fontSize: '13.5px', opacity: 0.9, maxWidth: '640px', lineHeight: 1.5 }}>
              You maintain overarching control over all institutional user accounts, identity registration reviews, and campus infrastructure location tags.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => onNavigate && onNavigate('user-management')}
              style={{
                background: '#ffffff',
                color: '#312e81',
                border: 'none',
                borderRadius: '10px',
                padding: '10px 18px',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                transition: 'transform 0.15s ease'
              }}
            >
              <Users size={16} />
              <span>Manage Users</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate && onNavigate('print-labels')}
              style={{
                background: 'rgba(255, 255, 255, 0.15)',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '10px',
                padding: '10px 18px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <QrCode size={16} />
              <span>QR Registry</span>
            </button>
          </div>
        </div>

        {/* KPI Cards Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px'
        }}>
          {/* Card 1: Total Users */}
          <div
            onClick={() => onNavigate && onNavigate('user-management')}
            style={{
              background: '#ffffff',
              borderRadius: '14px',
              padding: '20px',
              border: '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              cursor: 'pointer',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#64748b' }}>Active Accounts</span>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Users size={20} />
              </div>
            </div>
            <div>
              <div style={{ fontSize: '28px', fontWeight: '800', color: '#0f172a', lineHeight: 1.1 }}>
                {activeUsersCount}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                {users.length} total registered accounts
              </div>
            </div>
            <div style={{ fontSize: '12px', color: '#2563eb', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>View user directory</span>
              <ArrowRight size={14} />
            </div>
          </div>

          {/* Card 2: Pending Registrations */}
          <div
            onClick={() => onNavigate && onNavigate('user-management')}
            style={{
              background: '#ffffff',
              borderRadius: '14px',
              padding: '20px',
              border: pendingRegistrationsCount > 0 ? '1.5px solid #fde68a' : '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              cursor: 'pointer',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
              boxShadow: pendingRegistrationsCount > 0 ? '0 4px 14px rgba(245, 158, 11, 0.12)' : '0 1px 3px rgba(0,0,0,0.05)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#64748b' }}>Pending Approvals</span>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#fffbeb', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Clock size={20} />
              </div>
            </div>
            <div>
              <div style={{ fontSize: '28px', fontWeight: '800', color: pendingRegistrationsCount > 0 ? '#b45309' : '#0f172a', lineHeight: 1.1 }}>
                {pendingRegistrationsCount}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                Self-registered applicants awaiting review
              </div>
            </div>
            <div style={{ fontSize: '12px', color: '#d97706', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>Review applications</span>
              <ArrowRight size={14} />
            </div>
          </div>

          {/* Card 3: Campus Locations */}
          <div
            onClick={() => onNavigate && onNavigate('print-labels')}
            style={{
              background: '#ffffff',
              borderRadius: '14px',
              padding: '20px',
              border: '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              cursor: 'pointer',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#64748b' }}>Campus Infrastructure</span>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#f5f3ff', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Building size={20} />
              </div>
            </div>
            <div>
              <div style={{ fontSize: '28px', fontWeight: '800', color: '#0f172a', lineHeight: 1.1 }}>
                {campusLocations.length}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                Rooms & spaces across {uniqueBuildingsCount} building(s)
              </div>
            </div>
            <div style={{ fontSize: '12px', color: '#7c3aed', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>Manage QR & locations</span>
              <ArrowRight size={14} />
            </div>
          </div>

          {/* Card 4: Maintenance Force */}
          <div
            onClick={() => onNavigate && onNavigate('user-management')}
            style={{
              background: '#ffffff',
              borderRadius: '14px',
              padding: '20px',
              border: '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              cursor: 'pointer',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#64748b' }}>Maintenance Force</span>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Wrench size={20} />
              </div>
            </div>
            <div>
              <div style={{ fontSize: '28px', fontWeight: '800', color: '#0f172a', lineHeight: 1.1 }}>
                {techCount}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                Active technicians & facility specialists
              </div>
            </div>
            <div style={{ fontSize: '12px', color: '#059669', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>View personnel</span>
              <ArrowRight size={14} />
            </div>
          </div>
        </div>

        {/* Main Content Grid: Pending Requests & User Breakdown */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: '20px'
        }}>
          {/* Left Column: Recent Pending Registrations */}
          <div style={{
            background: '#ffffff',
            borderRadius: '14px',
            border: '1px solid #e2e8f0',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>
                  Pending Registrations
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                  New users awaiting institutional identity clearance
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate && onNavigate('user-management')}
                style={{
                  background: 'transparent',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#475569',
                  cursor: 'pointer'
                }}
              >
                View All ({pendingRegistrationsCount})
              </button>
            </div>

            {recentPending.length === 0 ? (
              <div style={{
                padding: '36px 16px',
                textAlign: 'center',
                color: '#64748b',
                background: 'var(--bg-sunken)',
                borderRadius: '10px',
                border: '1px dashed #cbd5e1'
              }}>
                <CheckCircle2 size={32} color="#059669" style={{ margin: '0 auto 8px auto', display: 'block' }} />
                <div style={{ fontWeight: '600', fontSize: '13.5px', color: '#0f172a' }}>All caught up!</div>
                <div style={{ fontSize: '12px', marginTop: '2px' }}>There are no pending account registrations requiring verification.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {recentPending.map(reg => (
                  <div
                    key={reg.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px',
                      borderRadius: '10px',
                      background: 'var(--bg-sunken)',
                      border: '1px solid #e2e8f0'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '13px', color: '#0f172a' }}>
                        {[reg.first_name, reg.last_name].filter(Boolean).join(' ')}
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                        {reg.email} • <span style={{ textTransform: 'capitalize', fontWeight: '600', color: '#475569' }}>{reg.role}</span>
                      </div>
                      {reg.department && (
                        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                          Dept: {reg.department}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => onNavigate && onNavigate('user-management')}
                      style={{
                        background: '#3b82f6',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '6px 12px',
                        fontSize: '11.5px',
                        fontWeight: '700',
                        cursor: 'pointer'
                      }}
                    >
                      Review
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Institutional Identity Breakdown & Campus Summary */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Role Breakdown Card */}
            <div style={{
              background: '#ffffff',
              borderRadius: '14px',
              border: '1px solid #e2e8f0',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>
                  Institutional Roles Distribution
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                  Active personnel across institutional classifications
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                <div style={{ padding: '10px 12px', borderRadius: '8px', background: '#fae8ff', border: '1px solid #f5d0fe' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#86198f', textTransform: 'uppercase' }}>Super Admin</div>
                  <div style={{ fontSize: '20px', fontWeight: '800', color: '#701a75' }}>{roleStats.superadmin}</div>
                </div>
                <div style={{ padding: '10px 12px', borderRadius: '8px', background: '#fee2e2', border: '1px solid #fecaca' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#991b1b', textTransform: 'uppercase' }}>PDAS Admin</div>
                  <div style={{ fontSize: '20px', fontWeight: '800', color: '#7f1d1d' }}>{roleStats.admin}</div>
                </div>
                <div style={{ padding: '10px 12px', borderRadius: '8px', background: '#fef3c7', border: '1px solid #fde68a' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#92400e', textTransform: 'uppercase' }}>Campus Approver</div>
                  <div style={{ fontSize: '20px', fontWeight: '800', color: '#78350f' }}>{roleStats.campus_admin}</div>
                </div>
                <div style={{ padding: '10px 12px', borderRadius: '8px', background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#1d4ed8', textTransform: 'uppercase' }}>Faculty</div>
                  <div style={{ fontSize: '20px', fontWeight: '800', color: '#1e40af' }}>{roleStats.faculty}</div>
                </div>
                <div style={{ padding: '10px 12px', borderRadius: '8px', background: '#f5f3ff', border: '1px solid #ddd6fe' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#6d28d9', textTransform: 'uppercase' }}>Staff</div>
                  <div style={{ fontSize: '20px', fontWeight: '800', color: '#5b21b6' }}>{roleStats.staff}</div>
                </div>
                <div style={{ padding: '10px 12px', borderRadius: '8px', background: '#ecfdf5', border: '1px solid #a7f3d0' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#047857', textTransform: 'uppercase' }}>Maintenance</div>
                  <div style={{ fontSize: '20px', fontWeight: '800', color: '#065f46' }}>{roleStats.maintenance}</div>
                </div>
              </div>
            </div>

            {/* Infrastructure Quick Stats */}
            <div style={{
              background: '#ffffff',
              borderRadius: '14px',
              border: '1px solid #e2e8f0',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>
                    QR Registry Summary
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                    Physical asset location tags and labels
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate && onNavigate('print-labels')}
                  style={{
                    background: '#001f9c',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '11.5px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  Open Registry
                </button>
              </div>

              <div style={{ display: 'flex', gap: '16px', marginTop: '4px' }}>
                <div style={{ flex: 1, padding: '12px', borderRadius: '8px', background: 'var(--bg-sunken)', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: '600' }}>QR Code Registered</div>
                  <div style={{ fontSize: '22px', fontWeight: '800', color: '#0f172a', marginTop: '2px' }}>
                    {qrTaggedCount}
                  </div>
                  <div style={{ fontSize: '11px', color: '#059669', marginTop: '2px' }}>
                    Active tracking tags
                  </div>
                </div>
                <div style={{ flex: 1, padding: '12px', borderRadius: '8px', background: 'var(--bg-sunken)', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: '600' }}>Total Buildings</div>
                  <div style={{ fontSize: '22px', fontWeight: '800', color: '#0f172a', marginTop: '2px' }}>
                    {uniqueBuildingsCount}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                    Campuses & facilities
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </PageTransition>
  );
};

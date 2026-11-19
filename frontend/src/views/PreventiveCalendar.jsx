import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  MapPin,
  User,
  Trash2,
  AlertTriangle,
  Check,
  Repeat,
  Bell,
  FileText,
  Camera,
  Eye,
  X
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/common/Modal';
import { PageHeader } from '../components/common/PageHeader';
import { CategoryPill } from '../components/common/StatusBadge';
import { useOptionalToast } from '../components/ui/Toast';
import { apiGetPreventiveSchedules } from '../backend/api';

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

const CATEGORY_TONES = {
  Electrical: { background: '#dbeafe', border: '#93c5fd', text: '#1e40af' },
  'Safety & Compliance': { background: '#fef3c7', border: '#fcd34d', text: '#92400e' },
  'Air Conditioning': { background: '#e0e7ff', border: '#a5b4fc', text: '#3730a3' },
  Mechanical: { background: '#dcfce7', border: '#86efac', text: '#166534' },
  'Water/Sanitary': { background: '#cffafe', border: '#67e8f9', text: '#155e75' },
  'Physical Structures': { background: '#ffedd5', border: '#fdba74', text: '#9a3412' },
  'Drawing/Design': { background: '#f3e8ff', border: '#d8b4fe', text: '#6b21a8' }
};

const STATUS_TONES = {
  Scheduled: { background: '#dbeafe', color: '#1e40af', border: '#93c5fd' },
  'In Progress': { background: '#fef3c7', color: '#92400e', border: '#fcd34d' },
  Completed: { background: '#dcfce7', color: '#166534', border: '#86efac' },
  Cancelled: { background: '#e2e8f0', color: '#64748b', border: '#cbd5e1' },
  Overdue: { background: '#fee2e2', color: '#b91c1c', border: '#fca5a5' }
};

const toneFor = (category) =>
  CATEGORY_TONES[category] || { background: '#e2e8f0', border: '#cbd5e1', text: '#334155' };

const toISODate = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const CATEGORY_OPTIONS = [
  'Electrical',
  'Air Conditioning',
  'Mechanical',
  'Water/Sanitary',
  'Physical Structures',
  'Drawing/Design',
  'Safety & Compliance'
];

const RECURRENCE_OPTIONS = [
  'Quarterly',
  'Monthly',
  'Semi-Annual',
  'Annual',
  'Weekly',
  'One-time'
];

const REMINDER_OPTIONS = [
  '1 day before',
  '2 days before',
  '3 days before',
  'Same day'
];

const scheduleKey = (row) =>
  [
    row.date,
    String(row.title || '').trim().toLowerCase(),
    String(row.time || '').trim(),
    String(row.location || '').trim().toLowerCase()
  ].join('|');

export const PreventiveCalendar = ({ isReadOnly = false }) => {
  const { calendarEvents, addCalendarEvent, updateCalendarEvent, completeCalendarEvent, removeCalendarEvent, users } = useData();
  const { currentUser, user, isAdmin, isCampusAdmin } = useAuth();
  const loggedInUser = currentUser || user;
  const isMaintenance =
    loggedInUser?.role === 'maintenance' ||
    loggedInUser?.role === 'technician' ||
    loggedInUser?.userType === 'maintenance';

  const toastCtx = useOptionalToast();
  const toast = toastCtx?.toast;

  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => toISODate(new Date()));
  const [serverSchedules, setServerSchedules] = useState(null);
  const [pendingRemove, setPendingRemove] = useState(null);

  // Mark done modal state
  const [markDoneTarget, setMarkDoneTarget] = useState(null);
  const [markDoneRemarks, setMarkDoneRemarks] = useState('');
  const [markDonePhoto, setMarkDonePhoto] = useState(null);
  const [markDonePhotoName, setMarkDonePhotoName] = useState('');
  const [isMarkingDone, setIsMarkingDone] = useState(false);

  // Reschedule modal state for Admin
  const [rescheduleTarget, setRescheduleTarget] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [rescheduleInCharge, setRescheduleInCharge] = useState('');
  const [isRescheduling, setIsRescheduling] = useState(false);

  // Maintenance filter tab: 'my' (assigned to me) vs 'all' (all campus tasks)
  const [maintenanceFilter, setMaintenanceFilter] = useState('all');

  // Photo viewer modal
  const [photoViewerUrl, setPhotoViewerUrl] = useState(null);
  const [photoViewerTitle, setPhotoViewerTitle] = useState('');

  const blankForm = useCallback(
    () => ({
      title: '',
      category: 'Electrical',
      time: '08:00 AM - 12:00 PM',
      location: '',
      inCharge: '',
      description: '',
      recurrence: 'Quarterly',
      reminderLead: '1 day before'
    }),
    []
  );
  const [form, setForm] = useState(blankForm);

  const fetchSchedules = useCallback(async () => {
    try {
      const rows = await apiGetPreventiveSchedules();
      setServerSchedules(Array.isArray(rows) ? rows : []);
    } catch {
      setServerSchedules(null);
    }
  }, []);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  const technicians = useMemo(() => {
    const maintenanceRole = (value) => {
      const role = String(value || '').toLowerCase().trim();
      return role === 'maintenance' || role === 'technician' || role.includes('tech');
    };
    return (users || []).filter(
      (u) => maintenanceRole(u.role) || maintenanceRole(u.userType)
    );
  }, [users]);

  const monthLabel = visibleMonth.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric'
  });

  const allEvents = useMemo(() => {
    const fromServer = (serverSchedules || [])
      .map((row) => ({
        id: `PMS-${row.id}`,
        serverId: row.id,
        title: row.title,
        category: row.category,
        date: String(row.scheduled_date || '').slice(0, 10),
        time: row.time_window || '',
        location: row.location || '',
        inCharge: row.in_charge_name || row.assigned_tech_name || '',
        assignedTo: row.assigned_to,
        assignedTechName: row.assigned_tech_name,
        status: row.status || 'Scheduled',
        description: row.description || '',
        recurrence: row.recurrence || 'Quarterly',
        reminderLead: row.reminder_lead || '1 day before',
        completedAt: row.completed_at,
        completedBy: row.completed_by,
        completedByName: row.completed_by_name,
        completionNotes: row.completion_notes,
        completionPhoto: row.completion_photo,
        completionPhotoName: row.completion_photo_name
      }))
      .filter((row) => /^\d{4}-\d{2}-\d{2}$/.test(row.date));

    const loaded = serverSchedules !== null;
    const serverKeys = new Set(fromServer.map(scheduleKey));

    const fromDevice = (calendarEvents || []).map((event) => ({
      ...event,
      description: event.description || '',
      recurrence: event.recurrence || 'Quarterly',
      reminderLead: event.reminderLead || '1 day before',
      completedAt: event.completedAt,
      completedBy: event.completedBy,
      completedByName: event.completedByName,
      completionNotes: event.completionNotes,
      completionPhoto: event.completionPhoto,
      completionPhotoName: event.completionPhotoName
    })).filter((event) => {
      if (!event?.date) return false;
      if (!loaded) return true;
      if (event.serverId) return false;
      return !serverKeys.has(scheduleKey(event));
    });

    return [...fromServer, ...fromDevice];
  }, [serverSchedules, calendarEvents]);

  const eventsByDate = useMemo(() => {
    const map = new Map();
    allEvents.forEach((event) => {
      if (!event?.date) return;
      if (!map.has(event.date)) map.set(event.date, []);
      map.get(event.date).push(event);
    });
    map.forEach((list) => list.sort((a, b) => String(a.time).localeCompare(String(b.time))));
    return map;
  }, [allEvents]);

  const monthDays = useMemo(() => {
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const cells = Math.ceil((firstDay + totalDays) / 7) * 7;
    return Array.from({ length: cells }, (_, index) => {
      const day = index - firstDay + 1;
      if (day < 1 || day > totalDays) return null;
      return toISODate(new Date(year, month, day));
    });
  }, [visibleMonth]);

  const monthPrefix = `${visibleMonth.getFullYear()}-${String(visibleMonth.getMonth() + 1).padStart(2, '0')}`;
  const monthEventCount = allEvents.filter((e) => String(e.date || '').startsWith(monthPrefix)).length;

  /* Legend chips are derived from the categories actually on the board. */
  const legendCategories = useMemo(() => {
    const seen = new Set();
    allEvents.forEach((event) => {
      if (event?.category) seen.add(event.category);
    });
    return [...seen].sort((a, b) => String(a).localeCompare(String(b)));
  }, [allEvents]);

  const eventsForDate = eventsByDate.get(selectedDate) || [];
  const todayISO = toISODate(new Date());
  const canRemove = !isReadOnly && (Boolean(isAdmin) || Boolean(isCampusAdmin));
  const canSchedule = !isReadOnly && (Boolean(isAdmin) || Boolean(isCampusAdmin) || isMaintenance || !loggedInUser);

  const isAssignedToMe = useCallback(
    (event) => {
      if (!loggedInUser) return false;
      const myId = String(loggedInUser.id || '');
      const myName = String(loggedInUser.name || `${loggedInUser.first_name || ''} ${loggedInUser.last_name || ''}`).trim().toLowerCase();
      const inCharge = String(event.inCharge || event.assignedTechName || '').trim().toLowerCase();
      const assignedId = String(event.assignedTo || '');
      return (myId && assignedId === myId) || (myName && inCharge.includes(myName));
    },
    [loggedInUser]
  );

  const shownStatus = (event) => {
    const status = event.status || 'Scheduled';
    if ((status === 'Scheduled' || status === 'In Progress') && event.date < todayISO) {
      return 'Overdue';
    }
    return status;
  };

  // Metric computations matching the prototype cards
  const scheduledCount = allEvents.filter(
    (e) => (e.status === 'Scheduled' || e.status === 'In Progress') && e.date >= todayISO
  ).length;

  const dueTodayCount = allEvents.filter(
    (e) => e.date === todayISO && e.status !== 'Completed' && e.status !== 'Cancelled'
  ).length;

  const overdueCount = allEvents.filter(
    (e) => e.date < todayISO && e.status !== 'Completed' && e.status !== 'Cancelled'
  ).length;

  const myOverdueCount = allEvents.filter(
    (e) => e.date < todayISO && e.status !== 'Completed' && e.status !== 'Cancelled' && isAssignedToMe(e)
  ).length;

  const completedCount = allEvents.filter((e) => e.status === 'Completed').length;

  const goToMonth = (offset) => {
    const next = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + offset, 1);
    setVisibleMonth(next);
    const [year, month] = selectedDate.split('-').map(Number);
    if (year !== next.getFullYear() || month !== next.getMonth() + 1) {
      setSelectedDate(toISODate(next));
    }
  };

  const goToToday = () => {
    const today = new Date();
    setVisibleMonth(today);
    setSelectedDate(toISODate(today));
  };

  const selectDate = (date) => setSelectedDate(date);

  const openSchedule = () => {
    setForm(blankForm());
    setIsScheduleModalOpen(true);
  };

  const setField = (patch) => setForm((current) => ({ ...current, ...patch }));

  const handleAddEvent = async (e) => {
    e.preventDefault();
    const typed = String(form.inCharge || '').trim();
    const matched = technicians.find((t) => String(t.name || `${t.first_name || ''} ${t.last_name || ''}`).trim() === typed);
    try {
      await addCalendarEvent({
        ...form,
        inCharge: typed,
        assignedTo: matched ? matched.id : null,
        date: selectedDate
      });
      toast?.('Preventive maintenance task scheduled.', 'success');
      setIsScheduleModalOpen(false);
      setForm(blankForm());
      await fetchSchedules();
    } catch {
      toast?.('Failed to schedule maintenance.', 'error');
    }
  };

  const confirmRemove = async () => {
    const target = pendingRemove;
    setPendingRemove(null);
    if (!target) return;
    try {
      await removeCalendarEvent(target);
      toast?.('Schedule removed.', 'success');
      await fetchSchedules();
    } catch {
      toast?.('Could not remove the schedule.', 'error');
    }
  };

  const handleOpenReschedule = (event) => {
    setRescheduleTarget(event);
    setRescheduleDate(event.date || todayISO);
    setRescheduleTime(event.time || '08:00 AM - 12:00 PM');
    setRescheduleInCharge(event.inCharge || event.assignedTechName || '');
  };

  const handleSaveReschedule = async (e) => {
    e.preventDefault();
    if (!rescheduleTarget) return;
    setIsRescheduling(true);
    try {
      const matched = technicians.find(
        (t) => String(t.name || `${t.first_name || ''} ${t.last_name || ''}`).trim() === rescheduleInCharge.trim()
      );
      if (updateCalendarEvent) {
        await updateCalendarEvent(rescheduleTarget.id, {
          serverId: rescheduleTarget.serverId,
          scheduledDate: rescheduleDate,
          date: rescheduleDate,
          timeWindow: rescheduleTime,
          time: rescheduleTime,
          inChargeName: rescheduleInCharge.trim(),
          inCharge: rescheduleInCharge.trim(),
          assignedTo: matched ? matched.id : rescheduleTarget.assignedTo,
          status: 'Scheduled'
        });
      }
      toast?.('Preventive maintenance task rescheduled.', 'success');
      setRescheduleTarget(null);
      await fetchSchedules();
    } catch {
      toast?.('Could not reschedule task.', 'error');
    } finally {
      setIsRescheduling(false);
    }
  };

  const handleOpenMarkDone = (event) => {
    setMarkDoneTarget(event);
    setMarkDoneRemarks('');
    setMarkDonePhoto(null);
    setMarkDonePhotoName('');
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast?.('Photo must be under 8MB', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (loadEvt) => {
      const img = new Image();
      img.onload = () => {
        // Optimize resolution for fast transmission & crisp mobile viewing
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 1200;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setMarkDonePhoto(dataUrl);
        setMarkDonePhotoName(file.name);
      };
      img.src = loadEvt.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleConfirmDone = async () => {
    if (!markDoneTarget) return;
    setIsMarkingDone(true);
    try {
      await completeCalendarEvent(markDoneTarget, {
        remarks: markDoneRemarks,
        photoUrl: markDonePhoto,
        photoName: markDonePhotoName
      });
      toast?.('Task marked as completed.', 'success');
      setMarkDoneTarget(null);
      setMarkDoneRemarks('');
      setMarkDonePhoto(null);
      setMarkDonePhotoName('');
      await fetchSchedules();
    } catch (err) {
      console.error('Error completing task:', err);
      toast?.('Could not mark task as completed. Please try again.', 'error');
    } finally {
      setIsMarkingDone(false);
    }
  };

  const selectedLabel = new Date(`${selectedDate}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* ---- Executive Page Header (Consistent with Official Documents) ---- */}
      <PageHeader
        breadcrumbs={[
          'Operations',
          isMaintenance ? 'My Preventive Maintenance' : 'Preventive Maintenance Calendar'
        ]}
        title={isMaintenance ? 'My Preventive Maintenance' : 'Preventive Maintenance Calendar'}
        description={
          isMaintenance
            ? 'Tap a day to see your tasks. Mark done when finished; a photo is optional.'
            : isReadOnly
            ? 'Campus inspections, equipment checks and servicing'
            : 'Schedule, assign, and oversee campus facilities maintenance activities.'
        }
        action={
          canSchedule && !isMaintenance ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={openSchedule}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: '700' }}
            >
              <Plus size={16} /> Schedule Maintenance Activity
            </button>
          ) : null
        }
      />

      {/* ---- Maintenance Role Filter ---- */}
      {isMaintenance && (
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className={`btn btn-sm ${maintenanceFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setMaintenanceFilter('all')}
            style={{ fontWeight: '600' }}
          >
            All Campus Tasks
          </button>
          <button
            type="button"
            className={`btn btn-sm ${maintenanceFilter === 'my' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setMaintenanceFilter('my')}
            style={{ fontWeight: '600' }}
          >
            Assigned to Me
          </button>
        </div>
      )}

      {/* ---- Overdue Alert Banner: ONLY VISIBLE TO MAINTENANCE FOR OVERDUE TASKS ---- */}
      {isMaintenance && myOverdueCount > 0 && (
        <div className="preventive-alert-banner">
          <AlertTriangle size={18} style={{ flexShrink: 0 }} />
          <span>
            You have {myOverdueCount} overdue task{myOverdueCount > 1 ? 's' : ''}. Please complete or ask admin to reschedule.
          </span>
        </div>
      )}

      {/* ---- Summary KPI Badges (Exact match to Official Documents design) ---- */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderLeft: '4px solid #001f9c', borderRadius: '10px', padding: '14px 16px' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Scheduled Tasks</div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', marginTop: '2px' }}>{scheduledCount}</div>
        </div>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderLeft: '4px solid #0284c7', borderRadius: '10px', padding: '14px 16px' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Due Today</div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: dueTodayCount > 0 ? '#0284c7' : '#0f172a', marginTop: '2px' }}>{dueTodayCount}</div>
        </div>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderLeft: '4px solid #f59e0b', borderRadius: '10px', padding: '14px 16px' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Overdue</div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: overdueCount > 0 ? '#d97706' : '#0f172a', marginTop: '2px' }}>{overdueCount}</div>
        </div>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderLeft: '4px solid #059669', borderRadius: '10px', padding: '14px 16px' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Completed</div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: completedCount > 0 ? '#059669' : '#0f172a', marginTop: '2px' }}>{completedCount}</div>
        </div>
      </div>

      {/* ---- Main 2-Column Calendar Layout ---- */}
      <div
        className="preventive-layout"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.9fr) minmax(320px, 1.1fr)',
          gap: '24px',
          alignItems: 'start'
        }}
      >
        {/* ---- Left Column: Month Grid Card ---- */}
        <div className="content-card">
          <div className="card-header" style={{ alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => goToMonth(-1)}
                aria-label="Previous month"
                title="Previous month"
              >
                <ChevronLeft size={16} />
              </button>
              <h2 className="card-title" style={{ minWidth: '170px', textAlign: 'center', fontSize: '16px', fontWeight: '800' }}>
                {monthLabel}
              </h2>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => goToMonth(1)}
                aria-label="Next month"
                title="Next month"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap', fontWeight: '600' }}>
                {monthEventCount} scheduled this month
              </span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={goToToday}
                aria-label="Jump to today"
              >
                Today
              </button>
            </div>
          </div>

          {legendCategories.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '0 16px 12px' }}>
              {legendCategories.map((category) => {
                const tone = toneFor(category);
                return (
                  <span
                    key={category}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '3px 10px',
                      borderRadius: '9999px',
                      background: tone.background,
                      border: `1px solid ${tone.border}`,
                      color: tone.text,
                      fontSize: '11.5px',
                      fontWeight: '600'
                    }}
                  >
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: tone.border }} />
                    {category}
                  </span>
                );
              })}
            </div>
          )}

          <div style={{ padding: '16px' }}>
            <div
              role="grid"
              aria-label={`Maintenance schedule for ${monthLabel}`}
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
                borderTop: '1px solid #e2e8f0',
                borderLeft: '1px solid #e2e8f0'
              }}
            >
              {WEEKDAYS.map((day) => (
                <div
                  key={day}
                  role="columnheader"
                  style={{
                    padding: '10px 4px',
                    textAlign: 'center',
                    background: 'var(--bg-sunken)',
                    borderRight: '1px solid #e2e8f0',
                    borderBottom: '1px solid #e2e8f0',
                    color: '#64748b',
                    fontSize: '11px',
                    fontWeight: '800',
                    letterSpacing: '0.5px'
                  }}
                >
                  {day}
                </div>
              ))}

              {monthDays.map((date, index) => {
                if (!date) {
                  return (
                    <div
                      key={`empty-${index}`}
                      aria-hidden="true"
                      style={{
                        minHeight: '110px',
                        background: 'var(--bg-surface)',
                        borderRight: '1px solid #e2e8f0',
                        borderBottom: '1px solid #e2e8f0'
                      }}
                    />
                  );
                }
                const dayEvents = eventsByDate.get(date) || [];
                const isSelected = date === selectedDate;
                const isToday = date === todayISO;

                return (
                  <button
                    key={date}
                    type="button"
                    onClick={() => selectDate(date)}
                    aria-pressed={isSelected}
                    aria-label={`${date}${dayEvents.length ? `, ${dayEvents.length} scheduled` : ', nothing scheduled'}`}
                    style={{
                      minHeight: '110px',
                      padding: '8px',
                      textAlign: 'left',
                      background: isSelected ? '#f0f7ff' : '#ffffff',
                      border: 0,
                      borderRight: '1px solid #e2e8f0',
                      borderBottom: '1px solid #e2e8f0',
                      boxShadow: isSelected ? 'inset 0 0 0 2px #2563eb' : 'none',
                      cursor: 'pointer',
                      font: 'inherit',
                      position: 'relative',
                      transition: 'background-color 0.1s ease'
                    }}
                  >
                    <span
                      style={{
                        display: 'inline-flex',
                        width: '24px',
                        height: '24px',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '50%',
                        background: isToday ? '#001f9c' : 'transparent',
                        color: isToday ? '#ffffff' : '#334155',
                        fontSize: '12px',
                        fontWeight: '800'
                      }}
                    >
                      {Number(date.slice(-2))}
                    </span>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
                      {dayEvents.slice(0, 2).map((event) => {
                        const status = shownStatus(event);
                        const isDone = status === 'Completed';
                        const isLate = status === 'Overdue';

                        let chipBg = '#dbeafe';
                        let chipBorder = '#93c5fd';
                        let chipColor = '#1e40af';

                        if (isDone) {
                          chipBg = '#dcfce7';
                          chipBorder = '#86efac';
                          chipColor = '#166534';
                        } else if (isLate) {
                          chipBg = '#fee2e2';
                          chipBorder = '#fca5a5';
                          chipColor = '#991b1b';
                        } else {
                          const tone = toneFor(event.category);
                          chipBg = tone.background;
                          chipBorder = tone.border;
                          chipColor = tone.text || '#1e293b';
                        }

                        return (
                          <span
                            key={event.id}
                            title={`${event.title} — ${event.time} — ${status}`}
                            style={{
                              display: 'block',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              padding: '3px 6px',
                              borderRadius: '4px',
                              background: chipBg,
                              border: `1px solid ${chipBorder}`,
                              color: chipColor,
                              fontSize: '10.5px',
                              fontWeight: '700',
                              opacity: isDone ? 0.75 : 1,
                              textDecoration: event.status === 'Cancelled' ? 'line-through' : 'none'
                            }}
                          >
                            {event.title}
                          </span>
                        );
                      })}
                      {dayEvents.length > 2 && (
                        <span style={{ color: '#64748b', fontSize: '10px', fontWeight: '700' }}>
                          +{dayEvents.length - 2} more
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ---- Right Column: Selected Day & Task Details ---- */}
        <div className="content-card">
          <div className="card-header" style={{ alignItems: 'center' }}>
            <div>
              <h2 className="card-title" style={{ fontSize: '16px', fontWeight: '800' }}>{selectedLabel}</h2>
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>
                {eventsForDate.length} scheduled
              </span>
            </div>
          </div>

          <div style={{ padding: '16px' }}>
            {eventsForDate.filter(e => !isMaintenance || maintenanceFilter === 'all' || isAssignedToMe(e)).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 12px' }}>
                <CalendarIcon size={32} style={{ color: '#cbd5e1', marginBottom: '10px' }} />
                <div style={{ color: '#64748b', fontSize: '13.5px', fontWeight: '600' }}>
                  Nothing scheduled for this day.
                </div>
              </div>
            ) : (
              eventsForDate
                .filter(e => !isMaintenance || maintenanceFilter === 'all' || isAssignedToMe(e))
                .map((event) => {
                const status = shownStatus(event);
                const isDone = status === 'Completed';
                const isLate = status === 'Overdue';

                let borderLeftColor = '#3b82f6';
                if (isDone) borderLeftColor = '#16a34a';
                else if (isLate) borderLeftColor = '#dc2626';

                return (
                  <div
                    key={event.id}
                    className="preventive-task-card"
                    style={{
                      borderLeft: `4px solid ${borderLeftColor}`
                    }}
                  >
                    {/* Title */}
                    <div style={{ fontWeight: '800', color: '#0f172a', fontSize: '15px', marginBottom: '8px' }}>
                      {event.title}
                    </div>

                    {/* Badges Row */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center', marginBottom: '12px' }}>
                      {/* Status badge */}
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '3px 8px',
                          background: STATUS_TONES[status]?.background || '#dbeafe',
                          border: `1px solid ${STATUS_TONES[status]?.border || '#93c5fd'}`,
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: '700',
                          color: STATUS_TONES[status]?.color || '#1e40af'
                        }}
                      >
                        {isDone && <Check size={12} />}
                        {isLate && <AlertTriangle size={12} />}
                        {status}
                      </span>

                      {/* Category Badge */}
                      <CategoryPill category={event.category} />

                      {/* Recurrence badge */}
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '3px 8px',
                          background: 'var(--bg-sunken)',
                          border: '1px solid #e2e8f0',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: '600',
                          color: '#475569'
                        }}
                      >
                        <Repeat size={12} />
                        {event.recurrence || 'Quarterly'}
                      </span>
                    </div>

                    {/* Task Details List with Icons */}
                    <div
                      style={{
                        display: 'grid',
                        gap: '8px',
                        color: '#475569',
                        fontSize: '12.5px',
                        marginBottom: '14px'
                      }}
                    >
                      <span style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <Clock size={14} style={{ color: '#64748b', flexShrink: 0 }} />
                        <span>{event.time || '08:00 AM - 12:00 PM'}</span>
                      </span>
                      <span style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <MapPin size={14} style={{ color: '#64748b', flexShrink: 0 }} />
                        <span>{event.location}</span>
                      </span>
                      <span style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <User size={14} /> {event.inCharge}
                      </span>
                      <span style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <Bell size={14} style={{ color: '#64748b', flexShrink: 0 }} />
                        <span>Reminder: {event.reminderLead || '1 day before'}</span>
                      </span>
                      {event.description && (
                        <span style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginTop: '2px' }}>
                          <FileText size={14} style={{ color: '#64748b', flexShrink: 0, marginTop: '2px' }} />
                          <span style={{ fontStyle: 'normal', color: '#334155' }}>{event.description}</span>
                        </span>
                      )}
                    </div>

                    {/* Completion Info Box (Shown when task is marked Completed) */}
                    {isDone && (
                      <div
                        style={{
                          background: '#f0fdf4',
                          border: '1px solid #bbf7d0',
                          borderRadius: '8px',
                          padding: '10px 12px',
                          marginBottom: '12px',
                          fontSize: '12px',
                          color: '#166534'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700', marginBottom: '4px' }}>
                          <Check size={14} color="#16a34a" />
                          <span>
                            Completed {event.completedAt ? `on ${new Date(event.completedAt).toLocaleDateString()}` : ''}
                            {event.completedByName ? ` by ${event.completedByName}` : ''}
                          </span>
                        </div>
                        {event.completionNotes && (
                          <div style={{ color: '#334155', marginTop: '4px', fontStyle: 'italic' }}>
                            &ldquo;{event.completionNotes}&rdquo;
                          </div>
                        )}
                        {event.completionPhoto && (
                          <div style={{ marginTop: '8px' }}>
                            <button
                              type="button"
                              onClick={() => {
                                setPhotoViewerUrl(event.completionPhoto);
                                setPhotoViewerTitle(event.title);
                              }}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                background: '#ffffff',
                                border: '1px solid #86efac',
                                borderRadius: '6px',
                                padding: '4px 8px',
                                fontSize: '11.5px',
                                color: '#15803d',
                                cursor: 'pointer',
                                fontWeight: '600'
                              }}
                            >
                              <Eye size={13} />
                              View completion photo
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Action Buttons Row */}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginTop: '10px' }}>
                      {/* Mark Done button - ONLY for Maintenance personnel */}
                      {!isDone && !isReadOnly && isMaintenance && (
                        <button
                          type="button"
                          className="btn-done"
                          onClick={() => handleOpenMarkDone(event)}
                        >
                          <Check size={15} />
                          Mark done
                        </button>
                      )}

                      {/* Reschedule button for Admin / Management */}
                      {canSchedule && !isMaintenance && !isDone && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleOpenReschedule(event)}
                          title="Reschedule task"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                          <Clock size={14} />
                          Reschedule
                        </button>
                      )}

                      {/* Remove button for Admin */}
                      {canRemove && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setPendingRemove(event)}
                          title="Remove schedule"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                          <Trash2 size={14} />
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            {/* Schedule New Maintenance Button */}
            {canSchedule && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={openSchedule}
                style={{ width: '100%', marginTop: '14px', justifyContent: 'center' }}
              >
                <Plus size={16} />
                {eventsForDate.length === 0 ? 'Schedule for this day' : 'Add another schedule'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ---- Modal: Mark as Done (Matches Image 2) ---- */}
      {markDoneTarget && (
        <Modal
          isOpen
          onClose={() => setMarkDoneTarget(null)}
          title="Mark as done"
          maxWidth="480px"
        >
          <div style={{ marginBottom: '14px', fontSize: '13px', color: '#475569' }}>
            Completing: <strong style={{ color: '#0f172a' }}>{markDoneTarget.title}</strong>
          </div>

          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label" htmlFor="done-remarks">
              Remarks (optional)
            </label>
            <textarea
              id="done-remarks"
              className="form-input"
              rows={3}
              placeholder="What was done? Any issues found?"
              value={markDoneRemarks}
              onChange={(e) => setMarkDoneRemarks(e.target.value)}
              style={{ resize: 'vertical' }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label className="form-label" htmlFor="done-photo">
              Photo (optional)
            </label>
            <input
              id="done-photo"
              type="file"
              accept="image/*"
              className="form-input"
              onChange={handlePhotoUpload}
            />

            {/* Photo preview */}
            {markDonePhoto && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  marginTop: '10px',
                  padding: '8px 12px',
                  background: 'var(--bg-surface)',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px'
                }}
              >
                <img
                  src={markDonePhoto}
                  alt="Preview"
                  style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '6px' }}
                />
                <span style={{ fontSize: '12px', color: '#334155', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {markDonePhotoName || 'Photo selected'}
                </span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setMarkDonePhoto(null);
                    setMarkDonePhotoName('');
                  }}
                  title="Remove photo"
                >
                  <X size={14} />
                </button>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setMarkDoneTarget(null)}
              disabled={isMarkingDone}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-done"
              onClick={handleConfirmDone}
              disabled={isMarkingDone}
            >
              <Check size={16} />
              {isMarkingDone ? 'Saving...' : 'Confirm done'}
            </button>
          </div>
        </Modal>
      )}

      {/* ---- Modal: Schedule Maintenance (Admin & Tech) ---- */}
      {isScheduleModalOpen && (
        <Modal
          isOpen={isScheduleModalOpen}
          onClose={() => setIsScheduleModalOpen(false)}
          title={`Schedule Maintenance — ${new Date(`${selectedDate}T00:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`}
          maxWidth="560px"
        >
          <form onSubmit={handleAddEvent}>
            <div className="form-group">
              <label className="form-label" htmlFor="pm-title">
                Maintenance Title *
              </label>
              <input
                id="pm-title"
                type="text"
                className="form-input"
                placeholder="e.g. Electrical panel inspection"
                value={form.title ?? ''}
                onChange={(e) => setField({ title: e.target.value })}
                required
              />
            </div>

            <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="pm-category">
                  Category *
                </label>
                <select
                  id="pm-category"
                  className="form-select"
                  value={form.category}
                  onChange={(e) => setField({ category: e.target.value })}
                >
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="pm-time">
                  Time Window
                </label>
                <input
                  id="pm-time"
                  type="text"
                  className="form-input"
                  placeholder="08:00 AM - 12:00 PM"
                  value={form.time ?? ''}
                  onChange={(e) => setField({ time: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="pm-location">
                Location / Area *
              </label>
              <input
                id="pm-location"
                type="text"
                className="form-input"
                placeholder="e.g. Student Center, CEA Building"
                value={form.location ?? ''}
                onChange={(e) => setField({ location: e.target.value })}
                required
              />
            </div>

            <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="pm-recurrence">
                  Recurrence
                </label>
                <select
                  id="pm-recurrence"
                  className="form-select"
                  value={form.recurrence}
                  onChange={(e) => setField({ recurrence: e.target.value })}
                >
                  {RECURRENCE_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="pm-reminder">
                  Reminder Lead Time
                </label>
                <select
                  id="pm-reminder"
                  className="form-select"
                  value={form.reminderLead}
                  onChange={(e) => setField({ reminderLead: e.target.value })}
                >
                  {REMINDER_OPTIONS.map((rem) => (
                    <option key={rem} value={rem}>
                      {rem}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="pm-incharge">
                Lead Technician in Charge
              </label>
              <input
                id="pm-incharge"
                type="text"
                className="form-input"
                list="pm-incharge-list"
                placeholder="Name of the technician"
                value={form.inCharge ?? ''}
                onChange={(e) => setField({ inCharge: e.target.value })}
              />
              <datalist id="pm-incharge-list">
                {technicians.map((t) => (
                  <option key={t.id} value={t.name || `${t.first_name || ''} ${t.last_name || ''}`.trim()} />
                ))}
                <option value="Mark Villanueva" />
                <option value="carl melo" />
                <option value="PDAS Maintenance Team" />
              </datalist>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="pm-description">
                Checklist / Task Instructions (optional)
              </label>
              <textarea
                id="pm-description"
                className="form-input"
                rows={2}
                placeholder="e.g. Check breakers and thermographic scan."
                value={form.description ?? ''}
                onChange={(e) => setField({ description: e.target.value })}
              />
            </div>

            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setIsScheduleModalOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                <CalendarIcon size={16} />
                Add to Calendar
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ---- Modal: Remove Confirmation ---- */}
      {pendingRemove && (
        <Modal
          isOpen
          onClose={() => setPendingRemove(null)}
          title="Remove schedule"
          maxWidth="440px"
        >
          <p style={{ fontSize: '14px', color: '#475569', lineHeight: 1.6, margin: '0 0 20px' }}>
            Remove <strong>&ldquo;{pendingRemove.title}&rdquo;</strong> from{' '}
            {new Date(`${pendingRemove.date}T00:00:00`).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric'
            })}
            ?
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setPendingRemove(null)}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={confirmRemove}>
              <Trash2 size={15} />
              Remove
            </button>
          </div>
        </Modal>
      )}

      {/* ---- Modal: Reschedule Maintenance (Admin Only) ---- */}
      {rescheduleTarget && (
        <Modal
          isOpen
          onClose={() => setRescheduleTarget(null)}
          title={`Reschedule Task — ${rescheduleTarget.title}`}
          maxWidth="480px"
        >
          <form onSubmit={handleSaveReschedule}>
            <div style={{ marginBottom: '14px', fontSize: '13px', color: '#475569' }}>
              Current Schedule: <strong>{rescheduleTarget.date}</strong> ({rescheduleTarget.time || '08:00 AM - 12:00 PM'})
            </div>

            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label className="form-label" htmlFor="reschedule-date">
                New Scheduled Date *
              </label>
              <input
                id="reschedule-date"
                type={'date'}
                className="form-input"
                value={rescheduleDate}
                onChange={(e) => setRescheduleDate(e.target.value)}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label className="form-label" htmlFor="reschedule-time">
                Time Window
              </label>
              <input
                id="reschedule-time"
                type="text"
                className="form-input"
                placeholder="08:00 AM - 12:00 PM"
                value={rescheduleTime}
                onChange={(e) => setRescheduleTime(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ marginBottom: '18px' }}>
              <label className="form-label" htmlFor="reschedule-tech">
                Assigned Maintenance Personnel
              </label>
              <select
                id="reschedule-tech"
                className="form-select"
                value={rescheduleInCharge}
                onChange={(e) => setRescheduleInCharge(e.target.value)}
              >
                <option value="">Select Personnel (or General Maintenance)</option>
                {technicians.map((t) => {
                  const name = String(t.name || `${t.first_name || ''} ${t.last_name || ''}`).trim();
                  return (
                    <option key={t.id} value={name}>
                      {name} ({t.specialization || 'Maintenance'})
                    </option>
                  );
                })}
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setRescheduleTarget(null)}
                disabled={isRescheduling}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isRescheduling}
              >
                <Clock size={15} />
                {isRescheduling ? 'Saving…' : 'Save Reschedule'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ---- Modal: Completion Photo Viewer ---- */}
      {photoViewerUrl && (
        <Modal
          isOpen
          onClose={() => setPhotoViewerUrl(null)}
          title={`Completion Photo — ${photoViewerTitle}`}
          maxWidth="640px"
        >
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <img
              src={photoViewerUrl}
              alt="Completion Proof"
              style={{
                maxWidth: '100%',
                maxHeight: '480px',
                borderRadius: '8px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
              }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setPhotoViewerUrl(null)}
            >
              Close
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};

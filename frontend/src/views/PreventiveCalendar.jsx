import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  MapPin,
  User,
  Trash2
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/common/Modal';
import { CategoryPill } from '../components/common/StatusBadge';
import { useOptionalToast } from '../components/ui/Toast';
import { apiGetPreventiveSchedules } from '../backend/api';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/* One place that decides how a category is tinted, so the grid chip, the day
   panel and the legend can never drift apart. Every category the form offers
   has a tone — the three that used to fall through to grey made half the month
   look unclassified. */
const CATEGORY_TONES = {
  Electrical: { background: '#dbeafe', border: '#93c5fd' },
  'Safety & Compliance': { background: '#fef3c7', border: '#fcd34d' },
  'Air Conditioning': { background: '#e0e7ff', border: '#a5b4fc' },
  Mechanical: { background: '#dcfce7', border: '#86efac' },
  'Water/Sanitary': { background: '#cffafe', border: '#67e8f9' },
  'Physical Structures': { background: '#ffedd5', border: '#fdba74' },
  'Drawing/Design': { background: '#f3e8ff', border: '#d8b4fe' }
};

/* The four statuses the API allows, plus the one the panel derives: a date that
   has passed while still sitting at Scheduled. */
const STATUS_TONES = {
  Scheduled: { background: '#dbeafe', color: '#1e40af', border: '#93c5fd' },
  'In Progress': { background: '#fef3c7', color: '#92400e', border: '#fcd34d' },
  Completed: { background: '#dcfce7', color: '#166534', border: '#86efac' },
  Cancelled: { background: '#f1f5f9', color: '#64748b', border: '#cbd5e1' },
  Overdue: { background: '#fee2e2', color: '#b91c1c', border: '#fca5a5' }
};

const toneFor = (category) =>
  CATEGORY_TONES[category] || { background: '#e2e8f0', border: '#cbd5e1' };

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

/* Identity of a schedule across the two places it can live: this browser's
   store and the database. Rows posted before we started keeping the server id
   would otherwise appear twice once the calendar reads the server. */
const scheduleKey = (row) =>
  [
    row.date,
    String(row.title || '').trim().toLowerCase(),
    String(row.time || '').trim(),
    String(row.location || '').trim().toLowerCase()
  ].join('|');

export const PreventiveCalendar = ({ isReadOnly = false }) => {
  const { calendarEvents, addCalendarEvent, removeCalendarEvent, users } = useData();
  const { isAdmin, isCampusAdmin } = useAuth();
  const toastCtx = useOptionalToast();
  const toast = toastCtx?.toast;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => toISODate(new Date()));
  const [serverSchedules, setServerSchedules] = useState(null);
  const [pendingRemove, setPendingRemove] = useState(null);

  // The form starts blank. The date is not stored here — it comes from
  // selectedDate when the dialog opens, so there is a single source of truth
  // and the two can never disagree.
  const blankForm = useCallback(() => ({
    title: '',
    category: 'Electrical',
    time: '08:00 AM - 12:00 PM',
    location: '',
    inCharge: ''
  }), []);
  const [form, setForm] = useState(blankForm);

  /* The database is the shared copy of the schedule. Without this read the
     calendar only ever showed entries made in this browser, so a technician
     opening their calendar saw an empty month while the admin's schedules sat
     in the table. null means "not reached" — the device copy is used alone. */
  useEffect(() => {
    let cancelled = false;
    apiGetPreventiveSchedules()
      .then((rows) => {
        if (!cancelled) setServerSchedules(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (!cancelled) setServerSchedules(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /* The roster is only loaded for administrators, and the filter used to match
     role spellings the API never returns — so the picker was empty for everyone.
     Match the normalized value and the raw one it can arrive as. */
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

  /* Merge the two sources ONCE. The server copy wins when both know about a
     schedule: it carries the real status and the id the remove action needs. */
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
        status: row.status || 'Scheduled'
      }))
      .filter((row) => /^\d{4}-\d{2}-\d{2}$/.test(row.date));

    const loaded = serverSchedules !== null;
    const serverKeys = new Set(fromServer.map(scheduleKey));

    const fromDevice = (calendarEvents || []).filter((event) => {
      if (!event?.date) return false;
      if (!loaded) return true;
      // A row we already posted is the server's; one whose server copy is gone
      // was withdrawn there and should not come back from this browser.
      if (event.serverId) return false;
      return !serverKeys.has(scheduleKey(event));
    });

    return [...fromServer, ...fromDevice];
  }, [serverSchedules, calendarEvents]);

  /* Index the events by date ONCE. The grid used to filter the whole event
     list for all 42 cells, which is O(days x events) on every render. */
  const eventsByDate = useMemo(() => {
    const map = new Map();
    allEvents.forEach((event) => {
      if (!event?.date) return;
      if (!map.has(event.date)) map.set(event.date, []);
      map.get(event.date).push(event);
    });
    // Keep each day in a stable order (earliest slot first).
    map.forEach((list) => list.sort((a, b) => String(a.time).localeCompare(String(b.time))));
    return map;
  }, [allEvents]);

  /* Leading blanks before the 1st, then enough trailing blanks to close the
     final week. Without the padding the last row stopped short of seven cells
     and the grid's right and bottom edges went ragged. */
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

  /* Only the categories actually on the board this month — a fixed legend of
     all seven listed colour for work that is not there. */
  const legendCategories = useMemo(() => {
    const seen = [];
    allEvents.forEach((event) => {
      if (!String(event.date || '').startsWith(monthPrefix)) return;
      if (event.category && !seen.includes(event.category)) seen.push(event.category);
    });
    return seen;
  }, [allEvents, monthPrefix]);

  const eventsForDate = eventsByDate.get(selectedDate) || [];
  const todayISO = toISODate(new Date());
  const canRemove = !isReadOnly && (Boolean(isAdmin) || Boolean(isCampusAdmin));

  /* Scheduled but already in the past reads as Overdue rather than Scheduled —
     it is the one status change the calendar can infer for itself. */
  const shownStatus = (event) => {
    const status = event.status || 'Scheduled';
    if (status === 'Scheduled' && event.date < todayISO) return 'Overdue';
    return status;
  };

  const goToMonth = (offset) => {
    const next = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + offset, 1);
    setVisibleMonth(next);
    // Keep the day panel pointing at a date that is actually on screen.
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

  /* Opening the dialog always targets the day the user is looking at. */
  const openSchedule = () => {
    setForm(blankForm);
    setIsModalOpen(true);
  };

  const setField = (patch) => setForm((current) => ({ ...current, ...patch }));

  const handleAddEvent = (e) => {
    e.preventDefault();
    const typed = String(form.inCharge || '').trim();
    const matched = technicians.find((t) => String(t.name || '').trim() === typed);
    addCalendarEvent({
      ...form,
      inCharge: typed,
      // Sent alongside the name so the reminder job has a user to notify.
      assignedTo: matched ? matched.id : null,
      // The date comes from the selected day, not from a form field.
      date: selectedDate
    });
    setIsModalOpen(false);
    setForm(blankForm());
  };

  const confirmRemove = async () => {
    const target = pendingRemove;
    setPendingRemove(null);
    if (!target) return;
    try {
      await removeCalendarEvent(target);
      toast?.('Schedule removed.', 'success');
    } catch {
      toast?.('Could not remove the schedule.', 'error');
    }
  };

  const selectedLabel = new Date(`${selectedDate}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Preventive Maintenance Calendar</h1>
          <p className="page-subtitle">
            {isReadOnly
              ? 'Campus inspections, equipment checks and servicing'
              : 'Select a day to view or schedule work'}
          </p>
        </div>
      </div>

      <div
        className="preventive-layout"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 2fr) minmax(280px, 1fr)',
          gap: '24px',
          alignItems: 'start'
        }}
      >
        {/* ---- Month grid ---- */}
        <div className="content-card">
          <div className="card-header" style={{ alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => goToMonth(-1)}
                aria-label="Previous month"
                title="Previous month"
              >
                <ChevronLeft size={16} />
              </button>
              <h2 className="card-title" style={{ minWidth: '190px', textAlign: 'center' }}>
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

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap' }}>
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
                    padding: '9px 6px',
                    textAlign: 'center',
                    background: 'var(--bg-sunken)',
                    borderRight: '1px solid #e2e8f0',
                    borderBottom: '1px solid #e2e8f0',
                    color: '#64748b',
                    fontSize: '11px',
                    fontWeight: '800',
                    textTransform: 'uppercase'
                  }}
                >
                  {day}
                </div>
              ))}

              {monthDays.map((date, index) => {
                if (!date) {
                  // Carries the same edges as a real day, otherwise the cells
                  // before the 1st and after the last leave holes in the frame.
                  return (
                    <div
                      key={`empty-${index}`}
                      aria-hidden="true"
                      style={{
                        minHeight: '112px',
                        background: 'var(--bg-sunken)',
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
                      minHeight: '112px',
                      padding: '8px',
                      textAlign: 'left',
                      background: isSelected ? '#eff6ff' : '#ffffff',
                      border: 0,
                      borderRight: '1px solid #e2e8f0',
                      borderBottom: '1px solid #e2e8f0',
                      cursor: 'pointer',
                      font: 'inherit'
                    }}
                  >
                    <span
                      style={{
                        display: 'inline-flex',
                        width: '25px',
                        height: '25px',
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

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '7px' }}>
                      {dayEvents.slice(0, 2).map((event) => {
                        const tone = toneFor(event.category);
                        const settled =
                          event.status === 'Completed' || event.status === 'Cancelled';
                        return (
                          <span
                            key={event.id}
                            title={`${event.title} — ${event.time} — ${shownStatus(event)}`}
                            style={{
                              display: 'block',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              padding: '4px 5px',
                              borderRadius: '4px',
                              background: tone.background,
                              border: `1px solid ${tone.border}`,
                              color: '#1e293b',
                              fontSize: '10px',
                              fontWeight: '700',
                              // Finished or withdrawn work must not read as
                              // still pending at a glance.
                              opacity: settled ? 0.55 : 1,
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

            {legendCategories.length > 1 && (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '8px 16px',
                  marginTop: '14px',
                  paddingTop: '12px',
                  borderTop: '1px solid #e2e8f0'
                }}
              >
                {legendCategories.map((category) => {
                  const tone = toneFor(category);
                  return (
                    <span
                      key={category}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '11.5px',
                        color: '#475569',
                        fontWeight: '600'
                      }}
                    >
                      <span
                        style={{
                          width: '10px',
                          height: '10px',
                          borderRadius: '3px',
                          background: tone.background,
                          border: `1px solid ${tone.border}`
                        }}
                      />
                      {category}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ---- Selected day panel: the ONE place scheduling happens ---- */}
        <div className="content-card">
          <div className="card-header">
            <h2 className="card-title">{selectedLabel}</h2>
            <span style={{ fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap' }}>
              {eventsForDate.length} scheduled
            </span>
          </div>

          <div style={{ padding: '20px' }}>
            {eventsForDate.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '8px 0 20px' }}>
                <CalendarIcon size={26} style={{ color: '#cbd5e1', marginBottom: '8px' }} />
                <div style={{ color: '#64748b', fontSize: '13px' }}>
                  Nothing scheduled.
                </div>
              </div>
            ) : (
              eventsForDate.map((event) => {
                const status = shownStatus(event);
                const tone = STATUS_TONES[status] || STATUS_TONES.Scheduled;
                return (
                  <div
                    key={event.id}
                    style={{
                      borderLeft: `3px solid ${toneFor(event.category).border}`,
                      padding: '0 0 16px 12px',
                      marginBottom: '16px'
                    }}
                  >
                    <div style={{ fontWeight: '800', color: '#0f172a', marginBottom: '7px' }}>
                      {event.title}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                      <CategoryPill category={event.category} />
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '3px 8px',
                          background: tone.background,
                          border: `1px solid ${tone.border}`,
                          borderRadius: '6px',
                          fontSize: '11.5px',
                          fontWeight: '600',
                          color: tone.color
                        }}
                      >
                        {status}
                      </span>
                    </div>
                    <div
                      style={{
                        display: 'grid',
                        gap: '7px',
                        marginTop: '12px',
                        color: '#475569',
                        fontSize: '12.5px'
                      }}
                    >
                      <span style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <Clock size={14} /> {event.time}
                      </span>
                      <span style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <MapPin size={14} /> {event.location}
                      </span>
                      <span style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <User size={14} /> {event.inCharge}
                      </span>
                    </div>

                    {canRemove && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setPendingRemove(event)}
                        style={{ marginTop: '12px' }}
                      >
                        <Trash2 size={14} />
                        Remove
                      </button>
                    )}
                  </div>
                );
              })
            )}

            {/* The single scheduling action. It replaces the duplicate
                "Schedule Maintenance" button that used to sit in the header. */}
            {!isReadOnly && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={openSchedule}
                style={{ width: '100%' }}
              >
                <Plus size={15} />
                {eventsForDate.length === 0 ? 'Schedule for this day' : 'Add another schedule'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ---- Schedule dialog ---- */}
      {!isReadOnly && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
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
                placeholder="e.g. Roof Drainage & Gutter Clearing"
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
                placeholder="e.g. CEA Roofdeck & CAS Hallway"
                value={form.location ?? ''}
                onChange={(e) => setField({ location: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="pm-incharge">
                Lead Technician in Charge
              </label>
              {/* Datalist rather than a select: the roster is only available to
                  administrators, so a select was a dead, empty control for
                  everyone else. This stays typeable either way. */}
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
                  <option key={t.id} value={t.name} />
                ))}
                <option value="PDAS Safety Committee" />
              </datalist>
            </div>

            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
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

      {/* ---- Remove confirmation ---- */}
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
    </div>
  );
};

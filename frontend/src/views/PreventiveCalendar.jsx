import React, { useMemo, useState } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Clock, MapPin, CheckCircle2 } from 'lucide-react';
import { useData } from '../context/DataContext';
import { Modal } from '../components/common/Modal';
import { CategoryPill } from '../components/common/StatusBadge';

export const PreventiveCalendar = ({ isReadOnly = false }) => {
  const { calendarEvents, addCalendarEvent, users } = useData();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [newEvent, setNewEvent] = useState({
    title: '',
    category: 'Electrical',
    date: '2026-09-15',
    time: '08:00 AM - 12:00 PM',
    location: 'CEA Building',
    inCharge: 'Mark Villanueva'
  });

  const technicians = users.filter(u => 
    u.role === 'Technician' || 
    u.role === 'Maintenance' || 
    u.userType === 'Maintenance' ||
    String(u.role || '').toLowerCase().includes('tech')
  );

  const monthLabel = visibleMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const monthDays = useMemo(() => {
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: firstDay + totalDays }, (_, index) => {
      if (index < firstDay) return null;
      return `${year}-${String(month + 1).padStart(2, '0')}-${String(index - firstDay + 1).padStart(2, '0')}`;
    });
  }, [visibleMonth]);

  const eventsForDate = calendarEvents.filter(event => event.date === selectedDate);
  const goToMonth = (offset) => {
    setVisibleMonth(current => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  };

  const selectDate = (date) => {
    setSelectedDate(date);
    setNewEvent(current => ({ ...current, date }));
  };

  const handleAddEvent = (e) => {
    e.preventDefault();
    addCalendarEvent(newEvent);
    setIsModalOpen(false);
    setNewEvent({
      title: '',
      category: 'Electrical',
      date: '2026-09-15',
      time: '08:00 AM - 12:00 PM',
      location: 'CEA Building',
      inCharge: 'Mark Villanueva'
    });
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Preventive Maintenance Calendar</h1>
          <p className="page-subtitle">
            {isReadOnly
              ? 'View scheduled campus inspections, equipment audits, and servicing'
              : 'Schedule recurring campus inspections, equipment audits, and servicing'}
          </p>
        </div>

        {!isReadOnly && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setIsModalOpen(true)}
          >
            <Plus size={16} />
            Schedule Maintenance
          </button>
        )}
      </div>

      {/* Calendar Grid & Selected Day */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(280px, 1fr)', gap: '24px', alignItems: 'start' }}>
        <div className="content-card">
          <div className="card-header" style={{ alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => goToMonth(-1)} aria-label="Previous month" title="Previous month">
                <ChevronLeft size={16} />
              </button>
              <h2 className="card-title" style={{ minWidth: '190px', textAlign: 'center' }}>{monthLabel}</h2>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => goToMonth(1)} aria-label="Next month" title="Next month">
                <ChevronRight size={16} />
              </button>
            </div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => { const today = new Date(); setVisibleMonth(today); selectDate(today.toISOString().slice(0, 10)); }}>
              Today
            </button>
          </div>
          <div style={{ padding: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', borderTop: '1px solid #e2e8f0', borderLeft: '1px solid #e2e8f0' }}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} style={{ padding: '9px 6px', textAlign: 'center', background: '#f8fafc', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase' }}>{day}</div>
              ))}
              {monthDays.map((date, index) => {
                const dayEvents = date ? calendarEvents.filter(event => event.date === date) : [];
                const dayNumber = date ? Number(date.slice(-2)) : '';
                const isSelected = date === selectedDate;
                const isToday = date === new Date().toISOString().slice(0, 10);
                return (
                  <button key={date || `empty-${index}`} type="button" disabled={!date} onClick={() => date && selectDate(date)} style={{ minHeight: '112px', padding: '8px', textAlign: 'left', background: isSelected ? '#eff6ff' : '#ffffff', border: 0, borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', cursor: date ? 'pointer' : 'default', opacity: date ? 1 : 0.5 }}>
                    {date && <>
                      <span style={{ display: 'inline-flex', width: '25px', height: '25px', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: isToday ? '#001f9c' : 'transparent', color: isToday ? '#ffffff' : '#334155', fontSize: '12px', fontWeight: '800' }}>{dayNumber}</span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '7px' }}>
                        {dayEvents.slice(0, 2).map(event => <span key={event.id} title={`${event.title} - ${event.time}`} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '4px 5px', borderRadius: '4px', background: event.category === 'Electrical' ? '#dbeafe' : event.category === 'Safety & Compliance' ? '#fef3c7' : '#dcfce7', color: '#1e293b', fontSize: '10px', fontWeight: '700' }}>{event.title}</span>)}
                        {dayEvents.length > 2 && <span style={{ color: '#64748b', fontSize: '10px', fontWeight: '700' }}>+{dayEvents.length - 2} more</span>}
                      </div>
                    </>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="content-card">
          <div className="card-header">
            <h2 className="card-title">{new Date(`${selectedDate}T00:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</h2>
          </div>
          <div style={{ padding: '20px' }}>
            {eventsForDate.length === 0 ? <div style={{ color: '#64748b', fontSize: '13px', padding: '16px 0' }}>No maintenance scheduled for this day.</div> : eventsForDate.map(event => (
              <div key={event.id} style={{ borderLeft: '3px solid #001f9c', padding: '0 0 16px 12px', marginBottom: '16px' }}>
                <div style={{ fontWeight: '800', color: '#0f172a', marginBottom: '7px' }}>{event.title}</div>
                <CategoryPill category={event.category} />
                <div style={{ display: 'grid', gap: '7px', marginTop: '12px', color: '#475569', fontSize: '12.5px' }}>
                  <span style={{ display: 'flex', gap: '6px', alignItems: 'center' }}><Clock size={14} />{event.time}</span>
                  <span style={{ display: 'flex', gap: '6px', alignItems: 'center' }}><MapPin size={14} />{event.location}</span>
                  <span style={{ display: 'flex', gap: '6px', alignItems: 'center' }}><CheckCircle2 size={14} />{event.inCharge}</span>
                </div>
              </div>
            ))}
            {!isReadOnly && (
              <button type="button" className="btn btn-primary" onClick={() => setIsModalOpen(true)}><Plus size={15} />Schedule this day</button>
            )}
          </div>
        </div>
      </div>

      {/* Add Schedule Modal — only for Admin & Maintenance */}
      {!isReadOnly && <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Schedule Campus Preventive Maintenance"
        maxWidth="560px"
      >
        <form onSubmit={handleAddEvent}>
          <div className="form-group">
            <label className="form-label">Maintenance Title *</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Roof Drainage & Gutter Clearing"
              value={newEvent.title}
              onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">Category *</label>
              <select
                className="form-select"
                value={newEvent.category}
                onChange={(e) => setNewEvent({ ...newEvent, category: e.target.value })}
              >
                <option value="Electrical">Electrical</option>
                <option value="Air Conditioning">Air Conditioning / HVAC</option>
                <option value="Mechanical">Mechanical</option>
                <option value="Water/Sanitary">Water / Sanitary & Plumbing</option>
                <option value="Physical Structures">Physical Structures / Carpentry</option>
                <option value="Drawing/Design">Drawing / Design</option>
                <option value="Safety & Compliance">Safety & Compliance</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Scheduled Date *</label>
              <input
                type="date"
                className="form-input"
                value={newEvent.date}
                onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">Time Window</label>
              <input
                type="text"
                className="form-input"
                placeholder="08:00 AM - 12:00 PM"
                value={newEvent.time}
                onChange={(e) => setNewEvent({ ...newEvent, time: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Location / Area *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. CEA Roofdeck & CAS Hallway"
                value={newEvent.location}
                onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Lead Technician in Charge</label>
            <select
              className="form-select"
              value={newEvent.inCharge}
              onChange={(e) => setNewEvent({ ...newEvent, inCharge: e.target.value })}
            >
              {technicians.map(t => (
                <option key={t.id} value={t.name}>{t.name} ({t.title})</option>
              ))}
              <option value="PDAS Safety Committee">PDAS Safety Committee</option>
            </select>
          </div>

          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
            >
              <CalendarIcon size={16} />
              Add to Calendar
            </button>
          </div>
        </form>
      </Modal>}
    </div>
  );
};

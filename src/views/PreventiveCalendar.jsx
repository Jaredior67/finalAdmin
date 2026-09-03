import React, { useState } from 'react';
import { Calendar as CalendarIcon, Plus, Clock, MapPin, User, CheckCircle2 } from 'lucide-react';
import { useData } from '../context/DataContext';
import { Modal } from '../components/common/Modal';
import { CategoryPill } from '../components/common/StatusBadge';

export const PreventiveCalendar = () => {
  const { calendarEvents, addCalendarEvent, users } = useData();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: '',
    category: 'Electrical',
    date: '2026-09-15',
    time: '08:00 AM - 12:00 PM',
    location: 'CEA Building',
    inCharge: 'Mark Villanueva'
  });

  const technicians = users.filter(u => u.role === 'Technician');

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
          <p className="page-subtitle">Schedule recurring campus inspections, equipment audits, and servicing</p>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setIsModalOpen(true)}
        >
          <Plus size={16} />
          Schedule Maintenance
        </button>
      </div>

      {/* Calendar Grid & Schedule List */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        {/* Scheduled Events List */}
        <div className="content-card">
          <div className="card-header">
            <h2 className="card-title">Scheduled Campus Maintenance Events (September 2026)</h2>
          </div>
          <div style={{ padding: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {calendarEvents.map((evt) => (
                <div
                  key={evt.id}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '16px 20px',
                    background: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    boxShadow: 'var(--shadow-subtle)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{
                      width: '54px',
                      height: '54px',
                      borderRadius: '12px',
                      background: '#eff6ff',
                      color: '#001f9c',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: '800'
                    }}>
                      <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#3b82f6' }}>SEP</span>
                      <span style={{ fontSize: '18px', lineHeight: 1 }}>{evt.date.split('-')[2] || '08'}</span>
                    </div>

                    <div>
                      <div style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', marginBottom: '4px' }}>
                        {evt.title}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '12.5px', color: '#64748b' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={13} />
                          {evt.time}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <MapPin size={13} />
                          {evt.location}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                    <CategoryPill category={evt.category} />
                    <span style={{ fontSize: '12px', color: '#475569', fontWeight: '500' }}>
                      In-Charge: {evt.inCharge}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Maintenance Protocol Guidelines */}
        <div className="content-card">
          <div className="card-header">
            <h2 className="card-title">PDAS Campus Protocols</h2>
          </div>
          <div style={{ padding: '20px', fontSize: '13px', color: '#475569', lineHeight: 1.6 }}>
            <div style={{ marginBottom: '14px', display: 'flex', gap: '10px' }}>
              <CheckCircle2 size={18} color="#059669" style={{ flexShrink: 0 }} />
              <div>
                <strong>Monthly Electrical Audit</strong><br />
                Load balance verification for computer laboratories and engineering workshops.
              </div>
            </div>
            <div style={{ marginBottom: '14px', display: 'flex', gap: '10px' }}>
              <CheckCircle2 size={18} color="#059669" style={{ flexShrink: 0 }} />
              <div>
                <strong>Quarterly HVAC Servicing</strong><br />
                High-pressure filter washing, amperage test, and refrigerant recharge.
              </div>
            </div>
            <div style={{ marginBottom: '14px', display: 'flex', gap: '10px' }}>
              <CheckCircle2 size={18} color="#059669" style={{ flexShrink: 0 }} />
              <div>
                <strong>Bi-weekly GenSet Run</strong><br />
                15-minute emergency generator load cycle every 1st and 3rd Tuesday.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add Schedule Modal */}
      <Modal
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
                <option value="HVAC / Aircon">HVAC / Aircon</option>
                <option value="Plumbing">Plumbing</option>
                <option value="Carpentry">Carpentry</option>
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
      </Modal>
    </div>
  );
};

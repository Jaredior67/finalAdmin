import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Save, Printer, X, FileText, Layers, Stamp, ArrowRight, ArrowLeft, ImagePlus, AlertCircle, AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';
import { FormField, TextInput, SelectInput } from '../ui/FormField';
import { JobRequestPrintSheet } from './JobRequestPrintSheet';
import { useData } from '../../context/DataContext';
import { JobRequestLocationStep, buildBuildingIndex, joinLocation } from './JobRequestLocationStep';
import { LimitedTextArea, DESCRIPTION_WORD_LIMIT } from './LimitedTextArea';
import { validateWordLimit } from '../../utils/wordLimit';
import { SCOPE_SECTIONS } from '../../utils/jobRequestIntake';
import { Spinner } from '../ui/Spinner';
import { useOptionalToast } from '../ui/Toast';
export { SCOPE_SECTIONS };

const blankScope = () => ({
  drawingDesign: { options: [], description: '', dateComplied: '' },
  physicalStructures: { options: [], description: '', dateComplied: '' },
  electrical: { options: [], description: '', dateComplied: '' },
  mechanical: { options: [], description: '', dateComplied: '' },
  waterSanitary: { options: [], description: '', dateComplied: '' },
  airConditioning: { options: [], description: '', dateComplied: '' },
});

// Large, easy-to-type controls (44px targets, 14.5px type).
const inputStyle = { width: '100%', minHeight: '44px', padding: '11px 13px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '14.5px', color: '#0f172a', background: '#ffffff' };
const labelStyle = { fontSize: '12px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px', display: 'block' };
const sectionBox = { border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', background: '#ffffff' };
const sectionTitle = { fontSize: '14px', fontWeight: '800', color: '#0f172a', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' };
const checkStyle = { accentColor: '#001f9c', width: '17px', height: '17px', cursor: 'pointer', flexShrink: 0 };

/* "Date of Request" on the official form, as a local calendar day.
   toISOString() is UTC: for the eight hours after midnight at UTC+8 it returns
   yesterday, which would print the wrong date on a signed government form. */
function localTodayISO() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// Split the composed "Building — Floor — Room" string back into parts so an
// existing ticket reopens with its dropdowns populated.
function splitLocation(src = {}, locs = []) {
  const raw = String(src.location || '').trim();
  const parts = raw.split(/\s+[—–-]\s+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 3) {
    return { building: parts[0], floor: parts[1], room: parts.slice(2).join(' — ') };
  }
  // Fall back to matching the composed value against the registry.
  const hit = (locs || []).find((l) => l.room && raw.includes(l.room));
  if (hit) return { building: hit.building, floor: hit.floor, room: hit.room };
  return { building: '', floor: '', room: '', location: raw };
}

function buildState(src = {}, locs = []) {
  const loc = (src.building && src.room)
    ? { building: src.building, floor: src.floor || '', room: src.room, location: src.location || '' }
    : splitLocation(src, locs);
  return {
    date: src.date || localTodayISO(),
    requestedBy: src.requestedBy || src.clientName || '',
    office: src.department || src.office || src.officeOfClient || '',
    building: src.building || loc.building || '',
    floor: src.floor || loc.floor || '',
    room: src.room || loc.room || '',
    location: src.location || loc.location || '',
    // Preserved so a re-print or an edit does not lose the tag the request was
    // filed from, or the campus_locations row it resolved to.
    qrCodeRef: src.qrCodeRef || '',
    locationId: /^\d+$/.test(String(src.locationId ?? '')) ? Number(src.locationId) : null,
    immediateSupervisor: src.immediateSupervisor || '',
    contactNumber: src.contactNumber || '',
    title: src.title || '',
    category: src.category || 'Electrical',
    urgency: src.urgency || 'Medium Risk',
    description: src.description || '',
    scopeOfWorks: { ...blankScope(), ...(src.scopeOfWorks || {}) },
    actionTaken: {
      endorsedDesignTeam: { checked: false, detailedPlan: false, powBoq: false, receivedBy: '', date: '', ...(src.actionTaken?.endorsedDesignTeam || {}) },
      endorsedGSMHead: { checked: false, receivedBy: '', date: '', ...(src.actionTaken?.endorsedGSMHead || {}) },
      returnedToClient: { checked: false, reason: '', receivedBy: '', date: '', remarks: '', ...(src.actionTaken?.returnedToClient || {}) },
    },
    finalAction: { status: 'Pending', remarks: '', ...(src.finalAction || {}) },
  };
}

export const JobRequestFormOverlay = ({
  isOpen,
  onClose,
  initialReq = {},
  onSave,
  onSaveAndPrint,
  title = 'Standard Job Request Form (QF-PDAS-DC-01) — Edit Before Print',
  allowActionTaken = true,
  allowFinalAction = false,
}) => {
  const { campusLocations } = useData();
  const toastCtx = useOptionalToast();
  const toast = toastCtx?.toast;
  const [form, setForm] = useState(() => buildState(initialReq, campusLocations));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const saveLock = useRef(false);
  const [photoPreview, setPhotoPreview] = useState(initialReq?.photoUrl || null);
  const [photoName, setPhotoName] = useState(initialReq?.photoName || '');
  // Two-step flow: fill every field first (full width), then review the
  // official document before filing.
  const [view, setView] = useState('form');
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const [pendingPrintAfter, setPendingPrintAfter] = useState(false);
  const buildingIndex = useMemo(
    () => buildBuildingIndex(campusLocations || []),
    [campusLocations]
  );

  useEffect(() => {
    if (isOpen) {
      setForm(buildState(initialReq, campusLocations));
      setErrors({});
      setSaving(false);
      saveLock.current = false;
      setPhotoPreview(initialReq?.photoUrl || null);
      setPhotoName(initialReq?.photoName || '');
      setView('form');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const set = (patch) => {
    setForm(prev => ({ ...prev, ...patch }));
    setErrors(prev => {
      const next = { ...prev };
      Object.keys(patch).forEach(k => { delete next[k]; });
      if (patch.title || patch.description) delete next.details;
      return next;
    });
  };

  const toggleScopeOption = (sectionKey, opt) => {
    setForm(prev => {
      const sec = prev.scopeOfWorks[sectionKey] || { options: [], description: '', dateComplied: '' };
      const has = (sec.options || []).includes(opt);
      return {
        ...prev,
        scopeOfWorks: {
          ...prev.scopeOfWorks,
          [sectionKey]: { ...sec, options: has ? sec.options.filter(o => o !== opt) : [...(sec.options || []), opt] },
        },
      };
    });
  };

  const setScopeField = (sectionKey, field, value) => {
    setForm(prev => ({
      ...prev,
      scopeOfWorks: { ...prev.scopeOfWorks, [sectionKey]: { ...prev.scopeOfWorks[sectionKey], [field]: value } },
    }));
  };

  // The canonical location string is derived from the three dropdowns unless
  // the requester typed their own. Either way it is never empty once the
  // location step is satisfied.
  const resolvedLocation = () =>
    form.location.trim() || joinLocation(form.building, form.floor, form.room);

  const missingRequired = () => {
    const next = {};
    if (!form.building && !form.location.trim()) {
      next.location = 'Choose a location first — pick it from the lists or type it below.';
    }
    if (!form.requestedBy.trim()) next.requestedBy = 'Enter the name of the person requesting.';
    if (!form.office.trim()) next.office = 'Enter the office of the person requesting.';
    if (!form.date) next.date = 'Date of Request is required.';
    if (!form.title.trim() && !form.description.trim()) next.details = 'Add a title or a description.';
    // Word cap — the same limit the API enforces.
    const overLimit = validateWordLimit(form.description, DESCRIPTION_WORD_LIMIT, 'The description');
    if (overLimit) next.description = overLimit;
    setErrors(next);
    return Object.keys(next).length > 0;
  };

  const handlePhotoSelect = (file) => {
    if (!file) return;
    setErrors(prev => {
      const next = { ...prev };
      delete next.photo;
      return next;
    });
    if (!file.type.startsWith('image/')) {
      setErrors(prev => ({ ...prev, photo: 'Only image files (JPG, PNG) are accepted.' }));
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setErrors(prev => ({ ...prev, photo: 'Photo must be 8 MB or smaller.' }));
      return;
    }
    setPhotoName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        try {
          const maxDim = 1024;
          const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          setPhotoPreview(canvas.toDataURL('image/jpeg', 0.7));
        } catch {
          setPhotoPreview(reader.result);
        }
      };
      img.onerror = () => setPhotoPreview(reader.result);
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  // Step 1 → Step 2: only show the document once the fields are filed in.
  const handleReview = () => {
    if (missingRequired()) return;
    setView('review');
  };

  const promptSubmitApproval = (printAfter = false) => {
    if (missingRequired()) {
      setView('form');
      return;
    }
    setPendingPrintAfter(printAfter);
    setShowConfirmSubmit(true);
  };

  const handleSave = (printAfter = false, isDraft = false) => {
    // Double-submit guard: ignore rapid repeat clicks while a save is in flight.
    if (saveLock.current) return;
    const payload = {
      date: form.date,
      requestedBy: form.requestedBy.trim(),
      department: form.office.trim(),
      location: resolvedLocation(),
      building: form.building,
      floor: form.floor,
      room: form.room,
      qrCodeRef: form.qrCodeRef || '',
      locationId: form.locationId ?? null,
      immediateSupervisor: form.immediateSupervisor.trim(),
      contactNumber: form.contactNumber.trim(),
      title: form.title.trim() || `${form.category} service request`,
      category: form.category,
      urgency: form.urgency,
      description: form.description.trim() || form.title.trim(),
      scopeOfWorks: form.scopeOfWorks,
      actionTaken: form.actionTaken,
      finalAction: form.finalAction,
      photoUrl: photoPreview || '',
      photoName: photoName || '',
      isDraft,
      requesterApproved: !isDraft,
      requesterApprovedAt: isDraft ? null : new Date().toISOString()
    };
    if (!isDraft && (!payload.requestedBy || !payload.department)) {
      const next = {};
      if (!payload.requestedBy) next.requestedBy = 'Enter the name of the person requesting.';
      if (!payload.department) next.office = 'Enter the office of the person requesting.';
      setErrors(next);
      setView('form');
      return;
    }
    saveLock.current = true;
    setSaving(true);
    try {
      if (printAfter && onSaveAndPrint) onSaveAndPrint(payload);
      else if (onSave) onSave(payload);

      if (toast) {
        if (isDraft) toast('Job request saved as draft.', 'info');
        else toast('Job request submitted and electronically approved!', 'success');
      }
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  };

  const trackingLabel = initialReq?.controlNo
    ? initialReq.controlNo
    : 'PENDING, issued when the work order is assigned';

  // Official document, generated from the filed-in fields for Step 2 review.
  const previewReq = {
    controlNo: initialReq?.controlNo || null,
    date: form.date,
    requestedBy: form.requestedBy || '—',
    department: form.office,
    office: form.office,
    location: resolvedLocation(),
    immediateSupervisor: form.immediateSupervisor,
    contactNumber: form.contactNumber,
    title: form.title || `${form.category} service request`,
    category: form.category,
    description: form.description,
    scopeOfWorks: form.scopeOfWorks,
    actionTaken: form.actionTaken,
    finalAction: form.finalAction,
  };

  return (
    <>
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="1240px"
      footer={
        view === 'form' ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <span style={{ fontSize: '13px', color: '#64748b' }}>Step 1 of 2 · Tracking: <strong>{trackingLabel}</strong></span>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-secondary" style={{ padding: '10px 18px', fontSize: '14px' }} onClick={onClose} disabled={saving}><X size={16} /> Cancel</button>
              <button type="button" className="btn btn-secondary" style={{ padding: '10px 18px', fontSize: '14px' }} onClick={() => handleSave(false, true)} disabled={saving}>{saving ? <Spinner size={15} color="#475569" /> : <Save size={16} />} {saving ? 'Saving…' : 'Save as Draft'}</button>
              <button type="button" className="btn btn-primary" style={{ padding: '10px 22px', fontSize: '14.5px', fontWeight: '800' }} onClick={handleReview} disabled={saving}>Review Official Document <ArrowRight size={16} /></button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <span style={{ fontSize: '13px', color: '#64748b' }}>Step 2 of 2 · Tracking: <strong>{trackingLabel}</strong></span>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-secondary" style={{ padding: '10px 18px', fontSize: '14px' }} onClick={() => setView('form')} disabled={saving}><ArrowLeft size={16} /> Back to the form</button>
              <button type="button" className="btn btn-secondary" style={{ padding: '10px 18px', fontSize: '14px' }} onClick={() => handleSave(false, true)} disabled={saving}>{saving ? <Spinner size={15} color="#475569" /> : <Save size={16} />} Save as Draft</button>
              <button type="button" className="btn btn-primary" style={{ padding: '10px 22px', fontSize: '14.5px', fontWeight: '800' }} onClick={() => promptSubmitApproval(false)} disabled={saving}>{saving ? <Spinner size={15} color="#ffffff" /> : <Stamp size={16} />} {saving ? 'Submitting…' : 'Submit and approve'}</button>
              <button type="button" className="btn btn-secondary" style={{ padding: '10px 18px', fontSize: '14px' }} onClick={() => promptSubmitApproval(true)} disabled={saving}>{saving ? <Spinner size={15} color="#475569" /> : <Printer size={16} />} Submit & Print</button>
            </div>
          </div>
        )
      }
    >
      {view === 'form' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {Object.keys(errors).length > 0 && (
            <div role="alert" style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px 14px' }}>
              <AlertCircle size={18} color="#dc2626" style={{ flexShrink: 0, marginTop: '1px' }} />
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: '700', color: '#991b1b', marginBottom: '4px' }}>Please fix the following before continuing:</div>
                <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: '#b91c1c', lineHeight: 1.5 }}>
                  {Object.values(errors).map((msg, i) => <li key={i}>{msg}</li>)}
                </ul>
              </div>
            </div>
          )}
          {/* Section 1: LOCATION — the first step of the flow. */}
          <div style={{ ...sectionBox, borderColor: '#bfdbfe', background: '#f8faff' }}>
            <JobRequestLocationStep
              buildingIndex={buildingIndex}
              value={{ building: form.building, floor: form.floor, room: form.room, location: form.location }}
              onChange={(patch) => set(patch)}
              error={errors.location}
              disabled={saving}
            />
          </div>

          {/* Section 2: requester & document details — big, easy-to-type fields */}
          <div style={{ ...sectionBox, background: 'var(--bg-sunken)' }}>
            <div style={sectionTitle}><FileText size={17} color="#001f9c" /> 2 · Requester &amp; Document Details</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
              <FormField label="Tracking Number (auto)" htmlFor="jr-tracking" style={{ marginBottom: 0 }}>
                <TextInput id="jr-tracking" value={trackingLabel} disabled style={{ background: 'var(--bg-muted)', color: '#64748b' }} />
              </FormField>
              <FormField label="Date of Request" required htmlFor="jr-date" error={errors.date} style={{ marginBottom: 0 }}>
                <TextInput id="jr-date" type="date" value={form.date} onChange={e => set({ date: e.target.value })} />
              </FormField>
              <FormField label="Name of Client" required htmlFor="jr-client" error={errors.requestedBy} style={{ marginBottom: 0 }}>
                <TextInput id="jr-client" value={form.requestedBy} onChange={e => set({ requestedBy: e.target.value })} placeholder="e.g. Juan D. Cruz" />
              </FormField>
              <FormField label="Office of Client" required htmlFor="jr-office" error={errors.office} style={{ marginBottom: 0 }}>
                <TextInput id="jr-office" value={form.office} onChange={e => set({ office: e.target.value })} placeholder="e.g. Office of the Campus Administrator" />
              </FormField>
              <FormField label="Immediate Supervisor" htmlFor="jr-supervisor" style={{ marginBottom: 0 }}>
                <TextInput id="jr-supervisor" value={form.immediateSupervisor} onChange={e => set({ immediateSupervisor: e.target.value })} placeholder="Supervisor name" />
              </FormField>
              <FormField label="Contact Number" htmlFor="jr-contact" style={{ marginBottom: 0 }}>
                <TextInput id="jr-contact" value={form.contactNumber} onChange={e => set({ contactNumber: e.target.value })} placeholder="+63 ..." />
              </FormField>
              <FormField label="Main Category" htmlFor="jr-category" style={{ marginBottom: 0 }}>
                <SelectInput id="jr-category" value={form.category} onChange={e => set({ category: e.target.value })}>
                  {['Drawing/Design', 'Physical Structures', 'Electrical', 'Mechanical', 'Water/Sanitary', 'Air Conditioning'].map(c => <option key={c} value={c}>{c}</option>)}
                </SelectInput>
              </FormField>
              <FormField label="Urgency Level" htmlFor="jr-urgency" style={{ marginBottom: 0 }}>
                <SelectInput id="jr-urgency" value={form.urgency || 'Medium Risk'} onChange={e => set({ urgency: e.target.value })}>
                  {['Low Risk', 'Medium Risk', 'High Risk'].map(u => <option key={u} value={u}>{u}</option>)}
                </SelectInput>
              </FormField>
            </div>
            <div style={{ marginTop: '12px' }}>
              <FormField label="Request Title / Subject" required htmlFor="jr-title" style={{ marginBottom: 0 }}>
                <TextInput id="jr-title" value={form.title} onChange={e => set({ title: e.target.value })} placeholder="Short subject of the job request" />
              </FormField>
            </div>
            <div style={{ marginTop: '12px' }}>
              <LimitedTextArea
                id="jr-description"
                label="Overall Description"
                required
                rows={3}
                value={form.description}
                onChange={(v) => set({ description: v })}
                error={errors.details || errors.description}
                placeholder="Describe the repair / maintenance / construction needed..."
              />
            </div>
            <div style={{ marginTop: '12px' }}>
              <FormField
                label="Defect Photo (optional)"
                htmlFor="jr-photo"
                hint="JPG or PNG, up to 8 MB."
                error={errors.photo}
                style={{ marginBottom: 0 }}
              >
                <TextInput
                  id="jr-photo"
                  type="file"
                  accept="image/*"
                  onChange={e => handlePhotoSelect(e.target.files && e.target.files[0])}
                  style={{ padding: '9px 13px', cursor: 'pointer' }}
                />
              </FormField>
              {photoPreview && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '10px', background: 'var(--bg-sunken)', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px' }}>
                  <img src={photoPreview} alt="Defect preview" style={{ width: '72px', height: '72px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{photoName || 'Attached photo'}</div>
                    <div style={{ fontSize: '12px', color: '#059669' }}>Photo attached — it will be filed with this request.</div>
                  </div>
                  <button type="button" onClick={() => { setPhotoPreview(null); setPhotoName(''); }} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 10px', borderRadius: '8px', border: '1px solid #fecaca', background: '#ffffff', color: '#b91c1c', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                    <X size={13} /> Remove
                  </button>
                </div>
              )}
              {!photoPreview && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px', color: '#94a3b8', fontSize: '12.5px' }}>
                  <ImagePlus size={16} /> No photo attached yet.
                </div>
              )}
            </div>
          </div>

          {/* Section 2: scope sections */}
          <div style={sectionBox}>
            <div style={sectionTitle}><Layers size={17} color="#001f9c" /> 3 · Areas / Scope of Works</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '12px' }}>
              {SCOPE_SECTIONS.map(sec => {
                const data = form.scopeOfWorks[sec.key] || { options: [], description: '', dateComplied: '' };
                return (
                  <div key={sec.key} style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', background: 'var(--bg-sunken)' }}>
                    <div style={{ fontSize: '13.5px', fontWeight: '800', color: '#001f9c', marginBottom: '8px' }}>{sec.label}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '14px', marginBottom: '10px' }}>
                      {sec.options.map(opt => (
                        <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#1e293b', fontWeight: '500' }}>
                          <input type="checkbox" checked={(data.options || []).includes(opt)} onChange={() => toggleScopeOption(sec.key, opt)} style={checkStyle} /> {opt}
                        </label>
                      ))}
                    </div>
                    <label style={labelStyle}>Description of Work</label>
                    <textarea value={data.description || ''} onChange={e => setScopeField(sec.key, 'description', e.target.value)} rows={2} placeholder="Details for this area..." style={{ ...inputStyle, marginBottom: '10px', resize: 'vertical', lineHeight: 1.6 }} />
                    <label style={labelStyle}>Date Complied</label>
                    <input type="date" value={data.dateComplied ?? ''} onChange={e => setScopeField(sec.key, 'dateComplied', e.target.value)} style={inputStyle} />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action Taken */}
          {allowActionTaken && (
            <div style={sectionBox}>
              <div style={sectionTitle}><Stamp size={17} color="#001f9c" /> 4 · Action Taken (PDAS)</div>
              <label style={{ display: 'flex', gap: '10px', fontSize: '14.5px', fontWeight: '700', marginBottom: '8px', cursor: 'pointer', alignItems: 'center' }}>
                <input type="checkbox" checked={form.actionTaken.endorsedDesignTeam.checked} onChange={e => setForm(p => ({ ...p, actionTaken: { ...p.actionTaken, endorsedDesignTeam: { ...p.actionTaken.endorsedDesignTeam, checked: e.target.checked } } }))} style={checkStyle} />
                Endorsed to Design Team
              </label>
              {form.actionTaken.endorsedDesignTeam.checked && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', marginBottom: '12px', marginLeft: '27px' }}>
                  <label style={{ fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}><input type="checkbox" checked={form.actionTaken.endorsedDesignTeam.detailedPlan} onChange={e => setForm(p => ({ ...p, actionTaken: { ...p.actionTaken, endorsedDesignTeam: { ...p.actionTaken.endorsedDesignTeam, detailedPlan: e.target.checked } } }))} style={checkStyle} /> Detailed Plan</label>
                  <label style={{ fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}><input type="checkbox" checked={form.actionTaken.endorsedDesignTeam.powBoq} onChange={e => setForm(p => ({ ...p, actionTaken: { ...p.actionTaken, endorsedDesignTeam: { ...p.actionTaken.endorsedDesignTeam, powBoq: e.target.checked } } }))} style={checkStyle} /> POW & BOQ</label>
                  <input placeholder="Received by" value={form.actionTaken.endorsedDesignTeam.receivedBy ?? ''} onChange={e => setForm(p => ({ ...p, actionTaken: { ...p.actionTaken, endorsedDesignTeam: { ...p.actionTaken.endorsedDesignTeam, receivedBy: e.target.value } } }))} style={inputStyle} />
                  <input type="date" value={form.actionTaken.endorsedDesignTeam.date ?? ''} onChange={e => setForm(p => ({ ...p, actionTaken: { ...p.actionTaken, endorsedDesignTeam: { ...p.actionTaken.endorsedDesignTeam, date: e.target.value } } }))} style={inputStyle} />
                </div>
              )}
              <label style={{ display: 'flex', gap: '10px', fontSize: '14.5px', fontWeight: '700', marginBottom: '8px', cursor: 'pointer', alignItems: 'center' }}>
                <input type="checkbox" checked={form.actionTaken.endorsedGSMHead.checked} onChange={e => setForm(p => ({ ...p, actionTaken: { ...p.actionTaken, endorsedGSMHead: { ...p.actionTaken.endorsedGSMHead, checked: e.target.checked } } }))} style={checkStyle} />
                Endorsed to GSM Head for Work Order
              </label>
              {form.actionTaken.endorsedGSMHead.checked && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px', marginLeft: '27px' }}>
                  <input placeholder="Received by" value={form.actionTaken.endorsedGSMHead.receivedBy ?? ''} onChange={e => setForm(p => ({ ...p, actionTaken: { ...p.actionTaken, endorsedGSMHead: { ...p.actionTaken.endorsedGSMHead, receivedBy: e.target.value } } }))} style={inputStyle} />
                  <input type="date" value={form.actionTaken.endorsedGSMHead.date ?? ''} onChange={e => setForm(p => ({ ...p, actionTaken: { ...p.actionTaken, endorsedGSMHead: { ...p.actionTaken.endorsedGSMHead, date: e.target.value } } }))} style={inputStyle} />
                </div>
              )}
              <label style={{ display: 'flex', gap: '10px', fontSize: '14.5px', fontWeight: '700', marginBottom: '8px', cursor: 'pointer', alignItems: 'center' }}>
                <input type="checkbox" checked={form.actionTaken.returnedToClient.checked} onChange={e => setForm(p => ({ ...p, actionTaken: { ...p.actionTaken, returnedToClient: { ...p.actionTaken.returnedToClient, checked: e.target.checked } } }))} style={checkStyle} />
                Returned to Client
              </label>
              {form.actionTaken.returnedToClient.checked && (
                <div style={{ display: 'grid', gap: '10px', marginLeft: '27px' }}>
                  <input placeholder="Reason" value={form.actionTaken.returnedToClient.reason ?? ''} onChange={e => setForm(p => ({ ...p, actionTaken: { ...p.actionTaken, returnedToClient: { ...p.actionTaken.returnedToClient, reason: e.target.value } } }))} style={inputStyle} />
                  <input placeholder="Remarks" value={form.actionTaken.returnedToClient.remarks ?? ''} onChange={e => setForm(p => ({ ...p, actionTaken: { ...p.actionTaken, returnedToClient: { ...p.actionTaken.returnedToClient, remarks: e.target.value } } }))} style={inputStyle} />
                </div>
              )}
            </div>
          )}

          {/* Final Action */}
          <div style={{ ...sectionBox, background: allowFinalAction ? '#eff6ff' : 'var(--bg-sunken)' }}>
            <div style={sectionTitle}>5 · Final Action (Approver){allowFinalAction ? '' : ' — read-only here'}</div>
            <div style={{ display: 'flex', gap: '20px', marginBottom: '10px', fontSize: '14.5px', fontWeight: '700', flexWrap: 'wrap' }}>
              {['Pending', 'Approved', 'Disapproved'].map(s => (
                <label key={s} style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: allowFinalAction ? 1 : 0.6, cursor: allowFinalAction ? 'pointer' : 'default' }}>
                  <input type="radio" name="finalStatus" checked={form.finalAction.status === s} disabled={!allowFinalAction} onChange={() => setForm(p => ({ ...p, finalAction: { ...p.finalAction, status: s } }))} style={checkStyle} /> {s}
                </label>
              ))}
            </div>
            <label style={labelStyle}>Remarks</label>
            <textarea value={form.finalAction.remarks ?? ''} disabled={!allowFinalAction} onChange={e => setForm(p => ({ ...p, finalAction: { ...p.finalAction, remarks: e.target.value } }))} rows={2} style={{ ...inputStyle, background: allowFinalAction ? '#fff' : 'var(--bg-hover)' }} />
            {!allowFinalAction && <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '6px' }}>The tracking number is issued when the System Administrator assigns the work order, after this final approval — not when it is approved here.</div>}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '12px 16px' }}>
            <span style={{ fontSize: '13.5px', fontWeight: '700', color: '#1e3a8a' }}>
              QF-PDAS-DC-01 Preview
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: '700', color: '#001f9c', background: '#ffffff', border: '1px solid #bfdbfe', borderRadius: '9999px', padding: '3px 10px' }}>
              {photoPreview && <img src={photoPreview} alt="Defect" style={{ width: '22px', height: '22px', objectFit: 'cover', borderRadius: '50%' }} />}
              {previewReq.title || 'Untitled request'}
            </span>
          </div>
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px', maxHeight: '68vh', overflow: 'auto' }}>
            <div style={{ maxWidth: '800px', margin: '0 auto' }}>
              <JobRequestPrintSheet req={previewReq} />
            </div>
          </div>
        </div>
      )}
    </Modal>

    {/* Step 3 — Requester electronic approval confirmation dialog */}
    {showConfirmSubmit && (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-submit-title"
        style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(15,23,42,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '16px'
        }}
      >
        <div style={{
          background: '#ffffff', borderRadius: '16px', padding: '32px',
          maxWidth: '480px', width: '100%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          animation: 'scaleIn 0.15s ease'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{
              width: '44px', height: '44px', borderRadius: '12px',
              background: '#eff6ff', color: '#001f9c',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}>
              <AlertTriangle size={22} />
            </div>
            <div>
              <div id="confirm-submit-title" style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
                Submit &amp; Approve Request?
              </div>
              <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
                This is your electronic approval stamp as the requester.
              </div>
            </div>
          </div>
          <div style={{
            background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px',
            padding: '14px 16px', marginBottom: '20px', fontSize: '13px', color: '#1e3a8a', lineHeight: 1.6
          }}>
            <strong>Are you sure you want to submit and approve this request?</strong><br />
            By clicking <em>Submit &amp; Approve</em>, your name and timestamp will be electronically stamped
            on the QF-PDAS-DC-01 form and the request will be routed to your Immediate Supervisor for review.
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '10px 18px', fontSize: '14px' }}
              onClick={() => {
                setShowConfirmSubmit(false);
                handleSave(false, true);
              }}
            >
              <Save size={15} /> No, Save as Draft
            </button>
            <button
              type="button"
              className="btn btn-primary"
              style={{ padding: '10px 22px', fontSize: '14.5px', fontWeight: '800', background: '#001f9c' }}
              onClick={() => {
                setShowConfirmSubmit(false);
                handleSave(pendingPrintAfter, false);
              }}
            >
              <Stamp size={15} /> Yes, Submit &amp; Approve
            </button>
          </div>
        </div>
      </div>
    )}
  </>
  );
};

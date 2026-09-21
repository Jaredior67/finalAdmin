import React, { useState, useEffect } from 'react';
import { Save, Printer, X, FileText, Layers, Stamp, ArrowRight, ArrowLeft, ImagePlus, AlertCircle } from 'lucide-react';
import { Modal } from './Modal';
import { FormField, TextInput, TextArea, SelectInput } from '../ui/FormField';
import { JobRequestPrintSheet } from './JobRequestPrintSheet';

export const SCOPE_SECTIONS = [
  { key: 'drawingDesign', label: '1. DRAWING / DESIGN', options: ['Floor Plans', 'Detailed Drawings', 'Perspective', 'Specifications', 'List of Materials', 'Other Services'] },
  { key: 'physicalStructures', label: '2. PHYSICAL STRUCTURES', options: ['New Structure', 'Rehabilitation/Repair', 'Renovation', 'Partial', 'Full', 'Other Services'] },
  { key: 'electrical', label: '3. ELECTRICAL', options: ['New Installation', 'Repair', 'Rehabilitation', 'Other Services'] },
  { key: 'mechanical', label: '4. MECHANICAL', options: ['New Installation', 'Repair', 'Rehabilitation', 'Other Services'] },
  { key: 'waterSanitary', label: '5. WATER / SANITARY', options: ['New Installation', 'Repair', 'Rehabilitation', 'Other Services'] },
  { key: 'airConditioning', label: '6. AIR CONDITIONING', options: ['New Installation', 'Repair', 'Rehabilitation', 'Other Services'] },
];

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
  const [form, setForm] = useState(() => buildState(initialReq));
  const [errors, setErrors] = useState({});
  const [photoPreview, setPhotoPreview] = useState(initialReq?.photoUrl || null);
  const [photoName, setPhotoName] = useState(initialReq?.photoName || '');
  // Two-step flow: fill every field first (full width), then review the
  // official document before filing.
  const [view, setView] = useState('form');

  function buildState(src = {}) {
    return {
      date: src.date || new Date().toISOString().split('T')[0],
      requestedBy: src.requestedBy || src.clientName || '',
      office: src.department || src.office || src.officeOfClient || '',
      location: src.location || '',
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

  useEffect(() => {
    if (isOpen) {
      setForm(buildState(initialReq));
      setErrors({});
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

  const missingRequired = () => {
    const next = {};
    if (!form.requestedBy.trim()) next.requestedBy = 'Name of Client is required.';
    if (!form.office.trim()) next.office = 'Office of Client is required.';
    if (!form.date) next.date = 'Date of Request is required.';
    if (!form.location.trim()) next.location = 'Location / Room is required so technicians can find the issue.';
    if (!form.title.trim() && !form.description.trim()) next.details = 'Add a request title or a description before reviewing the document.';
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

  const handleSave = (printAfter = false) => {
    const payload = {
      date: form.date,
      requestedBy: form.requestedBy.trim(),
      department: form.office.trim(),
      location: form.location.trim(),
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
    };
    if (!payload.requestedBy || !payload.department) {
      const next = {};
      if (!payload.requestedBy) next.requestedBy = 'Name of Client is required.';
      if (!payload.department) next.office = 'Office of Client is required.';
      setErrors(next);
      setView('form');
      return;
    }
    if (printAfter && onSaveAndPrint) onSaveAndPrint(payload);
    else if (onSave) onSave(payload);
  };

  const trackingLabel = initialReq?.controlNo
    ? initialReq.controlNo
    : 'PENDING — issued on Final Approval';

  // Official document, generated from the filed-in fields for Step 2 review.
  const previewReq = {
    controlNo: initialReq?.controlNo || null,
    date: form.date,
    requestedBy: form.requestedBy || '—',
    department: form.office,
    office: form.office,
    location: form.location,
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
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="1240px"
      footer={
        view === 'form' ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <span style={{ fontSize: '13px', color: '#64748b' }}>Step 1 of 2 — Fill in every field, then review the official document. Tracking: <strong>{trackingLabel}</strong></span>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-secondary" style={{ padding: '10px 18px', fontSize: '14px' }} onClick={onClose}><X size={16} /> Cancel</button>
              <button type="button" className="btn btn-primary" style={{ padding: '10px 22px', fontSize: '14.5px', fontWeight: '800' }} onClick={handleReview}>Review Official Document <ArrowRight size={16} /></button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <span style={{ fontSize: '13px', color: '#64748b' }}>Step 2 of 2 — Check every detail on the official sheet below. Tracking: <strong>{trackingLabel}</strong></span>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-secondary" style={{ padding: '10px 18px', fontSize: '14px' }} onClick={() => setView('form')}><ArrowLeft size={16} /> Back to Edit</button>
              <button type="button" className="btn btn-secondary" style={{ padding: '10px 18px', fontSize: '14px' }} onClick={() => handleSave(false)}><Save size={16} /> Save Changes</button>
              <button type="button" className="btn btn-primary" style={{ padding: '10px 18px', fontSize: '14px' }} onClick={() => handleSave(true)}><Printer size={16} /> Save & Print</button>
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
          {/* Section 1: requester & document details — big, easy-to-type fields */}
          <div style={{ ...sectionBox, background: '#f8fafc' }}>
            <div style={sectionTitle}><FileText size={17} color="#001f9c" /> 1 · Requester & Document Details</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
              <FormField label="Tracking Number (auto)" htmlFor="jr-tracking" style={{ marginBottom: 0 }}>
                <TextInput id="jr-tracking" value={trackingLabel} disabled style={{ background: '#f1f5f9', color: '#64748b' }} />
              </FormField>
              <FormField label="Date of Request" required htmlFor="jr-date" error={errors.date} style={{ marginBottom: 0 }}>
                <TextInput id="jr-date" type="date" value={form.date} onChange={e => set({ date: e.target.value })} />
              </FormField>
              <FormField label="Name of Client" required htmlFor="jr-client" error={errors.requestedBy} style={{ marginBottom: 0 }}>
                <TextInput id="jr-client" value={form.requestedBy} onChange={e => set({ requestedBy: e.target.value })} placeholder="e.g. Juan D. Cruz" />
              </FormField>
              <FormField label="Office of Client" required htmlFor="jr-office" error={errors.office} style={{ marginBottom: 0 }}>
                <TextInput id="jr-office" value={form.office} onChange={e => set({ office: e.target.value })} placeholder="e.g. College of Engineering" />
              </FormField>
              <FormField label="Location / Room" required htmlFor="jr-location" error={errors.location} style={{ marginBottom: 0 }}>
                <TextInput id="jr-location" value={form.location} onChange={e => set({ location: e.target.value })} placeholder="e.g. CEA Building - Room 302" />
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
            </div>
            <div style={{ marginTop: '12px' }}>
              <FormField label="Request Title / Subject" required htmlFor="jr-title" style={{ marginBottom: 0 }}>
                <TextInput id="jr-title" value={form.title} onChange={e => set({ title: e.target.value })} placeholder="Short subject of the job request" />
              </FormField>
            </div>
            <div style={{ marginTop: '12px' }}>
              <FormField label="Overall Description" required htmlFor="jr-description" error={errors.details} style={{ marginBottom: 0 }}>
                <TextArea id="jr-description" value={form.description} onChange={e => set({ description: e.target.value })} rows={3} placeholder="Describe the repair / maintenance / construction needed..." style={{ resize: 'vertical', lineHeight: 1.6 }} />
              </FormField>
            </div>
            <div style={{ marginTop: '12px' }}>
              <FormField
                label="Defect Photo (optional)"
                htmlFor="jr-photo"
                hint="JPG or PNG up to 8 MB. A clear photo helps technicians assess the issue."
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px' }}>
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
            <div style={sectionTitle}><Layers size={17} color="#001f9c" /> 2 · Areas / Scope of Works</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '12px' }}>
              {SCOPE_SECTIONS.map(sec => {
                const data = form.scopeOfWorks[sec.key] || { options: [], description: '', dateComplied: '' };
                return (
                  <div key={sec.key} style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', background: '#f8fafc' }}>
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
                    <input type="date" value={data.dateComplied || ''} onChange={e => setScopeField(sec.key, 'dateComplied', e.target.value)} style={inputStyle} />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action Taken */}
          {allowActionTaken && (
            <div style={sectionBox}>
              <div style={sectionTitle}><Stamp size={17} color="#001f9c" /> 3 · Action Taken (PDAS)</div>
              <label style={{ display: 'flex', gap: '10px', fontSize: '14.5px', fontWeight: '700', marginBottom: '8px', cursor: 'pointer', alignItems: 'center' }}>
                <input type="checkbox" checked={form.actionTaken.endorsedDesignTeam.checked} onChange={e => setForm(p => ({ ...p, actionTaken: { ...p.actionTaken, endorsedDesignTeam: { ...p.actionTaken.endorsedDesignTeam, checked: e.target.checked } } }))} style={checkStyle} />
                Endorsed to Design Team
              </label>
              {form.actionTaken.endorsedDesignTeam.checked && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', marginBottom: '12px', marginLeft: '27px' }}>
                  <label style={{ fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}><input type="checkbox" checked={form.actionTaken.endorsedDesignTeam.detailedPlan} onChange={e => setForm(p => ({ ...p, actionTaken: { ...p.actionTaken, endorsedDesignTeam: { ...p.actionTaken.endorsedDesignTeam, detailedPlan: e.target.checked } } }))} style={checkStyle} /> Detailed Plan</label>
                  <label style={{ fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}><input type="checkbox" checked={form.actionTaken.endorsedDesignTeam.powBoq} onChange={e => setForm(p => ({ ...p, actionTaken: { ...p.actionTaken, endorsedDesignTeam: { ...p.actionTaken.endorsedDesignTeam, powBoq: e.target.checked } } }))} style={checkStyle} /> POW & BOQ</label>
                  <input placeholder="Received by" value={form.actionTaken.endorsedDesignTeam.receivedBy} onChange={e => setForm(p => ({ ...p, actionTaken: { ...p.actionTaken, endorsedDesignTeam: { ...p.actionTaken.endorsedDesignTeam, receivedBy: e.target.value } } }))} style={inputStyle} />
                  <input type="date" value={form.actionTaken.endorsedDesignTeam.date} onChange={e => setForm(p => ({ ...p, actionTaken: { ...p.actionTaken, endorsedDesignTeam: { ...p.actionTaken.endorsedDesignTeam, date: e.target.value } } }))} style={inputStyle} />
                </div>
              )}
              <label style={{ display: 'flex', gap: '10px', fontSize: '14.5px', fontWeight: '700', marginBottom: '8px', cursor: 'pointer', alignItems: 'center' }}>
                <input type="checkbox" checked={form.actionTaken.endorsedGSMHead.checked} onChange={e => setForm(p => ({ ...p, actionTaken: { ...p.actionTaken, endorsedGSMHead: { ...p.actionTaken.endorsedGSMHead, checked: e.target.checked } } }))} style={checkStyle} />
                Endorsed to GSM Head for Work Order
              </label>
              {form.actionTaken.endorsedGSMHead.checked && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px', marginLeft: '27px' }}>
                  <input placeholder="Received by" value={form.actionTaken.endorsedGSMHead.receivedBy} onChange={e => setForm(p => ({ ...p, actionTaken: { ...p.actionTaken, endorsedGSMHead: { ...p.actionTaken.endorsedGSMHead, receivedBy: e.target.value } } }))} style={inputStyle} />
                  <input type="date" value={form.actionTaken.endorsedGSMHead.date} onChange={e => setForm(p => ({ ...p, actionTaken: { ...p.actionTaken, endorsedGSMHead: { ...p.actionTaken.endorsedGSMHead, date: e.target.value } } }))} style={inputStyle} />
                </div>
              )}
              <label style={{ display: 'flex', gap: '10px', fontSize: '14.5px', fontWeight: '700', marginBottom: '8px', cursor: 'pointer', alignItems: 'center' }}>
                <input type="checkbox" checked={form.actionTaken.returnedToClient.checked} onChange={e => setForm(p => ({ ...p, actionTaken: { ...p.actionTaken, returnedToClient: { ...p.actionTaken.returnedToClient, checked: e.target.checked } } }))} style={checkStyle} />
                Returned to Client
              </label>
              {form.actionTaken.returnedToClient.checked && (
                <div style={{ display: 'grid', gap: '10px', marginLeft: '27px' }}>
                  <input placeholder="Reason" value={form.actionTaken.returnedToClient.reason} onChange={e => setForm(p => ({ ...p, actionTaken: { ...p.actionTaken, returnedToClient: { ...p.actionTaken.returnedToClient, reason: e.target.value } } }))} style={inputStyle} />
                  <input placeholder="Remarks" value={form.actionTaken.returnedToClient.remarks} onChange={e => setForm(p => ({ ...p, actionTaken: { ...p.actionTaken, returnedToClient: { ...p.actionTaken.returnedToClient, remarks: e.target.value } } }))} style={inputStyle} />
                </div>
              )}
            </div>
          )}

          {/* Final Action */}
          <div style={{ ...sectionBox, background: allowFinalAction ? '#eff6ff' : '#f8fafc' }}>
            <div style={sectionTitle}>4 · Final Action (Approver){allowFinalAction ? '' : ' — read-only here'}</div>
            <div style={{ display: 'flex', gap: '20px', marginBottom: '10px', fontSize: '14.5px', fontWeight: '700', flexWrap: 'wrap' }}>
              {['Pending', 'Approved', 'Disapproved'].map(s => (
                <label key={s} style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: allowFinalAction ? 1 : 0.6, cursor: allowFinalAction ? 'pointer' : 'default' }}>
                  <input type="radio" name="finalStatus" checked={form.finalAction.status === s} disabled={!allowFinalAction} onChange={() => setForm(p => ({ ...p, finalAction: { ...p.finalAction, status: s } }))} style={checkStyle} /> {s}
                </label>
              ))}
            </div>
            <label style={labelStyle}>Remarks</label>
            <textarea value={form.finalAction.remarks} disabled={!allowFinalAction} onChange={e => setForm(p => ({ ...p, finalAction: { ...p.finalAction, remarks: e.target.value } }))} rows={2} style={{ ...inputStyle, background: allowFinalAction ? '#fff' : '#f1f5f9' }} />
            {!allowFinalAction && <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '6px' }}>Tracking number is issued automatically when the Approver sets Approved.</div>}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '12px 16px' }}>
            <span style={{ fontSize: '13.5px', fontWeight: '700', color: '#1e3a8a' }}>
              Official QF-PDAS-DC-01 sheet — generated from your filed fields
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
          <div style={{ fontSize: '12.5px', color: '#64748b', textAlign: 'center' }}>
            Found a mistake? Go <strong>Back to Edit</strong> — the sheet regenerates from your fields.
          </div>
        </div>
      )}
    </Modal>
  );
};

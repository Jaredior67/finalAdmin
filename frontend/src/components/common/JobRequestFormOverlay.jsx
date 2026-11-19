import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Save, Printer, X, FileText, Layers, Stamp, ArrowRight, ArrowLeft, ImagePlus, AlertCircle, AlertTriangle, ChevronDown } from 'lucide-react';
import { Modal } from './Modal';
import { FormField, TextInput, SelectInput } from '../ui/FormField';
import { JobRequestPrintSheet } from './JobRequestPrintSheet';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { JobRequestLocationStep, buildBuildingIndex, joinLocation } from './JobRequestLocationStep';
import { SCOPE_SECTIONS, CATEGORY_SCOPE_KEY, CATEGORY_OPTIONS, requesterDisplayName } from '../../utils/jobRequestIntake';
import { Spinner } from '../ui/Spinner';
import { useOptionalToast } from '../ui/Toast';
import { apiGetSupervisorsList } from '../../backend/api';
import { useOfflineAutoSave } from '../../utils/useOfflineAutoSave';
import { AutoSaveIndicator } from './AutoSaveIndicator';
import { countWords, clampWords, DESCRIPTION_WORD_LIMIT } from '../../utils/wordLimit';
export { SCOPE_SECTIONS };

const blankScope = () => ({
  drawingDesign: { options: [], otherServicesText: '', description: '', dateComplied: '' },
  physicalStructures: { options: [], otherServicesText: '', description: '', dateComplied: '' },
  electrical: { options: [], otherServicesText: '', description: '', dateComplied: '' },
  mechanical: { options: [], otherServicesText: '', description: '', dateComplied: '' },
  waterSanitary: { options: [], otherServicesText: '', description: '', dateComplied: '' },
  airConditioning: { options: [], otherServicesText: '', description: '', dateComplied: '' },
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

function buildState(src = {}, locs = [], fallbackUser = null) {
  const loc = (src.building && src.room)
    ? { building: src.building, floor: src.floor || '', room: src.room, location: src.location || '' }
    : splitLocation(src, locs);
  const defaultRequester = src.requestedBy || src.clientName || requesterDisplayName(fallbackUser) || '';
  const defaultOffice = src.department || src.office || src.officeOfClient || fallbackUser?.department || '';

  const normalizeUrgencyChoice = (u) => {
    if (!u) return '';
    const s = String(u).toLowerCase();
    if (s.includes('high') || s.includes('urgent') || s.includes('critical') || s.includes('hazard')) return 'High';
    if (s.includes('med')) return 'Medium';
    if (s.includes('low') || s.includes('routine')) return 'Low';
    return u;
  };

  // Campus Admin self-endorses: pre-fill immediate supervisor with their own name
  const isCampusAdmin = fallbackUser?.role === 'campus_admin';
  const adminSelfName = isCampusAdmin
    ? [fallbackUser.first_name || fallbackUser.firstName, fallbackUser.last_name || fallbackUser.lastName].filter(Boolean).join(' ') || fallbackUser.email || ''
    : '';
  const defaultSupervisor = src.immediateSupervisor
    || (isCampusAdmin ? adminSelfName : (fallbackUser?.assignedSupervisor || fallbackUser?.supervisorName || fallbackUser?.immediateSupervisor || ''));

  return {
    date: src.date || localTodayISO(),
    requestedBy: defaultRequester,
    office: defaultOffice,
    building: src.building || loc.building || '',
    floor: src.floor || loc.floor || '',
    room: src.room || loc.room || '',
    location: src.location || loc.location || '',
    // Preserved so a re-print or an edit does not lose the tag the request was
    // filed from, or the campus_locations row it resolved to.
    qrCodeRef: src.qrCodeRef || '',
    locationId: /^\d+$/.test(String(src.locationId ?? '')) ? Number(src.locationId) : null,
    immediateSupervisor: defaultSupervisor,
    contactNumber: src.contactNumber || fallbackUser?.phone || fallbackUser?.contactNumber || '',
    title: src.title || '',
    category: src.category || '',
    urgency: normalizeUrgencyChoice(src.urgency) || '',
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
  autoOpenScanner = false,
}) => {
  const { campusLocations } = useData();
  const { currentUser } = useAuth();
  const toastCtx = useOptionalToast();
  const toast = toastCtx?.toast;
  // Detect if the filer is a campus_admin — they self-endorse and self-approve
  const isCampusAdminFiling = !Boolean(initialReq?.controlNo || initialReq?.id) && currentUser?.role === 'campus_admin';
  const [form, setForm] = useState(() => buildState(initialReq, campusLocations, currentUser));
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
  const [pendingCategory, setPendingCategory] = useState(null); // holds new category value during confirm dialog
  const buildingIndex = useMemo(
    () => buildBuildingIndex(campusLocations || []),
    [campusLocations]
  );

  // Clear legacy un-scoped draft that contaminated forms with other users' names
  useEffect(() => {
    try {
      localStorage.removeItem('fixit_draft_new_job_request_form');
    } catch {}
  }, []);

  const isEditingExisting = Boolean(initialReq?.controlNo || initialReq?.id);
  const formDraftKey = isEditingExisting
    ? `edit_req_${initialReq.id || initialReq.controlNo}`
    : `new_job_request_form_${currentUser?.id || 'guest'}`;

  const { isOnline, lastSaved, hasDraft, clearDraft } = useOfflineAutoSave(
    formDraftKey,
    form,
    (draftData) => {
      if (!isEditingExisting && draftData && typeof draftData === 'object') {
        const defaultRequester = initialReq?.requestedBy || requesterDisplayName(currentUser);
        const resolvedName = (draftData.requestedBy && draftData.requestedBy !== 'Florelyn Etanong')
          ? draftData.requestedBy
          : (defaultRequester || draftData.requestedBy || '');
        setForm(prev => ({
          ...prev,
          ...draftData,
          requestedBy: resolvedName,
          scopeOfWorks: { ...blankScope(), ...(draftData.scopeOfWorks || {}) },
          actionTaken: {
            endorsedDesignTeam: { checked: false, detailedPlan: false, powBoq: false, receivedBy: '', date: '', ...(draftData.actionTaken?.endorsedDesignTeam || {}) },
            endorsedGSMHead: { checked: false, receivedBy: '', date: '', ...(draftData.actionTaken?.endorsedGSMHead || {}) },
            returnedToClient: { checked: false, reason: '', receivedBy: '', date: '', remarks: '', ...(draftData.actionTaken?.returnedToClient || {}) },
          },
          finalAction: { status: 'Pending', remarks: '', ...(draftData.finalAction || {}) }
        }));
        if (draftData.immediateSupervisor) {
          setSupQuery(draftData.immediateSupervisor);
        }
      }
    }
  );

  const handleClearDraft = () => {
    clearDraft();
    setForm(buildState(initialReq, campusLocations, currentUser));
    setSupQuery(initialReq?.immediateSupervisor || campusAdminSelfName);
    setPhotoPreview(initialReq?.photoUrl || null);
    setPhotoName(initialReq?.photoName || '');
  };

  // ── Supervisor auto-assignment ──────────────────────────────────────────
  const [supervisors, setSupervisors] = useState([]);
  // Campus Admin self-endorses: pre-populate the supervisor query with their own name
  const campusAdminSelfName = isCampusAdminFiling
    ? [currentUser?.first_name || currentUser?.firstName, currentUser?.last_name || currentUser?.lastName].filter(Boolean).join(' ') || currentUser?.email || ''
    : '';
  const initialSupName = initialReq?.immediateSupervisor
    || (isCampusAdminFiling ? campusAdminSelfName : (currentUser?.assignedSupervisor || currentUser?.supervisorName || currentUser?.immediateSupervisor || ''));
  const [supQuery, setSupQuery] = useState(initialSupName);

  const refreshSupervisors = useCallback(() => {
    apiGetSupervisorsList()
      .then((list) => setSupervisors(Array.isArray(list) ? list : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshSupervisors();
  }, [refreshSupervisors]);

  useEffect(() => {
    if (isOpen) {
      refreshSupervisors();
    }
  }, [isOpen, refreshSupervisors]);

  // Automatically resolve and assign immediate supervisor for requesters
  useEffect(() => {
    if (supervisors.length > 0 && !isCampusAdminFiling) {
      if (!form.immediateSupervisor) {
        const match = (currentUser?.supervisor_id && supervisors.find(s => Number(s.id) === Number(currentUser.supervisor_id)))
          || (currentUser?.department && supervisors.find(s => s.department && s.department.toLowerCase() === currentUser.department.toLowerCase()))
          || supervisors[0];
        if (match) {
          const fullName = `${match.firstName} ${match.middleName ? match.middleName + ' ' : ''}${match.lastName}`.trim();
          setForm(prev => ({ ...prev, immediateSupervisor: fullName }));
          setSupQuery(fullName);
        }
      }
    }
  }, [supervisors, form.immediateSupervisor, isCampusAdminFiling, currentUser]);

  useEffect(() => {
    if (isOpen) {
      let restoredFromDraft = false;
      if (!isEditingExisting) {
        try {
          const raw = localStorage.getItem(`fixit_draft_${formDraftKey}`);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed?.data && typeof parsed.data === 'object') {
              const hasContent = Object.values(parsed.data).some(v => v !== null && v !== undefined && v !== '' && (!Array.isArray(v) || v.length > 0));
              if (hasContent) {
                const defaultRequester = initialReq?.requestedBy || requesterDisplayName(currentUser);
                const resolvedName = (parsed.data.requestedBy && parsed.data.requestedBy !== 'Florelyn Etanong')
                  ? parsed.data.requestedBy
                  : (defaultRequester || parsed.data.requestedBy || '');
                setForm({
                  ...buildState(initialReq, campusLocations, currentUser),
                  ...parsed.data,
                  requestedBy: resolvedName,
                  scopeOfWorks: { ...blankScope(), ...(parsed.data.scopeOfWorks || {}) }
                });
                if (parsed.data.immediateSupervisor) {
                  setSupQuery(parsed.data.immediateSupervisor);
                }
                restoredFromDraft = true;
              }
            }
          }
        } catch {
          // ignore error
        }
      }

      if (!restoredFromDraft) {
        setForm(buildState(initialReq, campusLocations, currentUser));
      }
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
      if (patch.scopeOfWorks) delete next.scopeDescription;
      return next;
    });
  };

  // Category change with guard: if scope already has data, ask for confirmation first.
  const applyCategory = (cat) => {
    set({ category: cat, scopeOfWorks: blankScope() });
    setPendingCategory(null);
  };

  const handleCategoryChange = (newCat) => {
    if (!newCat || newCat === form.category) return;
    const hasData = Object.values(form.scopeOfWorks).some(
      s => (s.options && s.options.length > 0) || (s.description && s.description.trim())
    );
    if (hasData) {
      setPendingCategory(newCat);
    } else {
      applyCategory(newCat);
    }
  };

  // Single-select: clicking a scope option replaces any previous selection.
  // Clicking the already-selected option deselects it.
  const toggleScopeOption = (sectionKey, opt) => {
    setForm(prev => {
      const sec = prev.scopeOfWorks[sectionKey] || { options: [], otherServicesText: '', description: '', dateComplied: '' };
      const isCurrentlySelected = (sec.options || []).includes(opt);
      const newOptions = isCurrentlySelected ? [] : [opt];
      // Clear otherServicesText when switching away from "Other Services"
      const newOtherServicesText = opt === 'Other Services' && !isCurrentlySelected ? (sec.otherServicesText || '') : '';
      return {
        ...prev,
        scopeOfWorks: {
          ...prev.scopeOfWorks,
          [sectionKey]: { ...sec, options: newOptions, otherServicesText: newOtherServicesText },
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
    // requestedBy, office, and date are auto-filled from the user's profile and are read-only — no manual validation needed.
    if (!form.category) next.category = 'Select a main category.';
    if (!form.urgency) next.urgency = 'Select an urgency level.';
    // Scope description is required when the category has a matching section
    const scopeKey = CATEGORY_SCOPE_KEY[form.category];
    if (scopeKey) {
      const scopeDesc = form.scopeOfWorks[scopeKey]?.description?.trim();
      if (!scopeDesc) next.scopeDescription = 'Add a description of work in the scope section below.';
    }
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

  // Auto-derive title and description from category + scope checkboxes
  const scopeKey = CATEGORY_SCOPE_KEY[form.category];
  const checkedOpts = scopeKey ? (form.scopeOfWorks[scopeKey]?.options || []) : [];
  const autoTitle = form.title || (checkedOpts.length > 0
    ? `${form.category} — ${checkedOpts.join(', ')}`
    : `${form.category || 'General'} service request`);
  const autoDescription = form.description || (scopeKey
    ? (form.scopeOfWorks[scopeKey]?.description?.trim() || autoTitle)
    : autoTitle);

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
      title: autoTitle,
      category: form.category,
      urgency: form.urgency,
      description: autoDescription,
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

      if (!isDraft) {
        clearDraft();
      }

      if (toast) {
        if (isDraft) toast('Job request saved as draft.', 'info');
        else if (isCampusAdminFiling) toast('Request filed and automatically approved! Forwarded to System Admin for assignment.', 'success');
        else toast('Job request submitted and electronically signed!', 'success');
      }
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  };

  const resolvedTracking = initialReq?.controlNo || initialReq?.ticket_no || initialReq?.officialTrackingNo || (initialReq?.id && (String(initialReq.id).startsWith('JR-') || String(initialReq.id).startsWith('TRK-')) ? initialReq.id : null);
  const trackingLabel = resolvedTracking || 'PENDING, issued when the work order is assigned';

  // Official document, generated from the filed-in fields for Step 2 review.
  
  const formatDraftTime = (date) => {
    if (!date) return '';
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  const previewReq = {
    controlNo: resolvedTracking || null,
    ticket_no: resolvedTracking || null,
    status: isCampusAdminFiling ? 'Approved' : 'Pending',
    date: form.date,
    requestedBy: form.requestedBy || '—',
    department: form.office,
    office: form.office,
    location: resolvedLocation(),
    immediateSupervisor: form.immediateSupervisor,
    contactNumber: form.contactNumber,
    title: autoTitle,
    category: form.category,
    description: autoDescription,
    materialsUsed: initialReq?.materialsUsed || initialReq?.materials_used || '',
    scopeOfWorks: form.scopeOfWorks,
    actionTaken: form.actionTaken,
    finalAction: isCampusAdminFiling
      ? { status: 'Approved', remarks: 'Auto-approved upon submission by Campus Administrator' }
      : form.finalAction,
    requesterApproved: true,
    requesterApprovedAt: new Date().toISOString(),
    supervisorApproved: isCampusAdminFiling,
    supervisorApprovedAt: isCampusAdminFiling ? new Date().toISOString() : null,
    campusAdminApproved: isCampusAdminFiling,
    campusAdminApprovedAt: isCampusAdminFiling ? new Date().toISOString() : null,
  };

  return (
    <>
    <Modal isOpen={isOpen} onClose={onClose} title="Job Request Form" subtitle="QF-PDAS-DC-01 · Revision 00 · Effective Feb 3, 2025" maxWidth="920px"
      footer={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '12px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#475569',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              padding: '10px 14px'
            }}
          >
            Cancel
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={() => handleSave(false, true)}
              disabled={saving}
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                color: '#0f172a',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                padding: '10px 18px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
              }}
            >
              {saving ? <Spinner size={14} color="#475569" /> : null}
              <span>Save draft</span>
            </button>
            <button
              type="button"
              onClick={() => promptSubmitApproval(false)}
              disabled={saving}
              style={{
                background: '#071746',
                border: 'none',
                borderRadius: '8px',
                color: '#ffffff',
                fontSize: '14px',
                fontWeight: '700',
                cursor: 'pointer',
                padding: '10px 22px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 6px rgba(7, 23, 70, 0.18)'
              }}
            >
              {saving ? <Spinner size={14} color="#ffffff" /> : null}
              <span>Submit request</span>
            </button>
          </div>
        </div>
      }>
      
        {/* Top Tab Bar & Draft status */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #e2e8f0',
          marginBottom: '20px',
          paddingBottom: '0',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', gap: '24px' }}>
            <button
              type="button"
              onClick={() => setView('form')}
              style={{
                background: 'none',
                border: 'none',
                padding: '0 0 12px 0',
                fontSize: '14.5px',
                fontWeight: view === 'form' ? '700' : '600',
                color: view === 'form' ? '#0f172a' : '#64748b',
                borderBottom: view === 'form' ? '2.5px solid #d97706' : '2.5px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              Request details
            </button>
            <button
              type="button"
              onClick={() => setView('preview')}
              style={{
                background: 'none',
                border: 'none',
                padding: '0 0 12px 0',
                fontSize: '14.5px',
                fontWeight: view === 'preview' ? '700' : '600',
                color: view === 'preview' ? '#0f172a' : '#64748b',
                borderBottom: view === 'preview' ? '2.5px solid #d97706' : '2.5px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              Official form preview
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '12.5px', paddingBottom: '12px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#475569' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
              <span>{lastSaved ? `Draft saved ${formatDraftTime(lastSaved)}` : 'Draft saved'}</span>
            </span>
            {hasDraft && (
              <button
                type="button"
                onClick={handleClearDraft}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#2563eb',
                  cursor: 'pointer',
                  padding: 0,
                  fontSize: '12.5px',
                  fontWeight: '600'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; }}
                onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; }}
              >
                Clear draft
              </button>
            )}
          </div>
        </div>

        {view === 'form' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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

            {/* Campus Admin self-approval banner */}
            {isCampusAdminFiling && (
              <div style={{
                display: 'flex', gap: '10px', alignItems: 'flex-start',
                background: '#f0fdf4', border: '1px solid #86efac',
                borderRadius: '10px', padding: '12px 14px'
              }}>
                <AlertTriangle size={18} color="#15803d" style={{ flexShrink: 0, marginTop: '1px' }} />
                <div style={{ fontSize: '13px', color: '#166534', lineHeight: 1.6 }}>
                  <strong>Campus Administrator Self-Filed Request</strong><br />
                  As Campus Administrator, you will act as <em>Requester</em>, <em>Immediate Supervisor</em>, and <em>Approver</em> for this request.
                  It will be stamped <strong>Approved</strong> immediately and forwarded directly to the <strong>System Administrator</strong> for technician assignment — no further approval steps required.
                </div>
              </div>
            )}

            {/* Section 1: LOCATION */}
            <div>
              <JobRequestLocationStep
                buildingIndex={buildingIndex}
                value={{ building: form.building, floor: form.floor, room: form.room, location: form.location }}
                onChange={(patch) => set(patch)}
                error={errors.location}
                disabled={saving}
                autoOpenScanner={autoOpenScanner}
              />
            </div>

            {/* Section 2: Requester Details & Supervisory Endorsement */}
            <div>
              <div style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a', marginBottom: '14px' }}>
                2 Requester &amp; supervisory endorsement
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))', gap: '14px', marginBottom: '14px' }}>
                <FormField label="Tracking number" htmlFor="jr-tracking" style={{ marginBottom: 0 }}>
                  <TextInput id="jr-tracking" value={trackingLabel} disabled style={{ background: 'var(--bg-sunken)', color: resolvedTracking ? '#001f9c' : '#64748b', fontWeight: resolvedTracking ? '700' : '500' }} />
                </FormField>
                <FormField label="Date of request" htmlFor="jr-date" style={{ marginBottom: 0 }}>
                  <TextInput
                    id="jr-date"
                    type="date"
                    value={form.date}
                    disabled
                    style={{ background: 'var(--bg-sunken)', color: '#0f172a', fontWeight: '500', cursor: 'default' }}
                  />
                </FormField>
                <FormField label="Name of client" htmlFor="jr-client" style={{ marginBottom: 0 }}>
                  <TextInput
                    id="jr-client"
                    value={form.requestedBy}
                    disabled
                    style={{ background: 'var(--bg-sunken)', color: '#0f172a', fontWeight: '500', cursor: 'default' }}
                  />
                </FormField>
                <FormField label="Office of client" htmlFor="jr-office" style={{ marginBottom: 0 }}>
                  <TextInput
                    id="jr-office"
                    value={form.office}
                    onChange={(e) => set({ office: e.target.value })}
                    style={{ background: '#ffffff', color: '#0f172a' }}
                  />
                </FormField>
              </div>

              <FormField label="Immediate Supervisor" htmlFor="jr-supervisor" style={{ marginBottom: 0 }}>
                {isCampusAdminFiling ? (
                  <div style={{ position: 'relative' }}>
                    <TextInput
                      id="jr-supervisor"
                      value={supQuery || 'Campus Administrator'}
                      disabled
                      readOnly
                      style={{ background: '#f0fdf4', border: '1px solid #86efac', color: '#166534', fontWeight: '700', paddingRight: '130px' }}
                    />
                    <span style={{
                      position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                      background: '#dcfce7', color: '#15803d', fontSize: '11px', fontWeight: '800',
                      padding: '2px 8px', borderRadius: '9999px', border: '1px solid #86efac',
                      whiteSpace: 'nowrap'
                    }}>✓ Self-endorsed</span>
                  </div>
                ) : (
                  <div style={{ position: 'relative' }}>
                    <TextInput
                      id="jr-supervisor"
                      value={form.immediateSupervisor || supQuery || 'Assigned Department Supervisor'}
                      disabled
                      readOnly
                      style={{
                        background: 'var(--bg-sunken)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-main, #0f172a)',
                        fontWeight: '600',
                        paddingRight: '160px'
                      }}
                    />
                    <span style={{
                      position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                      background: '#ecfdf5', color: '#047857', fontSize: '11px', fontWeight: '700',
                      padding: '3px 9px', borderRadius: '9999px', border: '1px solid #a7f3d0',
                      whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '4px'
                    }}>✓ Assigned Supervisor</span>
                  </div>
                )}
              </FormField>
            </div>

            {/* Section 3: Work Classification & Urgency Level */}
            <div>
              <div style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a', marginBottom: '14px' }}>
                3 Work classification &amp; urgency level
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))', gap: '14px' }}>
                <FormField label="Main Category" required htmlFor="jr-category" error={errors.category} style={{ marginBottom: 0 }}>
                  <SelectInput id="jr-category" value={form.category} onChange={e => handleCategoryChange(e.target.value)}>
                    <option value="" disabled>Select category</option>
                    {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                  </SelectInput>
                </FormField>
                <FormField label="Urgency Level" required htmlFor="jr-urgency" error={errors.urgency} style={{ marginBottom: 0 }}>
                  <SelectInput id="jr-urgency" value={form.urgency} onChange={e => set({ urgency: e.target.value })}>
                    <option value="" disabled>Select urgency</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </SelectInput>
                </FormField>
              </div>

              {/* High priority institutional triage banner */}
              {(form.urgency === 'High' || form.urgency === 'High Risk' || /high|urgent|emergency|critical/i.test(String(form.urgency || ''))) && (
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: '12px',
                  background: '#fff1f2', border: '1.5px solid #fecdd3',
                  borderRadius: '10px', padding: '14px 16px', marginTop: '14px'
                }}>
                  <AlertTriangle size={20} color="#dc2626" style={{ flexShrink: 0, marginTop: '1px' }} />
                  <div style={{ fontSize: '13px', color: '#881337', lineHeight: 1.55 }}>
                    <strong style={{ color: '#991b1b' }}>High Priority Flagged:</strong> This request will be highlighted in red and prioritized at the top of the queue for expedited administrative review and technician dispatch. Complete all standard fields below in full.
                  </div>
                </div>
              )}
            </div>

            {/* Section 4: Scope — only the section matching the chosen category */}
            <div>
              <div style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a', marginBottom: '14px' }}>
                4 Area / Scope of work checklist
              </div>
              {!form.category ? (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: '10px', padding: '28px 16px',
                  color: '#94a3b8', fontSize: '14px', textAlign: 'center',
                  border: '1.5px dashed #cbd5e1', borderRadius: '10px',
                  background: 'var(--bg-sunken)'
                }}>
                  ← Select a Main Category above to see the scope options
                </div>
              ) : (() => {
                const matchedSec = SCOPE_SECTIONS.find(s => s.key === CATEGORY_SCOPE_KEY[form.category]);
                if (!matchedSec) {
                  return (
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', background: 'var(--bg-sunken)' }}>
                      <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '10px' }}>
                        No predefined scope options for <strong>{form.category}</strong>. Describe the work needed below.
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <label style={{ ...labelStyle, marginBottom: 0 }}>Description of Work <span style={{ color: '#dc2626' }}>*</span></label>
                        <span style={{ fontSize: '12px', color: countWords(form.scopeOfWorks.electrical?.description || '') > DESCRIPTION_WORD_LIMIT ? '#dc2626' : '#64748b' }}>
                          {countWords(form.scopeOfWorks.electrical?.description || '')} / {DESCRIPTION_WORD_LIMIT} words
                        </span>
                      </div>
                      <textarea
                        value={form.scopeOfWorks.electrical?.description || ''}
                        onChange={e => {
                          const text = e.target.value;
                          if (countWords(text) > DESCRIPTION_WORD_LIMIT) {
                            setScopeField('electrical', 'description', clampWords(text, DESCRIPTION_WORD_LIMIT));
                          } else {
                            setScopeField('electrical', 'description', text);
                          }
                          if (errors.scopeDescription) setErrors(prev => { const n = { ...prev }; delete n.scopeDescription; return n; });
                        }}
                        rows={4}
                        placeholder="Describe the work needed..."
                        style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
                      />
                      {errors.scopeDescription && (
                        <div style={{ color: '#dc2626', fontSize: '12px', marginTop: '4px' }}>{errors.scopeDescription}</div>
                      )}
                    </div>
                  );
                }
                const data = form.scopeOfWorks[matchedSec.key] || { options: [], description: '', dateComplied: '' };
                return (
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '18px', background: 'var(--bg-sunken)' }}>
                    <div style={{ fontSize: '13.5px', fontWeight: '800', color: '#001f9c', marginBottom: '12px' }}>{matchedSec.label}</div>
                    {/* Scope options — single-select radio chips */}
                    <div className="jr-scope-options-grid">
                      {matchedSec.options.map(opt => {
                        const isChecked = (data.options || []).includes(opt);
                        return (
                          <label
                            key={opt}
                            className={`jr-scope-chip ${isChecked ? 'is-checked' : ''}`}
                          >
                            <input
                              type="radio"
                              name={`scope-${matchedSec.key}`}
                              checked={isChecked}
                              onChange={() => toggleScopeOption(matchedSec.key, opt)}
                              style={checkStyle}
                            />
                            <span>{opt}</span>
                          </label>
                        );
                      })}
                    </div>
                    {/* "Other Services" free-text input */}
                    {(data.options || []).includes('Other Services') && (
                      <div style={{ marginTop: '10px', marginBottom: '6px' }}>
                        <label style={labelStyle}>Please specify other services <span style={{ color: '#dc2626' }}>*</span></label>
                        <input
                          type="text"
                          placeholder="Describe the other service needed..."
                          value={data.otherServicesText || ''}
                          onChange={e => setScopeField(matchedSec.key, 'otherServicesText', e.target.value)}
                          style={inputStyle}
                        />
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', marginTop: '12px' }}>
                      <label style={{ ...labelStyle, marginBottom: 0 }}>Description of Work <span style={{ color: '#dc2626' }}>*</span></label>
                      <span style={{ fontSize: '12px', color: countWords(data.description || '') > DESCRIPTION_WORD_LIMIT ? '#dc2626' : '#64748b' }}>
                        {countWords(data.description || '')} / {DESCRIPTION_WORD_LIMIT} words
                      </span>
                    </div>
                    <textarea
                      value={data.description || ''}
                      onChange={e => {
                        const text = e.target.value;
                        if (countWords(text) > DESCRIPTION_WORD_LIMIT) {
                          setScopeField(matchedSec.key, 'description', clampWords(text, DESCRIPTION_WORD_LIMIT));
                        } else {
                          setScopeField(matchedSec.key, 'description', text);
                        }
                        if (errors.scopeDescription) setErrors(prev => { const n = { ...prev }; delete n.scopeDescription; return n; });
                      }}
                      rows={4}
                      placeholder="Describe the work needed for this area..."
                      style={{ ...inputStyle, marginBottom: errors.scopeDescription ? '4px' : '14px', resize: 'vertical', lineHeight: 1.6 }}
                    />
                    {errors.scopeDescription && (
                      <div style={{ color: '#dc2626', fontSize: '12px', marginTop: '4px' }}>{errors.scopeDescription}</div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Section 5: Photo / Evidence Upload */}
            <div>
              <div style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a', marginBottom: '14px' }}>
                5 Photo attachment (Optional)
              </div>
              <div style={{
                border: '1.5px dashed #cbd5e1', borderRadius: '10px', padding: '16px',
                display: 'flex', alignItems: 'center', gap: '14px', background: '#ffffff',
                flexWrap: 'wrap'
              }}>
                {photoPreview ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <img src={photoPreview} alt="Preview" style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>{photoName || 'Photo attached'}</div>
                      <button
                        type="button"
                        onClick={() => { setPhotoPreview(null); setPhotoName(''); }}
                        style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '12px', cursor: 'pointer', padding: 0, marginTop: '4px' }}
                      >
                        Remove photo
                      </button>
                    </div>
                  </div>
                ) : (
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#001f9c', fontSize: '13px', fontWeight: '700' }}>
                    <ImagePlus size={18} />
                    <span>Upload photo / area attachment</span>
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setPhotoName(file.name);
                        const reader = new FileReader();
                        reader.onload = ev => setPhotoPreview(ev.target.result);
                        reader.readAsDataURL(file);
                      }}
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Action Taken (If Allowed) */}
            {allowActionTaken && (
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                <div style={sectionTitle}><Stamp size={17} color="#001f9c" /> Action Taken (PDAS)</div>
                <label style={{ display: 'flex', gap: '10px', fontSize: '14.5px', fontWeight: '700', marginBottom: '8px', cursor: 'pointer', alignItems: 'center' }}>
                  <input
                    type="radio"
                    name="actionTakenMain"
                    checked={form.actionTaken.endorsedDesignTeam.checked}
                    onChange={() => setForm(p => ({
                      ...p,
                      actionTaken: {
                        endorsedDesignTeam: { ...p.actionTaken.endorsedDesignTeam, checked: true },
                        endorsedGSMHead: { ...p.actionTaken.endorsedGSMHead, checked: false },
                        returnedToClient: { ...p.actionTaken.returnedToClient, checked: false },
                      }
                    }))}
                    style={checkStyle}
                  />
                  Endorsed to Design Team
                </label>
                {form.actionTaken.endorsedDesignTeam.checked && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))', gap: '10px', marginBottom: '12px', paddingLeft: '8px' }}>
                    <label style={{ fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}><input type="checkbox" checked={form.actionTaken.endorsedDesignTeam.detailedPlan} onChange={e => setForm(p => ({ ...p, actionTaken: { ...p.actionTaken, endorsedDesignTeam: { ...p.actionTaken.endorsedDesignTeam, detailedPlan: e.target.checked } } }))} style={checkStyle} /> Detailed Plan</label>
                    <label style={{ fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}><input type="checkbox" checked={form.actionTaken.endorsedDesignTeam.powBoq} onChange={e => setForm(p => ({ ...p, actionTaken: { ...p.actionTaken, endorsedDesignTeam: { ...p.actionTaken.endorsedDesignTeam, powBoq: e.target.checked } } }))} style={checkStyle} /> POW &amp; BOQ</label>
                    <input placeholder="Received by" value={form.actionTaken.endorsedDesignTeam.receivedBy ?? ''} onChange={e => setForm(p => ({ ...p, actionTaken: { ...p.actionTaken, endorsedDesignTeam: { ...p.actionTaken.endorsedDesignTeam, receivedBy: e.target.value } } }))} style={inputStyle} />
                    <input type="date" value={form.actionTaken.endorsedDesignTeam.date ?? ''} onChange={e => setForm(p => ({ ...p, actionTaken: { ...p.actionTaken, endorsedDesignTeam: { ...p.actionTaken.endorsedDesignTeam, date: e.target.value } } }))} style={inputStyle} />
                  </div>
                )}
                <label style={{ display: 'flex', gap: '10px', fontSize: '14.5px', fontWeight: '700', marginBottom: '8px', cursor: 'pointer', alignItems: 'center' }}>
                  <input
                    type="radio"
                    name="actionTakenMain"
                    checked={form.actionTaken.endorsedGSMHead.checked}
                    onChange={() => setForm(p => ({
                      ...p,
                      actionTaken: {
                        endorsedDesignTeam: { ...p.actionTaken.endorsedDesignTeam, checked: false },
                        endorsedGSMHead: { ...p.actionTaken.endorsedGSMHead, checked: true },
                        returnedToClient: { ...p.actionTaken.returnedToClient, checked: false },
                      }
                    }))}
                    style={checkStyle}
                  />
                  Endorsed to GSM Head for Work Order
                </label>
                {form.actionTaken.endorsedGSMHead.checked && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))', gap: '10px', marginBottom: '12px', paddingLeft: '8px' }}>
                    <input placeholder="Received by" value={form.actionTaken.endorsedGSMHead.receivedBy ?? ''} onChange={e => setForm(p => ({ ...p, actionTaken: { ...p.actionTaken, endorsedGSMHead: { ...p.actionTaken.endorsedGSMHead, receivedBy: e.target.value } } }))} style={inputStyle} />
                    <input type="date" value={form.actionTaken.endorsedGSMHead.date ?? ''} onChange={e => setForm(p => ({ ...p, actionTaken: { ...p.actionTaken, endorsedGSMHead: { ...p.actionTaken.endorsedGSMHead, date: e.target.value } } }))} style={inputStyle} />
                  </div>
                )}
                <label style={{ display: 'flex', gap: '10px', fontSize: '14.5px', fontWeight: '700', marginBottom: '8px', cursor: 'pointer', alignItems: 'center' }}>
                  <input
                    type="radio"
                    name="actionTakenMain"
                    checked={form.actionTaken.returnedToClient.checked}
                    onChange={() => setForm(p => ({
                      ...p,
                      actionTaken: {
                        endorsedDesignTeam: { ...p.actionTaken.endorsedDesignTeam, checked: false },
                        endorsedGSMHead: { ...p.actionTaken.endorsedGSMHead, checked: false },
                        returnedToClient: { ...p.actionTaken.returnedToClient, checked: true },
                      }
                    }))}
                    style={checkStyle}
                  />
                  Returned to Client
                </label>
                {form.actionTaken.returnedToClient.checked && (
                  <div style={{ display: 'grid', gap: '10px', paddingLeft: '8px' }}>
                    <input placeholder="Reason" value={form.actionTaken.returnedToClient.reason ?? ''} onChange={e => setForm(p => ({ ...p, actionTaken: { ...p.actionTaken, returnedToClient: { ...p.actionTaken.returnedToClient, reason: e.target.value } } }))} style={inputStyle} />
                    <input placeholder="Remarks" value={form.actionTaken.returnedToClient.remarks ?? ''} onChange={e => setForm(p => ({ ...p, actionTaken: { ...p.actionTaken, returnedToClient: { ...p.actionTaken.returnedToClient, remarks: e.target.value } } }))} style={inputStyle} />
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{
              background: 'var(--bg-sunken)',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '16px',
              maxHeight: '70vh',
              overflowY: 'auto'
            }}>
              <div style={{ minWidth: '600px', maxWidth: '820px', margin: '0 auto', background: '#ffffff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <JobRequestPrintSheet req={previewReq} />
              </div>
            </div>
          </div>
        )}
</Modal>

    {/* Step 3 — Requester electronic approval confirmation dialog */}
    {showConfirmSubmit && typeof document !== 'undefined' && createPortal(
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-submit-title"
        style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(15,23,42,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '16px'
        }}
      >
        <div className="jr-confirm-dialog">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{
              width: '44px', height: '44px', borderRadius: '12px',
              background: isCampusAdminFiling ? '#f0fdf4' : '#eff6ff',
              color: isCampusAdminFiling ? '#15803d' : '#001f9c',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}>
              <AlertTriangle size={22} />
            </div>
            <div>
              <div id="confirm-submit-title" style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
                {isCampusAdminFiling ? 'Submit & Auto-Approve Request?' : 'Submit & Approve Request?'}
              </div>
              <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
                {isCampusAdminFiling
                  ? 'As Campus Administrator, you will self-endorse and self-approve this request.'
                  : 'This is your electronic approval stamp as the requester.'}
              </div>
            </div>
          </div>
          <div style={{
            background: isCampusAdminFiling ? '#f0fdf4' : '#eff6ff',
            border: `1px solid ${isCampusAdminFiling ? '#86efac' : '#bfdbfe'}`,
            borderRadius: '10px',
            padding: '14px 16px', marginBottom: '20px', fontSize: '13px',
            color: isCampusAdminFiling ? '#166534' : '#1e3a8a', lineHeight: 1.6
          }}>
            {isCampusAdminFiling ? (
              <>
                <strong>This request will be automatically approved.</strong><br />
                As Campus Administrator, you act as the <em>Requester</em>, <em>Immediate Supervisor</em>, and <em>Approver</em>.
                The request will be stamped <strong>Approved</strong> immediately and forwarded to the <strong>System Administrator</strong> for technician assignment — no further approval steps required.
              </>
            ) : (
              <>
                <strong>Are you sure you want to submit and approve this request?</strong><br />
                By clicking <em>Submit &amp; Approve</em>, your name and timestamp will be electronically stamped
                on the QF-PDAS-DC-01 form and the request will be routed to your Immediate Supervisor for review.
              </>
            )}
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
              style={{ padding: '10px 22px', fontSize: '14.5px', fontWeight: '800', background: isCampusAdminFiling ? '#15803d' : '#001f9c' }}
              onClick={() => {
                setShowConfirmSubmit(false);
                handleSave(pendingPrintAfter, false);
              }}
            >
              <Stamp size={15} /> {isCampusAdminFiling ? 'Yes, Submit & Auto-Approve' : 'Yes, Submit & Approve'}
            </button>
          </div>
        </div>
      </div>,
      document.body
    )}

    {/* Category-change confirmation dialog */}
    {pendingCategory && typeof document !== 'undefined' && createPortal(
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(15,23,42,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '16px'
        }}
      >
        <div className="jr-confirm-dialog">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#fef9c3', color: '#a16207', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <AlertTriangle size={20} />
            </div>
            <div style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>Change Category?</div>
          </div>
          <p style={{ color: '#64748b', fontSize: '14px', lineHeight: 1.6, marginBottom: '20px' }}>
            Switching to <strong>{pendingCategory}</strong> will clear the scope checkboxes and description you've already filled in. This cannot be undone.
          </p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '10px 18px', fontSize: '14px' }}
              onClick={() => setPendingCategory(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              style={{ padding: '10px 20px', fontSize: '14px', fontWeight: '800' }}
              onClick={() => applyCategory(pendingCategory)}
            >
              Yes, change category
            </button>
          </div>
        </div>
      </div>,
      document.body
    )}
  </>
  );
};

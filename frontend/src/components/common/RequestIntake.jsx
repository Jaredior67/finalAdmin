/* ============================================================================
   RequestIntake — the single "file a request" flow, shared by every role.

   Faculty, Staff and PDAS Administration all start a request from here, so the
   entry points can no longer diverge: same two header buttons (Scan QR, New
   Request), same chooser, same form, same location capture, same word limit,
   same print sheet, same confirmation screen.

   Use the hook for state and the two components for markup:

     const intake = useRequestIntake({ requester, onFiled, onTrack });
     <PageHeader action={<RequestIntakeActions intake={intake} />} ... />
     <RequestIntakePanel intake={intake} requesterName={...} showLauncher />
     <RequestIntake intake={intake} />            // modals — mount once
   ========================================================================== */
import React, { useState, useEffect } from 'react';
import {
  FileText,
  AlertTriangle,
  Printer,
  Clock,
  CheckCircle2,
  Plus,
  MapPin
} from 'lucide-react';
import { useData } from '../../context/DataContext';
import { Modal } from './Modal';
import { JobRequestFormOverlay } from './JobRequestFormOverlay';
import { JobRequestPrintSheet } from './JobRequestPrintSheet';
import { PrintPortal } from './PrintPortal';
import { printDocument } from '../../utils/print';
import { QrCodeScannerModal } from './QrCodeScannerModal';
import { buildBuildingIndex, joinLocation } from './JobRequestLocationStep';
import { buildRequisitionPayload, requesterDisplayName } from '../../utils/jobRequestIntake';

/* The ticket lifecycle, shown as a neutral reference under the launcher. */
export const REQUEST_LIFECYCLE = [
  'Pending',
  'Under Review',
  'Pending Final Approval',
  'Approved',
  'Ongoing',
  'Completed'
];

const todayISO = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

/* ---------------------------------------------------------------------------
   useRequestIntake — all of the flow's state in one place.
   --------------------------------------------------------------------------- */
export function useRequestIntake({
  requester = {},
  office = '',
  onFiled = null,
  onTrack = null
} = {}) {
  const {
    addRequisition,
    campusLocations,
    pendingScannedLocation,
    setPendingScannedLocation
  } = useData();

  const [isStandardOpen, setIsStandardOpen] = useState(false);
  const [isPrintOpen, setIsPrintOpen] = useState(false);
  const [isScanQrOpen, setIsScanQrOpen] = useState(false);
  const [isChooserOpen, setIsChooserOpen] = useState(false);
  const [pendingScanIntent, setPendingScanIntent] = useState(false);
  const [autoOpenScanner, setAutoOpenScanner] = useState(false);
  const [requestType, setRequestType] = useState('Standard Request');
  const [urgency, setUrgency] = useState('');
  const [filed, setFiled] = useState(null);

  /* Location pre-filled from a QR URL deep-link (?qr= param on page load)
     or from an in-app camera scan. */
  const [entryLocation, setEntryLocation] = useState(null);

  const openScanQr = () => {
    openStandard({ autoScan: true });
  };

  /* Header hand-off: screens with a Scan QR button message the intake flow
     to open the Standard Form directly with in-form location scanning active. */
  const requestScan = () => setPendingScanIntent(true);

  const closeScanQr = () => {
    setIsScanQrOpen(false);
    setAutoOpenScanner(false);
  };

  const handleScanSuccess = (scanData) => {
    setIsScanQrOpen(false);
    setAutoOpenScanner(false);
    if (!scanData) return;
    const resolvedEntry = {
      building: scanData.building || '',
      floor: scanData.floor || '',
      room: scanData.room || '',
      location: scanData.location || joinLocation(scanData.building, scanData.floor, scanData.room),
      qrCodeRef: scanData.qrCodeRef || ''
    };
    setEntryLocation(resolvedEntry);
    setIsStandardOpen(true);
  };

  const clearEntryLocation = () => setEntryLocation(null);

  const openStandard = ({ autoScan = false } = {}) => {
    setIsChooserOpen(false);
    setRequestType('Standard Request');
    setAutoOpenScanner(Boolean(autoScan));
    setIsStandardOpen(true);
  };

  // Direct unified intake: clicking New Request opens the Standard Form directly
  // with zero chooser split between Standard and Urgent.
  const openChooser = () => {
    setIsChooserOpen(false);
    openStandard({ autoScan: false });
  };

  const openUrgent = () => {
    setIsChooserOpen(false);
    setRequestType('Standard Request');
    setUrgency('High');
    openStandard({ autoScan: false });
  };

  const closeAll = () => {
    setIsStandardOpen(false);
    setIsPrintOpen(false);
    setIsScanQrOpen(false);
    setIsChooserOpen(false);
    setAutoOpenScanner(false);
    setEntryLocation(null);
  };

  const resetIntake = () => {
    setRequestType('Standard Request');
    setUrgency('');
    setAutoOpenScanner(false);
  };

  /* QR URL deep-link: a ?qr= param was detected on page load and the resolved
     location was parked in DataContext. Directly open the Standard Form with that
     room pre-detected! */
  useEffect(() => {
    if (!pendingScannedLocation) return;
    const loc = pendingScannedLocation;
    setPendingScannedLocation(null);  // consume immediately
    setEntryLocation({
      building: loc.building || '',
      floor: loc.floor || '',
      room: loc.room || '',
      location: joinLocation(loc.building, loc.floor, loc.room),
      qrCodeRef: loc.qrCodeRef || ''
    });
    setRequestType('Standard Request');
    setUrgency('');
    setAutoOpenScanner(false);
    setIsStandardOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingScannedLocation]);

  /* Open the form with in-form scanner active when a header button asked for it */
  useEffect(() => {
    if (!pendingScanIntent) return;
    setPendingScanIntent(false);
    openStandard({ autoScan: true });
  }, [pendingScanIntent]);

  const file = async (payload, { print = false } = {}) => {
    const created = await addRequisition(payload);
    closeAll();
    resetIntake();
    setFiled(created || null);
    if (print) setIsPrintOpen(true);
    if (onFiled) onFiled(created, { print });
    return created;
  };

  const draft = () => ({
    date: todayISO(),
    requestedBy: requesterDisplayName(requester),
    department: requester?.department || office || '',
    building: entryLocation?.building || '',
    floor: entryLocation?.floor || '',
    room: entryLocation?.room || '',
    location: entryLocation?.location || joinLocation(entryLocation?.building, entryLocation?.floor, entryLocation?.room),
    qrCodeRef: entryLocation?.qrCodeRef || '',
    immediateSupervisor: requester?.assignedSupervisor || requester?.supervisorName || requester?.immediateSupervisor || '',
    contactNumber: requester?.phone || '',
    title: '',
    category: '',
    urgency: urgency || 'Low',
    description: '',
    controlNo: null
  });

  const submitStandard = (edited, printAfter = false) => {
    const payload = buildRequisitionPayload({
      form: edited,
      requestType: 'Standard Request',
      urgency: edited.urgency || urgency,
      requester,
      office,
      isDraft: Boolean(edited.isDraft)
    });
    if (payload.isDraft) {
      closeAll();
      resetIntake();
      if (onFiled) onFiled(null, { draft: true });
      return;
    }
    file(payload, { print: printAfter });
  };

  const submitUrgent = (edited, printAfter = false) => {
    const payload = buildRequisitionPayload({
      form: edited,
      requestType: 'Urgent Request',
      urgency: edited.urgency || urgency || 'High',
      requester,
      office,
      isDraft: Boolean(edited.isDraft)
    });
    if (payload.isDraft) {
      closeAll();
      resetIntake();
      if (onFiled) onFiled(null, { draft: true });
      return;
    }
    file(payload, { print: printAfter });
  };

  return {
    requestType,
    urgency,
    setUrgency,
    isStandardOpen,
    isUrgentOpen: false,
    isChooserOpen,
    isPrintOpen,
    isScanQrOpen,
    autoOpenScanner,
    entryLocation,
    clearEntryLocation,
    openScanQr,
    requestScan,
    closeScanQr,
    handleScanSuccess,
    filed,
    buildingIndex: buildBuildingIndex(campusLocations || []),
    requesterName: requesterDisplayName(requester),
    requesterDepartment: requester?.department || office || '',
    openChooser,
    openStandard,
    openUrgent,
    openPrint: () => setIsPrintOpen(true),
    closeAll,
    clearFiled: () => setFiled(null),
    draft,
    submitStandard,
    submitUrgent,
    onTrack
  };
}

/* ---------------------------------------------------------------------------
   RequestIntakeActions — the single header action.
   QR scanning is embedded in Step 1 of the form; no separate header button needed.
   --------------------------------------------------------------------------- */
export const RequestIntakeActions = ({ intake }) => (
  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
    <button
      type="button"
      className="btn btn-primary"
      onClick={intake.openChooser}
      style={{
        padding: '10px 18px',
        borderRadius: '8px',
        background: '#001f9c',
        color: '#ffffff',
        border: 'none',
        fontWeight: '700',
        fontSize: '14px',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px'
      }}
    >
      <Plus size={16} /> New Request
    </button>
  </div>
);

/* ---------------------------------------------------------------------------
   RequestFiledConfirmation — unified, professional confirmation.
   --------------------------------------------------------------------------- */
export const RequestFiledConfirmation = ({ intake, onTrack }) => {
  const rec = intake.filed;
  if (!rec) return null;
  const isPriority = /high|urgent|emergency|critical/i.test(String(rec.urgency || rec.urgency_level || ''));

  return (
    <div className="animate-scale-in" style={{ textAlign: 'center', padding: '36px 16px' }}>
      <div style={{
        width: '68px', height: '68px', borderRadius: '50%',
        background: '#ecfdf5', color: '#059669',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: '16px', border: '2px solid #a7f3d0',
        boxShadow: '0 0 0 8px rgba(16, 185, 129, 0.08)'
      }}>
        <CheckCircle2 size={40} />
      </div>

      <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#0f172a', marginBottom: '8px' }}>
        Job Request Filed Successfully
      </h2>

      <div style={{
        display: 'inline-block', background: '#eff6ff', border: '1px solid #bfdbfe',
        color: '#001f9c', fontWeight: '800', padding: '6px 14px', borderRadius: '8px',
        fontSize: '14px', marginBottom: '12px'
      }}>
        Tracking Reference: {rec.controlNo || rec.id}
      </div>

      {isPriority && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          background: '#fff1f2', border: '1px solid #fecdd3', color: '#991b1b',
          padding: '5px 14px', borderRadius: '9999px', fontSize: '12.5px', fontWeight: '700',
          marginBottom: '16px'
        }}>
          <AlertTriangle size={15} color="#dc2626" />
          High / Urgent Priority — Tagged for expedited triage &amp; dispatch
        </div>
      )}

      <div style={{
        background: '#eff6ff',
        border: '1px solid #bfdbfe',
        borderRadius: '12px', padding: '16px 20px', maxWidth: '580px',
        margin: '0 auto 24px auto', textAlign: 'left', fontSize: '13px', color: '#1e293b'
      }}>
        <div style={{ fontWeight: '800', color: '#1e40af', marginBottom: '8px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <FileText size={16} color="#001f9c" />
          Official Review &amp; Dispatch Process
        </div>
        <ol style={{ margin: 0, paddingLeft: '1.2em', color: '#334155', lineHeight: 1.65 }}>
          <li>Your Immediate Supervisor receives an in-app notification to review and electronically endorse your request.</li>
          <li>The PDAS Director reviews the scope and materials, then forwards it for final campus approval.</li>
          <li>Once approved, a work order is dispatched to maintenance. You will receive in-app notifications upon completion.</li>
        </ol>
        <div style={{ color: '#047857', fontWeight: '700', marginTop: '10px', fontSize: '12.5px' }}>
          All approvals are handled electronically in FixIT. You can view or print the pre-filled official QF-PDAS-DC-01 form anytime.
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-primary" onClick={intake.openPrint}>
          <Printer size={16} />
          Print the official form
        </button>
        {onTrack && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => { intake.clearFiled(); onTrack(); }}
          >
            <Clock size={16} />
            View my requests
          </button>
        )}
        <button type="button" className="btn btn-secondary" onClick={intake.clearFiled}>
          File another request
        </button>
      </div>
    </div>
  );
};

/* ---------------------------------------------------------------------------
   RequestIntakePanel — page panel launcher & status tracking.
   --------------------------------------------------------------------------- */
export const RequestIntakePanel = ({
  intake,
  requesterName,
  department,
  onTrack,
  showLauncher = true
}) => {
  if (intake.filed) {
    return <RequestFiledConfirmation intake={intake} onTrack={onTrack || intake.onTrack} />;
  }
  if (!showLauncher) return null;

  return (
    <>
      <div
        onClick={intake.openStandard}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: '16px', padding: '20px 24px', background: '#eff6ff',
          border: '1.5px solid #bfdbfe', borderRadius: '12px', cursor: 'pointer',
          marginBottom: '16px', transition: 'all 0.15s'
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#93c5fd'; e.currentTarget.style.background = '#e0e7ff'; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#bfdbfe'; e.currentTarget.style.background = '#eff6ff'; }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '12px',
            background: '#001f9c', color: '#ffffff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <FileText size={24} />
          </div>
          <div>
            <div style={{ fontSize: '16px', fontWeight: '800', color: '#001f9c' }}>
              Standard Job Request Form (QF-PDAS-DC-01)
            </div>
            <div style={{ fontSize: '13px', color: '#475569', marginTop: '2px' }}>
              {intake.entryLocation
                ? `Location pre-set to: ${intake.entryLocation.building} — ${intake.entryLocation.room}`
                : 'Click to open and file a comprehensive facility maintenance or repair request.'}
            </div>
          </div>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          style={{ whiteSpace: 'nowrap', padding: '10px 18px', fontWeight: '700' }}
        >
          <Plus size={16} /> File Request
        </button>
      </div>

      <div style={{ background: 'var(--bg-sunken)', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px 20px' }}>
        <div style={{ fontSize: '13px', color: '#475569', marginBottom: '10px' }}>
          Filing as <strong style={{ color: '#0f172a' }}>{requesterName || 'Requester'}</strong>
          {department ? ` · ${department}` : ''}
        </div>
        <div aria-label="Request lifecycle" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11.5px', color: '#94a3b8', marginRight: '2px' }}>After submission:</span>
          {REQUEST_LIFECYCLE.map((s, i, arr) => (
            <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <span style={{
                fontSize: '11px', fontWeight: '500', color: '#64748b',
                background: '#ffffff', border: '1px solid #e2e8f0',
                borderRadius: '9999px', padding: '3px 10px', whiteSpace: 'nowrap'
              }}>
                {i + 1}. {s}
              </span>
              {i < arr.length - 1 && <span aria-hidden="true" style={{ color: '#cbd5e1', fontSize: '10px' }}>→</span>}
            </span>
          ))}
        </div>
      </div>
    </>
  );
};

/* ---------------------------------------------------------------------------
   RequestIntake — the modal host. Mount once per screen.
   --------------------------------------------------------------------------- */
export const RequestIntake = ({ intake, allowActionTaken = false }) => (
  <>
    {intake.isChooserOpen && (
      <Modal
        isOpen={intake.isChooserOpen}
        onClose={intake.closeAll}
        title="New Request"
        maxWidth="560px"
      >
        <div style={{ display: 'grid', gap: '12px' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={intake.openStandard}
            style={{ display: 'flex', alignItems: 'center', gap: '12px', textAlign: 'left', padding: '16px 18px' }}
          >
            <FileText size={20} style={{ color: '#001f9c', flexShrink: 0 }} />
            <span style={{ display: 'block' }}>
              <strong style={{ display: 'block', color: '#0f172a', fontSize: '14px' }}>Standard Request</strong>
              <span style={{ fontSize: '12.5px', color: '#64748b' }}>File the full QF-PDAS-DC-01 job request form.</span>
            </span>
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={intake.openUrgent}
            style={{ display: 'flex', alignItems: 'center', gap: '12px', textAlign: 'left', padding: '16px 18px' }}
          >
            <AlertTriangle size={20} style={{ color: '#b91c1c', flexShrink: 0 }} />
            <span style={{ display: 'block' }}>
              <strong style={{ display: 'block', color: '#0f172a', fontSize: '14px' }}>Report Urgent Issue</strong>
              <span style={{ fontSize: '12.5px', color: '#64748b' }}>Flag an urgent issue for immediate attention.</span>
            </span>
          </button>
        </div>
      </Modal>
    )}

    <JobRequestFormOverlay
      isOpen={intake.isStandardOpen}
      onClose={intake.closeAll}
      initialReq={intake.draft()}
      allowActionTaken={allowActionTaken}
      allowFinalAction={false}
      autoOpenScanner={intake.autoOpenScanner}
      title="Job Request Form (QF-PDAS-DC-01)"
      onSave={(edited) => (
        intake.requestType === 'Urgent Request' ? intake.submitUrgent : intake.submitStandard
      )(edited, false)}
      onSaveAndPrint={(edited) => (
        intake.requestType === 'Urgent Request' ? intake.submitUrgent : intake.submitStandard
      )(edited, true)}
    />

    <QrCodeScannerModal
      isOpen={intake.isScanQrOpen}
      onClose={intake.closeScanQr}
      onScanSuccess={intake.handleScanSuccess}
    />

    <Modal
      isOpen={intake.isPrintOpen}
      onClose={intake.closeAll}
      title="Official PDAS Job Request Form (QF-PDAS-DC-01)"
      maxWidth="760px"
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: '#64748b' }}>
            Control number: {intake.filed?.controlNo || 'PENDING'}
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={intake.closeAll}>
              Close
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => printDocument()}>
              <Printer size={15} /> Print / Save PDF
            </button>
          </div>
        </div>
      }
    >
      {intake.filed && <JobRequestPrintSheet req={intake.filed} />}
    </Modal>

    {intake.filed && (
      <PrintPortal active={intake.isPrintOpen}>
        <JobRequestPrintSheet req={intake.filed} />
      </PrintPortal>
    )}
  </>
);

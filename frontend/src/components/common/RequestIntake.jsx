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
  QrCode,
  Plus
} from 'lucide-react';
import { useData } from '../../context/DataContext';
import { Modal } from './Modal';
import { JobRequestFormOverlay } from './JobRequestFormOverlay';
import { UrgentIssueReport } from './UrgentIssueReport';
import { JobRequestPrintSheet } from './JobRequestPrintSheet';
import { QrCodeScannerModal } from './QrCodeScannerModal';
import { buildBuildingIndex, joinLocation } from './JobRequestLocationStep';
import { buildRequisitionPayload, requesterDisplayName } from '../../utils/jobRequestIntake';

/* The ticket lifecycle, shown as a neutral reference under the launcher. No
   stage is highlighted: before submission no ticket exists, so there is no real
   status to report. The per-ticket tracker on the open-requests list is what
   highlights actual progress. These are the literal status values the rest of
   the app uses, so the reference cannot drift from the workflow. */
export const REQUEST_LIFECYCLE = [
  'Pending',
  'Under Review',
  'Pending Final Approval',
  'Approved',
  'Ongoing',
  'Completed'
];

/* The request date, as a local calendar day. toISOString() is UTC, so for the
   eight hours after midnight at UTC+8 it would stamp a request with the
   PREVIOUS day's date — and this is the date printed on the official
   QF-PDAS-DC-01 form. */
const todayISO = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const launcherCard = (tone) => ({
  display: 'flex', flexDirection: 'column', alignItems: 'center',
  justifyContent: 'center', gap: '12px', padding: '28px 20px',
  background: tone.bg, border: `2px solid ${tone.border}`, borderRadius: '14px',
  cursor: 'pointer', transition: 'all 0.15s', textAlign: 'center',
  onMouseEnter: (e) => { e.currentTarget.style.background = tone.hover; e.currentTarget.style.borderColor = tone.hoverBorder; },
  onMouseLeave: (e) => { e.currentTarget.style.background = tone.bg; e.currentTarget.style.borderColor = tone.border; }
});

/* ---------------------------------------------------------------------------
   useRequestIntake — all of the flow's state in one place, so the header
   buttons, the launcher cards and the dialogs can never disagree.
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
    pendingScanIntent,
    setPendingScanIntent
  } = useData();

  const [isStandardOpen, setIsStandardOpen] = useState(false);
  const [isUrgentOpen, setIsUrgentOpen] = useState(false);
  const [isChooserOpen, setIsChooserOpen] = useState(false);
  const [isEntryScanOpen, setIsEntryScanOpen] = useState(false);
  const [isPrintOpen, setIsPrintOpen] = useState(false);
  const [requestType, setRequestType] = useState('Standard Request');
  const [urgency, setUrgency] = useState('Medium Risk');
  const [filed, setFiled] = useState(null);

  /* The room read by "Scan QR". Location is step 1 of the form and is
     deliberately blank unless chosen or scanned — never guessed — so the tag is
     parked here and folded into the draft the moment the form opens. */
  const [entryLocation, setEntryLocation] = useState(null);

  /* "New Request" opens this first: the two ways to file, and nothing else.
     Picking one swaps the chooser for that form — one overlay at a time. */
  const openChooser = () => setIsChooserOpen(true);

  const openStandard = () => {
    setIsChooserOpen(false);
    setRequestType('Standard Request');
    setUrgency('Medium Risk');
    setIsStandardOpen(true);
  };

  const openUrgent = () => {
    setIsChooserOpen(false);
    setRequestType('Urgent Request');
    setUrgency('High Risk');
    setIsUrgentOpen(true);
  };

  const closeAll = () => {
    setIsStandardOpen(false);
    setIsUrgentOpen(false);
    setIsChooserOpen(false);
    setIsEntryScanOpen(false);
    setIsPrintOpen(false);
    setEntryLocation(null);
  };

  const resetIntake = () => {
    setRequestType('Standard Request');
    setUrgency('Medium Risk');
  };

  /* "Scan QR" opens a SCANNER, not a form. Only the camera comes up; the
     standard form follows once a room has been read, already carrying that
     location. Cancelling the scan leaves the dashboard having started nothing —
     which is the point of not putting the 1240px form on screen behind a 620px
     scanner. */
  useEffect(() => {
    if (!pendingScanIntent) return;
    setPendingScanIntent(false);
    setIsEntryScanOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingScanIntent]);

  /* One scan is the whole hand-off: the camera closes and the form opens with
     the room already filled in. */
  const submitEntryScan = (scanData) => {
    setEntryLocation({
      building: scanData.building,
      floor: scanData.floor,
      room: scanData.room,
      location: joinLocation(scanData.building, scanData.floor, scanData.room)
    });
    setIsEntryScanOpen(false);
    openStandard();
  };

  const file = async (payload, { print = false } = {}) => {
    const created = await addRequisition(payload);
    closeAll();
    resetIntake();
    setFiled(created || null);
    if (print) setIsPrintOpen(true);
    if (onFiled) onFiled(created, { print });
    return created;
  };

  /* A fresh QF-PDAS-DC-01 draft. Location is filled ONLY by the tag read by
     "Scan QR"; otherwise it stays blank, because it is step 1 of the flow and
     must be chosen or scanned, never guessed. */
  const draft = () => ({
    date: todayISO(),
    requestedBy: requesterDisplayName(requester),
    department: requester.department || office || '',
    building: entryLocation?.building || '',
    floor: entryLocation?.floor || '',
    room: entryLocation?.room || '',
    location: entryLocation?.location || '',
    immediateSupervisor: '',
    contactNumber: requester.phone || '',
    title: '',
    category: 'Electrical',
    urgency: requestType === 'Urgent Request' ? 'High Risk' : urgency,
    description: '',
    controlNo: null
  });

  const submitStandard = (edited, printAfter = false) => {
    const payload = buildRequisitionPayload({
      form: edited,
      requestType,
      urgency,
      requester,
      office,
      isDraft: Boolean(edited.isDraft)
    });
    if (payload.isDraft) {
      // A draft is not filed, so it gets no confirmation and no print sheet.
      closeAll();
      resetIntake();
      if (onFiled) onFiled(null, { draft: true });
      return;
    }
    file(payload, { print: printAfter });
  };

  /* Urgent is a fast path: location + hazard type only. The full QF-PDAS-DC-01
     becomes a same-day follow-up task, not a gate. */
  const submitUrgent = (report) =>
    file(
      buildRequisitionPayload({
        form: {
          title: report.issueType,
          description: [report.issueType, report.notes].filter(Boolean).join(' — '),
          building: report.building,
          floor: report.floor,
          room: report.room,
          location: report.location,
          category: 'Urgent Hazard',
          requestedBy: report.requesterName,
          department: report.requesterDepartment
        },
        requestType: 'Urgent Request',
        requester,
        office
      })
    );

  return {
    requestType,
    urgency,
    isStandardOpen,
    isUrgentOpen,
    isChooserOpen,
    isEntryScanOpen,
    isPrintOpen,
    filed,
    buildingIndex: buildBuildingIndex(campusLocations || []),
    requesterName: requesterDisplayName(requester),
    requesterDepartment: requester.department || office || '',
    openChooser,
    openStandard,
    openUrgent,
    /* "Scan QR" parks the intent; the effect above opens the entry scanner, and
       submitEntryScan hands the room on to the form. Identical from any
       dashboard that mounts the host. */
    requestScan: () => setPendingScanIntent(true),
    submitEntryScan,
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
   RequestIntakeActions — the entry pair. Every role gets these two buttons,
   in this order, with these labels.
   --------------------------------------------------------------------------- */
export const RequestIntakeActions = ({ intake }) => (
  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
    {/* Scan QR and New Request — the same pair, in this order, on every
        dashboard. New Request opens the chooser here on the spot; it never
        routes the filer to another module to pick a request type. */}
    <button
      type="button"
      className="btn btn-secondary"
      onClick={intake.requestScan}
      title="Scan the room's QR tag and start a request for that location"
      style={{
        padding: '10px 18px',
        borderRadius: '8px',
        background: '#ffffff',
        color: '#001f9c',
        border: '1px solid #001f9c',
        fontWeight: '700',
        fontSize: '14px',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px'
      }}
    >
      <QrCode size={16} /> Scan QR
    </button>
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
   RequestFiledConfirmation — what every filer sees after submitting.
   --------------------------------------------------------------------------- */
export const RequestFiledConfirmation = ({ intake, onTrack }) => {
  const rec = intake.filed;
  if (!rec) return null;
  const isUrgent = rec.requestType === 'Urgent Request';

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
        Request filed
      </h2>

      <div style={{
        display: 'inline-block', background: '#eff6ff', border: '1px solid #bfdbfe',
        color: '#001f9c', fontWeight: '800', padding: '6px 14px', borderRadius: '8px',
        fontSize: '14px', marginBottom: '12px'
      }}>
        Reference {rec.controlNo || rec.id}
      </div>

      <div style={{
        background: isUrgent ? '#fff1f2' : '#eff6ff',
        border: `1px solid ${isUrgent ? '#fecdd3' : '#bfdbfe'}`,
        borderRadius: '12px', padding: '16px', maxWidth: '580px',
        margin: '0 auto 24px auto', textAlign: 'left', fontSize: '13px', color: '#1e293b'
      }}>
        {isUrgent ? (
          <>
            <div style={{ fontWeight: '800', color: '#9f1239', marginBottom: '6px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertTriangle size={16} color="#dc2626" />
              Urgent alert sent
            </div>
            <div style={{ color: '#881337', lineHeight: 1.6 }}>
              PDAS has been notified. Maintenance is on its way; the target response
              is 2 hours.
              <br /><br />
              Before the end of the day, complete the standard form, have your
              Immediate Supervisor sign it in wet ink, and bring the hardcopy to
              the PDAS office.
            </div>
          </>
        ) : (
          <>
            <div style={{ fontWeight: '800', color: '#1e40af', marginBottom: '6px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FileText size={16} color="#001f9c" />
              What happens next
            </div>
            {/* An ordered list rather than three bold-led sentences. The
                numbering carries the sequence, so the labels do not have to. */}
            <ol style={{ margin: 0, paddingLeft: '1.1em', color: '#334155', lineHeight: 1.6 }}>
              <li>Print the QF-PDAS-DC-01 form.</li>
              <li>Have your Immediate Supervisor sign the hardcopy in wet ink.</li>
              <li>Bring the signed hardcopy to the PDAS office.</li>
            </ol>
            <div style={{ color: '#b91c1c', fontWeight: '700', marginTop: '8px' }}>
              The hardcopy must be signed and checked by PDAS before the work can start.
            </div>
          </>
        )}
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
   RequestChooserCards — the two ways to file, as cards. Rendered by the
   "New Request" chooser and by the page panel, so the choice reads the same
   wherever it was opened. The subtitles under each title stay: they are what
   tells the two options apart at a glance.
   --------------------------------------------------------------------------- */
const RequestChooserCards = ({ intake, style }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', ...style }}>
    <button
      type="button"
      onClick={intake.openStandard}
      style={launcherCard({ bg: '#eff4ff', border: '#bfdbfe', hover: '#dbeafe', hoverBorder: '#93c5fd' })}
    >
      <div style={{
        width: '56px', height: '56px', borderRadius: '14px',
        background: '#001f9c', color: '#ffffff',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        <FileText size={28} />
      </div>
      <div>
        <div style={{ fontSize: '15px', fontWeight: '800', color: '#001f9c' }}>Standard Request</div>
        <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px' }}>
          Scan the room tag or pick the location
        </div>
      </div>
    </button>

    <button
      type="button"
      onClick={intake.openUrgent}
      style={launcherCard({ bg: '#fff1f2', border: '#fecdd3', hover: '#ffe4e6', hoverBorder: '#fda4af' })}
    >
      <div style={{
        width: '56px', height: '56px', borderRadius: '14px',
        background: '#dc2626', color: '#ffffff',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        <AlertTriangle size={28} />
      </div>
      <div>
        <div style={{ fontSize: '15px', fontWeight: '800', color: '#9f1239' }}>Report Urgent Issue</div>
        <div style={{ fontSize: '12px', color: '#7f1d1d', marginTop: '4px' }}>
          Location and type of hazard only
        </div>
      </div>
    </button>
  </div>
);

/* ---------------------------------------------------------------------------
   RequestIntakePanel — the optional page body. The confirmation takes over once
   something has been filed; otherwise it shows the same two cards the
   "New Request" chooser shows, plus the neutral lifecycle reference.
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
      <RequestChooserCards intake={intake} style={{ marginBottom: '16px' }} />

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
    {/* "New Request" lands here: the two ways to file, opened in place. Picking
        one closes this and swaps in that form, so only one overlay is ever up. */}
    <Modal
      isOpen={intake.isChooserOpen}
      onClose={intake.closeAll}
      title="New Request"
      maxWidth="560px"
    >
      <RequestChooserCards intake={intake} />
    </Modal>

    {/* The entry scanner — the ONLY thing "Scan QR" opens. The form follows in
        submitEntryScan, so the 1240px form and the 620px scanner never stand on
        screen together. */}
    <QrCodeScannerModal
      isOpen={intake.isEntryScanOpen}
      onClose={intake.closeAll}
      onScanSuccess={intake.submitEntryScan}
    />

    <JobRequestFormOverlay
      isOpen={intake.isStandardOpen}
      onClose={intake.closeAll}
      initialReq={intake.draft()}
      allowActionTaken={allowActionTaken}
      allowFinalAction={false}
      title={
        intake.requestType === 'Urgent Request'
          ? 'Urgent Request Form (QF-PDAS-DC-01)'
          : 'Job Request Form (QF-PDAS-DC-01)'
      }
      onSave={(edited) => intake.submitStandard(edited, false)}
      onSaveAndPrint={(edited) => intake.submitStandard(edited, true)}
    />

    <UrgentIssueReport
      isOpen={intake.isUrgentOpen}
      onClose={intake.closeAll}
      onSubmit={intake.submitUrgent}
      buildingIndex={intake.buildingIndex}
      requesterName={intake.requesterName}
      requesterDepartment={intake.requesterDepartment}
    />

    <Modal
      isOpen={intake.isPrintOpen}
      onClose={intake.closeAll}
      title="Official PDAS Job Request Form (QF-PDAS-DC-01)"
      maxWidth="760px"
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: '#64748b' }}>
            Control number (issued when the work order is assigned, after final approval): {intake.filed?.controlNo || 'PENDING'}
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={intake.closeAll}>
              Close
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => window.print()}>
              <Printer size={15} /> Print / Save PDF
            </button>
          </div>
        </div>
      }
    >
      {intake.filed && <JobRequestPrintSheet req={intake.filed} />}
    </Modal>

    {intake.filed && intake.isPrintOpen && (
      <div className="jr-print-only" aria-hidden="true">
        <JobRequestPrintSheet req={intake.filed} />
      </div>
    )}
  </>
);

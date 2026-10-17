import React, { useState, useEffect } from 'react';
import isatuLogo from '../../assets/isatu-logo.png';
import { SCOPE_SECTIONS } from '../../utils/jobRequestIntake';
import { PDAS_HEAD_TITLE, APPROVER_TITLE, signatoryName, approvalStamp, formatGovTimestamp } from '../../utils/approvalSignatures';
import { useData } from '../../context/DataContext';

// Print-safe QF-PDAS-DC-01 sheet. Simple, aligned, black-and-white.
// Used inside a .print-only wrapper so window.print() outputs only this sheet.
export const JobRequestPrintSheet = ({ req, customConfig = null }) => {
  const { formTemplateConfig } = useData() || {};
  const tpl = customConfig || formTemplateConfig || {};
  const [qrUrl, setQrUrl] = useState('');
  const tracking = req?.controlNo || 'PENDING, issued when the work order is assigned';

  // Verification QR for the printed hardcopy. The payload MUST match the one
  // the server embeds in the DOCX/PDF (docxJobRequestGenerator.js) or a scanned
  // QR resolves differently depending on which output it came from.
  useEffect(() => {
    if (!req) return;
    let live = true;
    const payload = `FIXIT-REQ:${tracking}`;
    import('qrcode')
      .then((m) => (m.default || m).toDataURL(payload, { width: 96, margin: 1 }))
      .then((url) => { if (live) setQrUrl(url); })
      .catch(() => {});
    return () => { live = false; };
  }, [req, tracking]);

  if (!req) return null;
  const scope = req.scopeOfWorks || {};
  const actionTaken = req.actionTaken || {};
  const finalAction = req.finalAction || {};

  /* Signatories. A personal name is printed only when the form or the database
     actually recorded one; otherwise the line stays blank for wet ink and the
     stamp is suppressed entirely. */
  const pdasSignatory = signatoryName(actionTaken.pdasHeadName, req.pdasHeadName);
  const pdasStamp = approvalStamp(actionTaken.pdasHeadName, req.pdasHeadName);
  // Show stamp ONLY when that specific approver has actually clicked Approve.
  // Status-based fallbacks are intentionally removed — they caused stamps to
  // appear for approvers who had not yet acted on the request.
  const pdasApproved = Boolean(req.adminApproved);
  const approverSignatory = signatoryName(finalAction.approverName, req.approverName);
  const approverStamp = approvalStamp(finalAction.approverName, req.approverName);
  const approverApproved = Boolean(req.campusAdminApproved);

  const hasOpt = (key, opt) => {
    const sec = scope[key];
    if (sec?.options && Array.isArray(sec.options) && sec.options.length > 0) {
      return sec.options.includes(opt);
    }
    const catMap = {
      drawingDesign: 'Drawing/Design',
      physicalStructures: 'Physical Structures',
      electrical: 'Electrical',
      mechanical: 'Mechanical',
      waterSanitary: 'Water/Sanitary',
      airConditioning: 'Air Conditioning'
    };
    if (req.category === catMap[key]) {
      if (!sec || !sec.options || sec.options.length === 0) {
        return opt === 'Rehabilitation/Repair' || opt === 'Repair' || opt === 'Floor Plans' || opt === 'Perspective';
      }
    }
    return false;
  };
  const descOf = (key) => scope[key]?.description || '';
  const compliedOf = (key) => scope[key]?.dateComplied || '';

  const cell = { border: '1px solid #000', padding: '5px 7px', fontSize: '11px', verticalAlign: 'top' };
  const fontFamily = tpl.fontFamily === 'sans'
    ? "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    : '"Times New Roman", Times, serif';

  return (
    <div className="jr-print-sheet" style={{ background: '#fff', color: '#000', fontFamily, width: '100%' }}>
      {/* Header */}
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1.5px solid #000', marginBottom: '10px' }}>
        <tbody>
          <tr>
            <td style={{ ...cell, width: '72px', textAlign: 'center' }}>
              <img
                src={tpl.customLogoUrl || isatuLogo}
                alt="Logo"
                style={{ width: '52px', height: '52px', objectFit: 'contain' }}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            </td>
            <td style={{ ...cell, textAlign: 'center' }}>
              <div style={{ fontSize: '10px', textTransform: 'uppercase' }}>{tpl.republicLine || 'Republic of the Philippines'}</div>
              <div style={{ fontSize: '13px', fontWeight: 'bold' }}>{tpl.institutionName || 'ILOILO SCIENCE AND TECHNOLOGY UNIVERSITY'}</div>
              <div style={{ fontSize: '11px', fontWeight: 'bold' }}>{tpl.campusName || 'DUMANGAS CAMPUS'}</div>
              <div style={{ fontSize: '9px' }}>{tpl.campusAddress || 'P.D. Monfort South, Dumangas, Iloilo'}</div>
              <div style={{ fontSize: '12px', fontWeight: 'bold', marginTop: '3px' }}>{tpl.documentTitle || 'JOB REQUEST FOR REPAIR, MAINTENANCE AND CONSTRUCTION'}</div>
            </td>
            <td style={{ width: '190px', padding: 0, verticalAlign: 'top' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                <tbody>
                  <tr><td style={{ ...cell, fontWeight: 'bold' }}>{tpl.department || 'Department: PDAS'}</td></tr>
                  <tr><td style={cell}>Document Code: <strong>{tpl.documentCode || 'QF-PDAS-DC-01'}</strong></td></tr>
                  <tr><td style={cell}>Revision: {tpl.revisionNo || '00'}<br />Effective Date: {tpl.effectiveDate || 'February 3, 2025'}</td></tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Meta */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10px', fontSize: '11.5px' }}>
        <tbody>
          <tr>
            <td style={{ padding: '3px 0', width: '55%', verticalAlign: 'top' }}>
              <strong>{tpl.trackingLabel || 'Tracking Number:'}</strong> <u><strong>{tracking}</strong></u>
            </td>
            <td style={{ padding: '3px 0', width: '45%', verticalAlign: 'top' }}>
              <strong>{tpl.dateLabel || 'Date of Request:'}</strong> <u>{req.date || ''}</u>
            </td>
          </tr>
          <tr>
            <td style={{ padding: '3px 0', verticalAlign: 'top' }}>
              <strong>{tpl.clientNameLabel || 'Name of Client:'}</strong> <u>{req.requestedBy || ''}</u>
              {req.requesterApproved && (
                <div style={{ color: '#002699', fontWeight: 'bold', fontSize: '10px', fontStyle: 'italic', marginTop: '2px' }}>
                  ✓ Electronically signed: {req.requestedBy || 'Requester'}{req.requesterApprovedAt ? ` on ${formatGovTimestamp(req.requesterApprovedAt)}` : ''}
                </div>
              )}
            </td>
            <td style={{ padding: '3px 0', verticalAlign: 'top' }}></td>
          </tr>
          <tr>
            <td style={{ padding: '3px 0', verticalAlign: 'top' }}>
              <strong>{tpl.clientOfficeLabel || 'Office of Client:'}</strong> <u>{req.department || req.office || ''}</u>
            </td>
            <td style={{ padding: '3px 0', verticalAlign: 'top' }}>
              {req.location && (
                <span><strong>{tpl.locationLabel || 'Location:'}</strong> <u>{req.location}</u></span>
              )}
            </td>
          </tr>
          <tr>
            <td style={{ padding: '3px 0', verticalAlign: 'top' }}>
              <strong>{tpl.supervisorLabel || 'Immediate Supervisor:'}</strong> <u>{req.immediateSupervisor || ''}</u>
              {req.supervisorApproved && (
                <div style={{ color: '#002699', fontWeight: 'bold', fontSize: '10px', fontStyle: 'italic', marginTop: '2px' }}>
                  ✓ Electronically approved: {req.immediateSupervisor || 'Immediate Supervisor'}{req.supervisorApprovedAt ? ` on ${formatGovTimestamp(req.supervisorApprovedAt)}` : ''}
                </div>
              )}
            </td>
            <td style={{ padding: '3px 0', verticalAlign: 'top' }}></td>
          </tr>
          {req.contactNumber && (
            <tr>
              <td colSpan={2} style={{ padding: '3px 0', verticalAlign: 'top' }}>
                <strong>Contact:</strong> <u>{req.contactNumber}</u>
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div style={{ border: '1.5px solid #000', textAlign: 'center', fontWeight: 'bold', fontSize: '11px', padding: '3px' }}>AREAS / SCOPE OF WORKS</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1.5px solid #000', borderTop: 'none', marginBottom: '10px' }}>
        <tbody>
          {[0, 2, 4].map(row => (
            <tr key={row}>
              {[SCOPE_SECTIONS[row], SCOPE_SECTIONS[row + 1]].map((sec, i) => (
                <td key={sec.key} style={{ ...cell, width: '50%', borderRight: i === 0 ? '1.5px solid #000' : undefined }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '3px' }}>{sec.label}</div>
                  {sec.options.map(opt => (
                    <div key={opt} style={{ fontSize: '10.5px' }}>[{hasOpt(sec.key, opt) ? 'x' : ' '}] {opt}</div>
                  ))}
                  <div style={{ fontSize: '10.5px', marginTop: '3px' }}><strong>Description:</strong> {descOf(sec.key) || (req.category && sec.label.includes(req.category.split('/')[0].toUpperCase()) ? req.description : '') || '—'}</div>
                  <div style={{ fontSize: '10.5px' }}><strong>Date Complied:</strong> {compliedOf(sec.key) || '—'}</div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Action Taken */}
      <div style={{ border: '1.5px solid #000', padding: '6px 8px', marginBottom: '10px', fontSize: '11px' }}>
        <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>ACTION TAKEN:</div>
        <div>[{actionTaken.endorsedDesignTeam?.checked ? 'x' : ' '}] <strong>Endorsed to Design Team</strong> — [{actionTaken.endorsedDesignTeam?.detailedPlan ? 'x' : ' '}] Detailed Plan [{actionTaken.endorsedDesignTeam?.powBoq ? 'x' : ' '}] POW & BOQ &nbsp; Received by: <u>{actionTaken.endorsedDesignTeam?.receivedBy || '__________'}</u> Date: <u>{actionTaken.endorsedDesignTeam?.date || '____'}</u></div>
        <div>[{actionTaken.endorsedGSMHead?.checked ? 'x' : ' '}] <strong>Endorsed to GSM Head for Work Order</strong> &nbsp; Received by: <u>{actionTaken.endorsedGSMHead?.receivedBy || req.assignedTo || '__________'}</u> Date: <u>{actionTaken.endorsedGSMHead?.date || req.date || '____'}</u></div>
        <div>[{actionTaken.returnedToClient?.checked ? 'x' : ' '}] <strong>Returned to Client</strong> — {actionTaken.returnedToClient?.reason || 'Request cannot be done / PR / JR as per remarks'} &nbsp; Remarks: <u>{actionTaken.returnedToClient?.remarks || req.notes || 'None'}</u></div>
        <div style={{ textAlign: 'center', marginTop: '10px' }}>
          <div style={{ fontWeight: 'bold' }}><u>{pdasSignatory}</u></div>
          <div style={{ fontSize: '10px' }}>{tpl.pdasHeadTitle || PDAS_HEAD_TITLE}</div>
          {pdasApproved && pdasStamp && (
            <div style={{ color: '#002699', fontWeight: 'bold', fontSize: '10px', fontStyle: 'italic', marginTop: '3px' }}>
              ✓ Electronically approved: {pdasStamp}{req.adminApprovedAt ? ` on ${formatGovTimestamp(req.adminApprovedAt)}` : ''}
            </div>
          )}
        </div>
      </div>

      {/* Optional Defect Photo Reference */}
      {tpl.showDefectPhoto && req.photoUrl && (
        <div style={{ border: '1px solid #000', padding: '6px 8px', marginBottom: '10px', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src={req.photoUrl} alt="Defect" style={{ width: '56px', height: '56px', objectFit: 'cover', border: '1px solid #000' }} />
          <div>
            <strong>Attached Visual Defect Reference:</strong> {req.photoName || 'Client Photo Evidence'}
          </div>
        </div>
      )}

      {/* Final Action */}
      <div style={{ border: '1.5px solid #000', padding: '6px 8px', fontSize: '11px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
          <div><strong>FINAL ACTION:</strong> [{finalAction.status === 'Approved' || ['Approved', 'Ongoing', 'Completed'].includes(req.status) ? 'x' : ' '}] Approved [{finalAction.status === 'Disapproved' || req.status === 'Rejected' || req.status === 'Returned' ? 'x' : ' '}] Disapproved</div>
          <div>Remarks: <u>{finalAction.remarks || 'N/A'}</u></div>
        </div>
        <div style={{ textAlign: 'center', marginTop: '10px' }}>
          <div style={{ fontWeight: 'bold' }}><u>{approverSignatory}</u></div>
          <div style={{ fontSize: '10px' }}>{tpl.approverTitle || APPROVER_TITLE}</div>
          {approverApproved && approverStamp && (
            <div style={{ color: '#002699', fontWeight: 'bold', fontSize: '10px', fontStyle: 'italic', marginTop: '3px' }}>
              ✓ Electronically approved: {approverStamp}{req.campusAdminApprovedAt ? ` on ${formatGovTimestamp(req.campusAdminApprovedAt)}` : ''}
            </div>
          )}
        </div>
        <div style={{ fontSize: '9px', textAlign: 'right', marginTop: '6px' }}>{tpl.copyDistribution || 'Copy distribution: 1 – PDAS, 1 – GSM, 1 – Client'}</div>
        <div style={{ fontSize: '8.5px', marginTop: '6px', paddingTop: '5px', borderTop: '1px dashed #000', color: '#334155', fontStyle: 'italic', textAlign: 'center', lineHeight: 1.35 }}>
          <strong>Notice / Disclaimer:</strong> {tpl.disclaimerNotice || 'The electronic approvals recorded on this form are internal, timestamped, auditable administrative confirmations and do not constitute legally binding digital signatures. This official document is automatically generated and archived for university facility audit, inventory, and official printing.'}
        </div>
      </div>

      {/* Verification strip — scan the hardcopy to check it against the record */}
      {tpl.showVerificationQr !== false && qrUrl && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', border: '1px solid #000', padding: '5px 8px' }}>
          <img src={qrUrl} alt="Verification QR" style={{ width: '56px', height: '56px' }} />
          <div style={{ fontSize: '10px', lineHeight: 1.5 }}>
            <div><strong>Verify this form:</strong> {tpl.verificationText || `scan to check tracking ${tracking} against the PDAS record.`}</div>
            <div>{tpl.documentCode || 'QF-PDAS-DC-01'} • {tpl.campusName || 'ISAT U Dumangas Campus'}</div>
          </div>
        </div>
      )}
    </div>
  );
};

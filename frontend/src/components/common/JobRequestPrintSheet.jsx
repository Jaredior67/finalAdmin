import React from 'react';

import isatuLogo from '../../assets/isatu-logo.png';
import { SCOPE_SECTIONS } from '../../utils/jobRequestIntake';
import { PDAS_HEAD_NAME, CAMPUS_ADMIN_NAME, PDAS_HEAD_TITLE, APPROVER_TITLE, approvalStamp, formatGovTimestamp, formatDateMDY } from '../../utils/approvalSignatures';
import { useData } from '../../context/DataContext';

// Official Print-safe QF-PDAS-DC-01 sheet.
// Matches the official university document standard (ISAT U Dumangas Campus).
export const JobRequestPrintSheet = ({ req, customConfig = null }) => {
  const { formTemplateConfig } = useData() || {};
  const tpl = customConfig || formTemplateConfig || {};
  const tracking = req?.controlNo || req?.ticket_no || req?.id || 'PENDING, issued when the work order is assigned';



  if (!req) return null;
  const scope = req.scopeOfWorks || {};
  const actionTaken = req.actionTaken || {};
  const finalAction = req.finalAction || {};

  /* Approval stamps — only rendered when the database recorded an actual approval. */
  const pdasStamp = approvalStamp(actionTaken.pdasHeadName, req.pdasHeadName);
  const pdasApproved = Boolean(req.adminApproved);
  const approverStamp = approvalStamp(finalAction.approverName, req.approverName);
  const approverApproved = Boolean(req.campusAdminApproved);

  // Immediate supervisor display name & electronic approval resolution
  const resolveSupervisorName = (sup, fallback) => {
    if (!sup) return '';
    const clean = String(sup).trim();
    if (clean.includes('@')) {
      if (/campusadmin|admin/i.test(clean)) {
        return fallback || 'Dr. Ramil G. Lumauag';
      }
      return fallback || clean.split('@')[0];
    }
    return clean;
  };
  const supervisorDisplay = resolveSupervisorName(req.immediateSupervisor, req.requestedBy);
  const isSupervisorElectronicallyApproved = Boolean(
    req.supervisorApproved ||
    (req.campusAdminApproved && ['Approved', 'Ongoing', 'Completed', 'On Hold'].includes(req.status) &&
      (req.immediateSupervisor === req.requestedBy || /campusadmin|lumauag/i.test(req.immediateSupervisor || '') || /campusadmin|lumauag/i.test(req.requestedBy || '')))
  );
  const supervisorApprovalDate = req.supervisorApprovedAt || req.campusAdminApprovedAt || req.requesterApprovedAt;

  const hasOpt = (key, opt) => {
    // 1. Direct match in scope[key].options
    const sec = scope[key];
    if (sec?.options && Array.isArray(sec.options) && sec.options.length > 0) {
      if (sec.options.some(o => String(o).trim().toLowerCase() === String(opt).trim().toLowerCase())) {
        return true;
      }
    }

    // 2. Identify trade category from category or title/description
    const cat = String(req.category || '').toLowerCase();
    const titleDesc = `${String(req.title || '')} ${String(req.description || '')} ${String(req.notes || '')}`.toLowerCase();

    const isKeyTrade =
      (key === 'electrical' && (cat.includes('elect') || titleDesc.includes('elect') || titleDesc.includes('wire') || titleDesc.includes('wiring') || titleDesc.includes('outlet') || titleDesc.includes('light') || titleDesc.includes('breaker') || titleDesc.includes('spark') || titleDesc.includes('switch') || titleDesc.includes('power') || titleDesc.includes('circuit'))) ||
      (key === 'airConditioning' && (cat.includes('air') || cat.includes('ac') || cat.includes('cooling') || titleDesc.includes('aircon') || titleDesc.includes('ac ') || titleDesc.includes('inverter') || titleDesc.includes('cooling') || titleDesc.includes('hvac'))) ||
      (key === 'mechanical' && (cat.includes('mech') || titleDesc.includes('engine') || titleDesc.includes('machine') || titleDesc.includes('pump') || titleDesc.includes('motor') || titleDesc.includes('generator'))) ||
      (key === 'waterSanitary' && (cat.includes('water') || cat.includes('plumb') || cat.includes('sanitary') || titleDesc.includes('pipe') || titleDesc.includes('faucet') || titleDesc.includes('leak') || titleDesc.includes('drain') || titleDesc.includes('toilet') || titleDesc.includes('sink') || titleDesc.includes('clog'))) ||
      (key === 'physicalStructures' && (cat.includes('phys') || cat.includes('struct') || cat.includes('carpentr') || titleDesc.includes('door') || titleDesc.includes('window') || titleDesc.includes('roof') || titleDesc.includes('ceiling') || titleDesc.includes('wall') || titleDesc.includes('tile') || titleDesc.includes('desk') || titleDesc.includes('chair') || titleDesc.includes('floor') || titleDesc.includes('masonry'))) ||
      (key === 'drawingDesign' && (cat.includes('draw') || cat.includes('design') || cat.includes('plan') || titleDesc.includes('blueprint') || titleDesc.includes('cad') || titleDesc.includes('drawing')));

    if (isKeyTrade) {
      if (sec?.options && Array.isArray(sec.options) && sec.options.length > 0) {
        return sec.options.some(o => String(o).trim().toLowerCase() === String(opt).trim().toLowerCase());
      }
      const isInstallation = /install|new /i.test(titleDesc);
      const isRehab = /rehab|renovat/i.test(titleDesc);

      if (opt === 'Repair' || opt === 'Rehabilitation/Repair') {
        return !isInstallation || /repair|fix|broken|defective|damaged|troubleshoot|spark|leak|burnt|replace/i.test(titleDesc);
      }
      if (opt === 'New Installation' || opt === 'New Structure') {
        return isInstallation;
      }
      if (opt === 'Rehabilitation' || opt === 'Renovation') {
        return isRehab;
      }
      if (opt === 'Floor Plans' || opt === 'Perspective') {
        return key === 'drawingDesign';
      }
    }
    return false;
  };

  const descOf = (key) => {
    if (scope[key]?.description) return scope[key].description;
    const cat = String(req.category || '').toLowerCase();
    const titleDesc = `${String(req.title || '')} ${String(req.description || '')}`.toLowerCase();
    const matchesTrade =
      (key === 'electrical' && (cat.includes('elect') || titleDesc.includes('elect') || titleDesc.includes('wire') || titleDesc.includes('outlet') || titleDesc.includes('light') || titleDesc.includes('spark'))) ||
      (key === 'airConditioning' && (cat.includes('air') || cat.includes('ac') || titleDesc.includes('aircon') || titleDesc.includes('cooling'))) ||
      (key === 'mechanical' && (cat.includes('mech') || titleDesc.includes('engine') || titleDesc.includes('machine') || titleDesc.includes('pump') || titleDesc.includes('motor'))) ||
      (key === 'waterSanitary' && (cat.includes('water') || cat.includes('plumb') || titleDesc.includes('pipe') || titleDesc.includes('faucet') || titleDesc.includes('leak'))) ||
      (key === 'physicalStructures' && (cat.includes('phys') || cat.includes('struct') || titleDesc.includes('door') || titleDesc.includes('roof') || titleDesc.includes('wall') || titleDesc.includes('window'))) ||
      (key === 'drawingDesign' && (cat.includes('draw') || cat.includes('design')));
    return matchesTrade ? (req.description || '') : '';
  };

  const compliedOf = (key) => {
    if (scope[key]?.dateComplied) return scope[key].dateComplied;
    if (req.status === 'Completed' && descOf(key)) {
      return (req.completed_at || req.completedAt || req.date || '').slice(0, 10);
    }
    return '';
  };

  const cell = { border: '1px solid #000', padding: '4px 6px', fontSize: '10.5px', verticalAlign: 'top' };
  const fontFamily = tpl.fontFamily === 'sans'
    ? "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif"
    : '"Times New Roman", Times, serif';

  return (
    <div
      className="jr-print-sheet"
      style={{
        background: '#ffffff',
        color: '#000000',
        fontFamily,
        width: '100%',
        maxWidth: '780px',
        margin: '0 auto',
        border: '1.5px solid #000000',
        padding: '20px 24px',
        boxSizing: 'border-box',
        fontSize: '11px',
        lineHeight: 1.35
      }}
    >
      {/* 1. Header Box */}
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1.5px solid #000', tableLayout: 'fixed', marginBottom: '12px' }}>
        <tbody>
          <tr>
            <td style={{ ...cell, width: '70px', textAlign: 'center', borderRight: '1.5px solid #000' }}>
              <img
                src={tpl.customLogoUrl || isatuLogo}
                alt="Logo"
                style={{
                  width: `${tpl.logoWidth || 50}px`,
                  height: `${tpl.logoWidth || 50}px`,
                  objectFit: 'contain',
                  transform: tpl.logoOffsetX || tpl.logoOffsetY ? `translate(${tpl.logoOffsetX || 0}px, ${tpl.logoOffsetY || 0}px)` : 'none'
                }}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            </td>
            <td style={{ ...cell, textAlign: 'center', borderRight: '1.5px solid #000', padding: '6px 8px' }}>
              <div style={{ fontSize: '9.5px', textTransform: 'uppercase', letterSpacing: '0.02em' }}>{tpl.republicLine || 'Republic of the Philippines'}</div>
              <div style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>{tpl.institutionName || 'ILOILO SCIENCE AND TECHNOLOGY UNIVERSITY'}</div>
              <div style={{ fontSize: '10.5px', fontWeight: 'bold', textTransform: 'uppercase' }}>{tpl.campusName || 'DUMANGAS CAMPUS'}</div>
              <div style={{ fontSize: '9px' }}>{tpl.campusAddress || 'P.D. Monfort South, Dumangas, Iloilo'}</div>
              <div style={{ fontSize: '11.5px', fontWeight: 'bold', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.01em' }}>
                {tpl.documentTitle || 'JOB REQUEST FOR REPAIR, MAINTENANCE AND CONSTRUCTION'}
              </div>
            </td>
            <td style={{ width: '190px', padding: 0, verticalAlign: 'top' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9.5px', tableLayout: 'fixed' }}>
                <tbody>
                  <tr><td style={{ ...cell, borderTop: 'none', borderRight: 'none', borderLeft: 'none', fontWeight: 'bold' }}>Department: PDAS</td></tr>
                  <tr><td style={{ ...cell, borderRight: 'none', borderLeft: 'none' }}>Document Code: <strong>{tpl.documentCode || 'QF-PDAS-DC-01'}</strong></td></tr>
                  <tr><td style={{ ...cell, borderRight: 'none', borderLeft: 'none' }}>Revision Number: {tpl.revisionNo || '00'}</td></tr>
                  <tr><td style={{ ...cell, borderBottom: 'none', borderRight: 'none', borderLeft: 'none' }}>Effective Date: {tpl.effectiveDate || 'February 3, 2025'}</td></tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>

      {/* 2. Meta Requester Fields */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10px', fontSize: '11px', lineHeight: '1.5', tableLayout: 'fixed' }}>
        <tbody>
          <tr>
            <td style={{ padding: '2px 0', width: '60%', verticalAlign: 'middle' }}>
              <div>
                <div><strong>Tracking Number:</strong> <span style={{ textDecoration: 'underline', fontWeight: 'bold' }}>{tracking}</span></div>
              </div>
            </td>
            <td style={{ padding: '2px 0', width: '40%', verticalAlign: 'middle', textAlign: 'right' }}>
              <strong>Date of Request:</strong> <span style={{ textDecoration: 'underline' }}>{req.date ? formatDateMDY(req.date) : '________________________'}</span>
            </td>
          </tr>
          <tr>
            <td colSpan={2} style={{ padding: '2px 0', verticalAlign: 'top' }}>
              <strong>Name of Client:</strong> <span style={{ textDecoration: 'underline' }}>{req.requestedBy || '________________________________________________'}</span>
              {req.requesterApproved && (
                <div style={{ color: '#1e40af', fontWeight: '600', fontSize: '9px', paddingLeft: '2px', marginTop: '1px' }}>
                  ✓ Electronically signed: {req.requestedBy || 'Requester'}{req.requesterApprovedAt ? ` on ${formatGovTimestamp(req.requesterApprovedAt)}` : ''}
                </div>
              )}
            </td>
          </tr>
          <tr>
            <td colSpan={2} style={{ padding: '2px 0', verticalAlign: 'top' }}>
              <strong>Office of Client:</strong> <span style={{ textDecoration: 'underline' }}>{req.location || req.department || req.office || '________________________________________________'}</span>
            </td>
          </tr>
          <tr>
            <td colSpan={2} style={{ padding: '2px 0', verticalAlign: 'top' }}>
              <strong>Immediate Supervisor:</strong> <span style={{ textDecoration: 'underline' }}>{supervisorDisplay || '________________________________________________'}</span>
              {isSupervisorElectronicallyApproved && (
                <div style={{ color: '#1e40af', fontWeight: '600', fontSize: '9px', paddingLeft: '2px', marginTop: '1px' }}>
                  ✓ Electronically signed: {supervisorDisplay || 'Immediate Supervisor'}{supervisorApprovalDate ? ` on ${formatGovTimestamp(supervisorApprovalDate)}` : ''}
                </div>
              )}
            </td>
          </tr>
        </tbody>
      </table>

      {/* 3. Areas / Scope of Works Header */}
      <div style={{
        border: '1.5px solid #000',
        background: 'var(--bg-sunken)',
        textAlign: 'center',
        fontWeight: 'bold',
        fontSize: '11px',
        padding: '3px 0',
        letterSpacing: '0.04em'
      }}>
        AREAS / SCOPE OF WORKS
      </div>

      {/* 4. 2-Column Scope of Works Table: Left [1, 3, 5], Right [2, 4, 6] */}
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1.5px solid #000', borderTop: 'none', marginBottom: '10px', tableLayout: 'fixed' }}>
        <tbody>
          {[0, 2, 4].map(row => {
            const leftSec = SCOPE_SECTIONS[row];
            const rightSec = SCOPE_SECTIONS[row + 1];
            return (
              <tr key={row}>
                {/* Left Trade Column */}
                <td style={{ ...cell, width: '50%', borderRight: '1.5px solid #000', padding: '6px 8px' }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '3px', textTransform: 'uppercase' }}>{leftSec.label}</div>
                  <div style={{ paddingLeft: '8px' }}>
                    {leftSec.options.map(opt => (
                      <div key={opt} style={{ fontSize: '10px', lineHeight: 1.35, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span>[{hasOpt(leftSec.key, opt) ? '✓' : ' '}]</span>
                        <span>{opt}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: '10px', marginTop: '4px' }}>
                    <strong>Description of Work:</strong> <span style={{ textDecoration: 'underline' }}>{descOf(leftSec.key) || '____________________'}</span>
                  </div>
                  <div style={{ fontSize: '10px', marginTop: '2px' }}>
                    <strong>Date Complied:</strong> <span style={{ textDecoration: 'underline' }}>{compliedOf(leftSec.key) || '____________________'}</span>
                  </div>
                </td>

                {/* Right Trade Column */}
                <td style={{ ...cell, width: '50%', padding: '6px 8px' }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '3px', textTransform: 'uppercase' }}>{rightSec.label}</div>
                  <div style={{ paddingLeft: '8px' }}>
                    {rightSec.options.map(opt => (
                      <div key={opt} style={{ fontSize: '10px', lineHeight: 1.35, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span>[{hasOpt(rightSec.key, opt) ? '✓' : ' '}]</span>
                        <span>{opt}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: '10px', marginTop: '4px' }}>
                    <strong>Description of Work:</strong> <span style={{ textDecoration: 'underline' }}>{descOf(rightSec.key) || '____________________'}</span>
                  </div>
                  <div style={{ fontSize: '10px', marginTop: '2px' }}>
                    <strong>Date Complied:</strong> <span style={{ textDecoration: 'underline' }}>{compliedOf(rightSec.key) || '____________________'}</span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* 5. ACTION TAKEN Section */}
      <div style={{ border: '1.5px solid #000', padding: '7px 10px', marginBottom: '10px', fontSize: '10.5px' }}>
        <div style={{ fontWeight: 'bold', marginBottom: '6px', textTransform: 'uppercase' }}>ACTION TAKEN:</div>

        {/* Option 1: Endorsed to Design Team */}
        <div style={{ marginBottom: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '4px' }}>
            <div style={{ fontWeight: 'bold' }}>
              [{actionTaken.endorsedDesignTeam?.checked ? '✓' : ' '}] Endorsed to Design Team for preparations of:
            </div>
            <div>
              Received by: <span style={{ textDecoration: 'underline' }}>{actionTaken.endorsedDesignTeam?.receivedBy || '________________________'}</span> &nbsp;&nbsp; Date: <span style={{ textDecoration: 'underline' }}>{actionTaken.endorsedDesignTeam?.date ? formatDateMDY(actionTaken.endorsedDesignTeam.date) : '__________'}</span>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '4px' }}>
            <div style={{ paddingLeft: '22px', fontSize: '10px' }}>
              <div>[{actionTaken.endorsedDesignTeam?.detailedPlan ? '✓' : ' '}] Detailed Plan</div>
              <div>[{actionTaken.endorsedDesignTeam?.powBoq ? '✓' : ' '}] Program of Works and Bill of Quantities</div>
            </div>
            <div style={{ fontSize: '9px', color: '#475569', textAlign: 'center', width: '220px', borderTop: '1px solid #555', paddingTop: '1px' }}>
              Name and Signature
            </div>
          </div>
        </div>

        {/* Option 2: Endorsed to GSM Head */}
        <div style={{ marginBottom: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '4px' }}>
            <div style={{ fontWeight: 'bold' }}>
              [{actionTaken.endorsedGSMHead?.checked || Boolean(req.assignedTo || req.assignedToId || req.assigned_to) || ['Ongoing', 'Completed'].includes(req.status) ? '✓' : ' '}] Endorsed to GSM Head for issuance of Work Order
            </div>
            <div>
              Received by: <span style={{ textDecoration: 'underline' }}>{actionTaken.endorsedGSMHead?.receivedBy || req.assignedTo || '________________________'}</span> &nbsp;&nbsp; Date: <span style={{ textDecoration: 'underline' }}>{actionTaken.endorsedGSMHead?.date ? formatDateMDY(actionTaken.endorsedGSMHead.date) : (req.date ? formatDateMDY(req.date) : '__________')}</span>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ fontSize: '9px', color: '#475569', textAlign: 'center', width: '220px', borderTop: '1px solid #555', paddingTop: '1px' }}>
              Name and Signature
            </div>
          </div>
        </div>

        {/* Option 3: Returned to Client — filled by PDAS Head / System Administrator */}
        <div style={{ marginBottom: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '4px' }}>
            <div style={{ fontWeight: 'bold' }}>
              [{actionTaken.returnedToClient?.checked || req.status === 'Returned' ? '✓' : ' '}] Returned to Client for:
            </div>
            <div>
              Received by: <span style={{ textDecoration: 'underline' }}>{actionTaken.returnedToClient?.receivedBy || '________________________'}</span> &nbsp;&nbsp; Date: <span style={{ textDecoration: 'underline' }}>{actionTaken.returnedToClient?.date ? formatDateMDY(actionTaken.returnedToClient.date) : '__________'}</span>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '4px' }}>
            <div style={{ paddingLeft: '22px', fontSize: '10px' }}>
              <div>[ ] Request cannot be done as per remarks</div>
              <div>[ ] Preparation of Purchase Request (PR) for materials needed {req.replacementFlag?.isFlagged ? '(FLAGGED)' : ''}</div>
              <div>[ ] Preparation of Job Request (JR) for procurement</div>
            </div>
            <div style={{ fontSize: '9px', color: '#475569', textAlign: 'center', width: '220px', borderTop: '1px solid #555', paddingTop: '1px' }}>
              Name and Signature
            </div>
          </div>
          <div style={{ fontSize: '8.5px', color: '#64748b', fontStyle: 'italic', marginTop: '3px', paddingLeft: '2px' }}>
            * To be filled in by the PDAS Head / System Administrator after receipt of the request.
          </div>
        </div>

        <div style={{ marginTop: '4px', fontSize: '10.5px', lineHeight: 1.5 }}>
          <strong>Remarks:</strong>{' '}
          <span style={{ textDecoration: 'underline' }}>
            {req.materialsUsed || req.materials_used ? (
              <>
                <strong>Materials Used:</strong> {req.materialsUsed || req.materials_used}
                {(actionTaken.returnedToClient?.remarks || req.notes || req.technicianNotes) ? (
                  <> &nbsp;|&nbsp; <strong>Work Notes:</strong> {req.technicianNotes || actionTaken.returnedToClient?.remarks || req.notes}</>
                ) : null}
              </>
            ) : (
              actionTaken.returnedToClient?.remarks || req.notes || req.technicianNotes || '____________________________________________________________________________________'
            )}
          </span>
        </div>

        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          {pdasApproved && pdasStamp && (
            <div style={{ color: '#1e40af', fontWeight: '600', fontSize: '9px', marginBottom: '6px' }}>
              ✓ Electronically signed: {pdasStamp}{req.adminApprovedAt ? ` on ${formatGovTimestamp(req.adminApprovedAt)}` : ''}
            </div>
          )}
          <div style={{ fontWeight: 'bold', fontSize: '11.5px', letterSpacing: '0.02em' }}>{PDAS_HEAD_NAME}</div>
          <div style={{ borderTop: '1px solid #000', width: '220px', margin: '2px auto 2px' }} />
          <div style={{ fontSize: '10px', fontWeight: 'bold' }}>Head, PDAS</div>
          <div style={{ fontSize: '9.5px', color: '#334155' }}>Director, Planning Development and Auxiliary Services</div>
        </div>
      </div>

      {/* 6. FINAL ACTION Section */}
      <div style={{ border: '1.5px solid #000', padding: '7px 10px', fontSize: '10.5px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
            <span style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>FINAL ACTION:</span>
            <span>[{finalAction.status === 'Approved' || ['Approved', 'Ongoing', 'Completed'].includes(req.status) ? '✓' : ' '}] Approved</span>
            <span>[{finalAction.status === 'Disapproved' || req.status === 'Rejected' || req.status === 'Returned' ? '✓' : ' '}] Disapproved</span>
          </div>
          <div>
            <strong>Remarks:</strong> <span style={{ textDecoration: 'underline' }}>{finalAction.remarks || '__________________________________'}</span>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          {approverApproved && approverStamp && (
            <div style={{ color: '#1e40af', fontWeight: '600', fontSize: '9px', marginBottom: '6px' }}>
              ✓ Electronically signed: {approverStamp}{req.campusAdminApprovedAt ? ` on ${formatGovTimestamp(req.campusAdminApprovedAt)}` : ''}
            </div>
          )}
          <div style={{ fontWeight: 'bold', fontSize: '11.5px', letterSpacing: '0.02em' }}>{CAMPUS_ADMIN_NAME}</div>
          <div style={{ borderTop: '1px solid #000', width: '220px', margin: '2px auto 2px' }} />
          <div style={{ fontSize: '10px', fontWeight: 'bold' }}>{tpl.approverTitle || APPROVER_TITLE}</div>
        </div>

        <div style={{ fontSize: '9px', textAlign: 'right', marginTop: '6px', color: '#475569' }}>
          {tpl.copyDistribution || 'Copy distribution: 1 – PDAS, 1 – GSM, 1 – Client'}
        </div>
      </div>
    </div>
  );
};

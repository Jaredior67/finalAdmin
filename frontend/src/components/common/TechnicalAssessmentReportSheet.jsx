import React from 'react';
import isatuLogo from '../../assets/isatu-logo.png';

/**
 * TechnicalAssessmentReportSheet
 * Official ISAT U Dumangas Campus PDAS Printable Form
 * "Maintenance Technical Assessment & Flag Report" (QF-PDAS-TA-02)
 *
 * Used by both Maintenance Technicians and PDAS Administrators / Campus Administrators
 * to view, print, or save as PDF whenever a work order is flagged as:
 *   - "Cannot Complete" (Moved to On Hold / External Contractor Required)
 *   - "Asset Condemned / For Disposal" (Beyond Economical Repair)
 *   - "For Replacement" (Irreparable Component / Procurement Required)
 */
const Checkbox = ({ checked }) => (
  <span
    style={{
      display: 'inline-block',
      width: '12px',
      height: '12px',
      border: '1.2pt solid #000',
      textAlign: 'center',
      lineHeight: '10px',
      fontSize: '9pt',
      fontWeight: 'bold',
      marginRight: '6px',
      verticalAlign: 'middle',
      fontFamily: 'Arial, sans-serif',
      background: '#fff',
      color: '#000',
    }}
  >
    {checked ? '✓' : '\u00A0'}
  </span>
);

export const TechnicalAssessmentReportSheet = ({ req }) => {
  if (!req) return null;

  const controlNo = req.officialTrackingNo || req.controlNo || req.ticket_no || req.id || '—';
  const ticketNo = req.ticket_no || req.id || '—';
  const dateFiled = req.date || (req.created_at ? String(req.created_at).slice(0, 10) : '—');
  const requesterName = req.requestedBy || req.requester_name || '—';
  const department = req.department || req.requester_dept || 'ISAT U Dumangas Campus';
  const location = req.location || [req.building, req.floor, req.room].filter(Boolean).join(' - ') || 'Campus Facility';
  const qrTag = req.qrCodeRef || req.qr_code_ref || '—';
  const category = req.category || 'General Maintenance';
  const urgency = req.urgency || req.urgency_level || 'Medium Risk';
  const currentStatus = req.status || 'On Hold';

  const mf = req.maintenanceFlag || {};
  const rf = req.replacementFlag || {};
  const rawDisp = (rf.disposition || '').toLowerCase();
  const flagType =
    mf.type === 'Cannot Complete' || rawDisp === 'cannot_complete'
      ? 'Cannot Complete'
      : mf.type === 'Disposal' || rawDisp === 'disposal'
        ? 'Disposal'
        : 'Replacement';

  const isCannotComplete = flagType === 'Cannot Complete';
  const isDisposal = flagType === 'Disposal';
  const isReplacement = flagType === 'Replacement';

  const assessedBy = mf.flaggedBy || rf.flaggedBy || req.assignedTo || 'Assigned Maintenance Technician';
  const assessedDate = mf.flaggedDate || rf.flaggedDate || new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  const technicalReason = mf.reason || rf.reason || req.replacement_reason || 'Technical assessment recorded by maintenance personnel.';
  const itemSpecs = rf.itemSpecs || req.replacement_item_specs || '';
  const procurementStatus = rf.procurementStatus || req.replacement_procurement_status || 'Pending Purchase Request (PR)';
  const scheduledWork = mf.scheduledWork || '';
  const scheduledDate = mf.scheduledDate || '';
  const scheduledTime = mf.scheduledTime || '';
  const materialsUsed = req.materialsUsed || req.materials_used || '';

  const cellBorder = '1pt solid #000';

  return (
    <div
      className="print-sheet qf-pdas-ta02-sheet"
      style={{
        fontFamily: 'Arial, Helvetica, sans-serif',
        color: '#000',
        background: '#fff',
        width: '100%',
        maxWidth: '780px',
        margin: '0 auto',
        padding: '10px 14px',
        boxSizing: 'border-box',
        fontSize: '9.5pt',
        lineHeight: 1.35,
      }}
    >
      {/* Official University Header Table */}
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          border: '1.5pt solid #000',
          marginBottom: '10px',
        }}
      >
        <tbody>
          <tr>
            <td
              style={{
                width: '72px',
                border: cellBorder,
                padding: '6px',
                textAlign: 'center',
                verticalAlign: 'middle',
              }}
            >
              <img
                src={isatuLogo}
                alt="ISAT U"
                style={{ width: '56px', height: '56px', objectFit: 'contain', display: 'block', margin: '0 auto' }}
              />
            </td>
            <td
              style={{
                border: cellBorder,
                padding: '6px 10px',
                textAlign: 'center',
                verticalAlign: 'middle',
              }}
            >
              <div style={{ fontSize: '8.5pt', letterSpacing: '0.03em' }}>Republic of the Philippines</div>
              <div style={{ fontSize: '10.5pt', fontWeight: 'bold', letterSpacing: '0.02em' }}>
                ILOILO SCIENCE AND TECHNOLOGY UNIVERSITY
              </div>
              <div style={{ fontSize: '9pt', fontWeight: 'bold' }}>DUMANGAS CAMPUS</div>
              <div style={{ fontSize: '8pt', color: '#222' }}>PDAS — Planning, Development, and Auxiliary Services Office</div>
              <div
                style={{
                  marginTop: '4px',
                  paddingTop: '4px',
                  borderTop: '1pt solid #000',
                  fontSize: '10.5pt',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                }}
              >
                MAINTENANCE TECHNICAL ASSESSMENT &amp; FLAG REPORT
              </div>
            </td>
            <td
              style={{
                width: '175px',
                border: cellBorder,
                padding: 0,
                verticalAlign: 'top',
                fontSize: '8pt',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr>
                    <td style={{ padding: '3px 6px', borderBottom: cellBorder, fontWeight: 'bold' }}>Doc. Code:</td>
                    <td style={{ padding: '3px 6px', borderBottom: cellBorder, fontFamily: 'monospace', fontWeight: 'bold' }}>
                      QF-PDAS-TA-02
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '3px 6px', borderBottom: cellBorder, fontWeight: 'bold' }}>Revision:</td>
                    <td style={{ padding: '3px 6px', borderBottom: cellBorder }}>01</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '3px 6px', borderBottom: cellBorder, fontWeight: 'bold' }}>Effective:</td>
                    <td style={{ padding: '3px 6px', borderBottom: cellBorder }}>Oct 2025</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '3px 6px', fontWeight: 'bold' }}>Control No.:</td>
                    <td style={{ padding: '3px 6px', fontFamily: 'monospace', fontWeight: 'bold' }}>{controlNo}</td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Section 1: Work Order & Asset Identification */}
      <div
        style={{
          background: '#e5e7eb',
          border: '1.2pt solid #000',
          borderBottom: 'none',
          padding: '4px 8px',
          fontWeight: 'bold',
          fontSize: '9pt',
          textTransform: 'uppercase',
        }}
      >
        I. Work Order &amp; Facility / Asset Identification
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1.2pt solid #000', marginBottom: '10px' }}>
        <tbody>
          <tr>
            <td style={{ width: '18%', border: cellBorder, padding: '4px 7px', fontWeight: 'bold', background: '#f9fafb' }}>
              Ticket Number:
            </td>
            <td style={{ width: '32%', border: cellBorder, padding: '4px 7px', fontFamily: 'monospace', fontWeight: 'bold' }}>
              {ticketNo}
            </td>
            <td style={{ width: '18%', border: cellBorder, padding: '4px 7px', fontWeight: 'bold', background: '#f9fafb' }}>
              Control Number:
            </td>
            <td style={{ width: '32%', border: cellBorder, padding: '4px 7px', fontFamily: 'monospace', fontWeight: 'bold' }}>
              {controlNo}
            </td>
          </tr>
          <tr>
            <td style={{ border: cellBorder, padding: '4px 7px', fontWeight: 'bold', background: '#f9fafb' }}>Date Filed:</td>
            <td style={{ border: cellBorder, padding: '4px 7px' }}>{dateFiled}</td>
            <td style={{ border: cellBorder, padding: '4px 7px', fontWeight: 'bold', background: '#f9fafb' }}>Date Assessed:</td>
            <td style={{ border: cellBorder, padding: '4px 7px' }}>{assessedDate}</td>
          </tr>
          <tr>
            <td style={{ border: cellBorder, padding: '4px 7px', fontWeight: 'bold', background: '#f9fafb' }}>Requester:</td>
            <td style={{ border: cellBorder, padding: '4px 7px' }}>{requesterName}</td>
            <td style={{ border: cellBorder, padding: '4px 7px', fontWeight: 'bold', background: '#f9fafb' }}>Dept / Office:</td>
            <td style={{ border: cellBorder, padding: '4px 7px' }}>{department}</td>
          </tr>
          <tr>
            <td style={{ border: cellBorder, padding: '4px 7px', fontWeight: 'bold', background: '#f9fafb' }}>Facility Location:</td>
            <td style={{ border: cellBorder, padding: '4px 7px' }}>{location}</td>
            <td style={{ border: cellBorder, padding: '4px 7px', fontWeight: 'bold', background: '#f9fafb' }}>Location QR Tag:</td>
            <td style={{ border: cellBorder, padding: '4px 7px', fontFamily: 'monospace' }}>{qrTag}</td>
          </tr>
          <tr>
            <td style={{ border: cellBorder, padding: '4px 7px', fontWeight: 'bold', background: '#f9fafb' }}>Trade Category:</td>
            <td style={{ border: cellBorder, padding: '4px 7px' }}>{category}</td>
            <td style={{ border: cellBorder, padding: '4px 7px', fontWeight: 'bold', background: '#f9fafb' }}>Urgency / Status:</td>
            <td style={{ border: cellBorder, padding: '4px 7px', fontWeight: 'bold' }}>
              {urgency} — [{currentStatus}]
            </td>
          </tr>
          <tr>
            <td style={{ border: cellBorder, padding: '4px 7px', fontWeight: 'bold', background: '#f9fafb' }}>
              Original Complaint:
            </td>
            <td colSpan={3} style={{ border: cellBorder, padding: '4px 7px' }}>
              {req.title ? <strong>{req.title}: </strong> : null}
              {req.description || '—'}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Section 2: Technical Outcome Classification */}
      <div
        style={{
          background: '#e5e7eb',
          border: '1.2pt solid #000',
          borderBottom: 'none',
          padding: '4px 8px',
          fontWeight: 'bold',
          fontSize: '9pt',
          textTransform: 'uppercase',
        }}
      >
        II. Technical Outcome Classification &amp; Flag Disposition
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1.2pt solid #000', marginBottom: '10px' }}>
        <tbody>
          <tr>
            <td style={{ border: cellBorder, padding: '6px 10px' }}>
              <div style={{ marginBottom: '5px' }}>
                <Checkbox checked={isCannotComplete} />
                <strong>REQUEST CANNOT BE COMPLETED IN-HOUSE (Placed On Hold)</strong>
                <span style={{ fontSize: '8.5pt', color: '#333', marginLeft: '6px' }}>
                  — Requires external contractor, specialized service tools, or major civil/structural intervention.
                </span>
              </div>
              <div style={{ marginBottom: '5px' }}>
                <Checkbox checked={isReplacement} />
                <strong>FOR UNIT / PART REPLACEMENT &amp; PROCUREMENT</strong>
                <span style={{ fontSize: '8.5pt', color: '#333', marginLeft: '6px' }}>
                  — Defective component requires Purchase Request (PR) and replacement unit procurement.
                </span>
              </div>
              <div>
                <Checkbox checked={isDisposal} />
                <strong>ASSET CONDEMNED / FOR DISPOSAL (Beyond Economical Repair)</strong>
                <span style={{ fontSize: '8.5pt', color: '#333', marginLeft: '6px' }}>
                  — Equipment is unserviceable and recommended for condemnation and turnover to Supply &amp; Property Office.
                </span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Section 3: Field Technician Technical Findings & Rationale */}
      <div
        style={{
          background: '#e5e7eb',
          border: '1.2pt solid #000',
          borderBottom: 'none',
          padding: '4px 8px',
          fontWeight: 'bold',
          fontSize: '9pt',
          textTransform: 'uppercase',
        }}
      >
        III. Field Technician Inspection Findings &amp; Technical Justification
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1.2pt solid #000', marginBottom: '10px' }}>
        <tbody>
          <tr>
            <td style={{ border: cellBorder, padding: '8px 10px', minHeight: '70px', verticalAlign: 'top' }}>
              <div style={{ fontSize: '8pt', fontWeight: 'bold', textTransform: 'uppercase', color: '#333', marginBottom: '4px' }}>
                Detailed Assessment / Root Cause / Reason for Escalation:
              </div>
              <div style={{ whiteSpace: 'pre-wrap', fontSize: '9.5pt', minHeight: '42px' }}>{technicalReason}</div>
              {materialsUsed ? (
                <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '0.8pt dashed #666', fontSize: '8.5pt' }}>
                  <strong>Initial Materials / Diagnostic Consumables Used:</strong> {materialsUsed}
                </div>
              ) : null}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Section 4: Recommended Action, Specifications, or Proposed Follow-up Schedule */}
      <div
        style={{
          background: '#e5e7eb',
          border: '1.2pt solid #000',
          borderBottom: 'none',
          padding: '4px 8px',
          fontWeight: 'bold',
          fontSize: '9pt',
          textTransform: 'uppercase',
        }}
      >
        IV. Recommended Specifications / External Scope &amp; Administrative Action
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1.2pt solid #000', marginBottom: '10px' }}>
        <tbody>
          {isCannotComplete ? (
            <>
              <tr>
                <td style={{ width: '28%', border: cellBorder, padding: '5px 8px', fontWeight: 'bold', background: '#f9fafb' }}>
                  Recommended Follow-Up / External Contractor Scope:
                </td>
                <td colSpan={3} style={{ border: cellBorder, padding: '5px 8px' }}>
                  {scheduledWork || 'Requires PDAS Admin review for external contractor dispatch or specialized intervention.'}
                </td>
              </tr>
              <tr>
                <td style={{ border: cellBorder, padding: '5px 8px', fontWeight: 'bold', background: '#f9fafb' }}>
                  Proposed Follow-up Date:
                </td>
                <td style={{ width: '22%', border: cellBorder, padding: '5px 8px' }}>{scheduledDate || 'To be scheduled by PDAS'}</td>
                <td style={{ width: '24%', border: cellBorder, padding: '5px 8px', fontWeight: 'bold', background: '#f9fafb' }}>
                  Proposed Time Window:
                </td>
                <td style={{ width: '26%', border: cellBorder, padding: '5px 8px' }}>{scheduledTime || 'Standard working hours'}</td>
              </tr>
            </>
          ) : isDisposal ? (
            <>
              <tr>
                <td style={{ width: '28%', border: cellBorder, padding: '5px 8px', fontWeight: 'bold', background: '#f9fafb' }}>
                  Condemnation &amp; Disposal Action:
                </td>
                <td colSpan={3} style={{ border: cellBorder, padding: '5px 8px' }}>
                  Unit certified beyond economical repair (BER). Recommend pull-out and official turnover to Supply and Property Management Office for inventory de-registration.
                </td>
              </tr>
              <tr>
                <td style={{ border: cellBorder, padding: '5px 8px', fontWeight: 'bold', background: '#f9fafb' }}>
                  Asset / Component Notes:
                </td>
                <td colSpan={3} style={{ border: cellBorder, padding: '5px 8px' }}>
                  {itemSpecs || 'Condemned unit — see technical justification in Section III.'}
                </td>
              </tr>
            </>
          ) : (
            <>
              <tr>
                <td style={{ width: '28%', border: cellBorder, padding: '5px 8px', fontWeight: 'bold', background: '#f9fafb' }}>
                  Recommended Replacement Item &amp; Specifications:
                </td>
                <td colSpan={3} style={{ border: cellBorder, padding: '5px 8px', fontWeight: 'bold' }}>
                  {itemSpecs || 'Standard compatible replacement component per technical inspection.'}
                </td>
              </tr>
              <tr>
                <td style={{ border: cellBorder, padding: '5px 8px', fontWeight: 'bold', background: '#f9fafb' }}>
                  Procurement Pipeline Status:
                </td>
                <td colSpan={3} style={{ border: cellBorder, padding: '5px 8px' }}>
                  {procurementStatus}
                </td>
              </tr>
            </>
          )}
          <tr>
            <td style={{ border: cellBorder, padding: '5px 8px', fontWeight: 'bold', background: '#f9fafb' }}>
              PDAS Administrative Directive:
            </td>
            <td colSpan={3} style={{ border: cellBorder, padding: '5px 8px' }}>
              <span style={{ marginRight: '16px' }}>
                <Checkbox checked={currentStatus === 'On Hold'} /> Hold Work Order
              </span>
              <span style={{ marginRight: '16px' }}>
                <Checkbox checked={isReplacement} /> Endorse Purchase Request (PR)
              </span>
              <span style={{ marginRight: '16px' }}>
                <Checkbox checked={isDisposal} /> Endorse Asset Condemnation
              </span>
              <span>
                <Checkbox checked={false} /> Reassign / External Contract
              </span>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Section 5: Signatories & Administrative Escalation */}
      <div
        style={{
          background: '#e5e7eb',
          border: '1.2pt solid #000',
          borderBottom: 'none',
          padding: '4px 8px',
          fontWeight: 'bold',
          fontSize: '9pt',
          textTransform: 'uppercase',
        }}
      >
        V. Official Signatories &amp; Administrative Endorsement
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1.2pt solid #000' }}>
        <tbody>
          <tr>
            <td style={{ width: '33.3%', border: cellBorder, padding: '8px 10px', verticalAlign: 'top' }}>
              <div style={{ fontSize: '8pt', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '22px' }}>
                1. Assessed &amp; Flagged By:
              </div>
              <div
                style={{
                  borderBottom: '1pt solid #000',
                  fontWeight: 'bold',
                  textAlign: 'center',
                  paddingBottom: '2px',
                  fontSize: '9.5pt',
                }}
              >
                {assessedBy}
              </div>
              <div style={{ textAlign: 'center', fontSize: '8pt', paddingTop: '2px' }}>
                Assigned Maintenance Personnel / Technician
              </div>
              <div style={{ textAlign: 'center', fontSize: '7.5pt', color: '#333', marginTop: '4px' }}>
                Date: {assessedDate}
              </div>
            </td>
            <td style={{ width: '33.3%', border: cellBorder, padding: '8px 10px', verticalAlign: 'top' }}>
              <div style={{ fontSize: '8pt', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '22px' }}>
                2. Verified &amp; Noted By:
              </div>
              <div
                style={{
                  borderBottom: '1pt solid #000',
                  fontWeight: 'bold',
                  textAlign: 'center',
                  paddingBottom: '2px',
                  fontSize: '9.5pt',
                }}
              >
                {req.actionTaken?.pdasHeadName || 'PDAS Head / System Administrator'}
              </div>
              <div style={{ textAlign: 'center', fontSize: '8pt', paddingTop: '2px' }}>
                Head, Planning, Development &amp; Auxiliary Services
              </div>
              <div style={{ textAlign: 'center', fontSize: '7.5pt', color: '#333', marginTop: '4px' }}>
                Date: ____________________
              </div>
            </td>
            <td style={{ width: '33.4%', border: cellBorder, padding: '8px 10px', verticalAlign: 'top' }}>
              <div style={{ fontSize: '8pt', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '22px' }}>
                3. Approved By:
              </div>
              <div
                style={{
                  borderBottom: '1pt solid #000',
                  fontWeight: 'bold',
                  textAlign: 'center',
                  paddingBottom: '2px',
                  fontSize: '9.5pt',
                }}
              >
                {req.approverName || req.finalAction?.campusAdminName || 'Campus Administrator'}
              </div>
              <div style={{ textAlign: 'center', fontSize: '8pt', paddingTop: '2px' }}>
                Campus Administrator, ISAT U Dumangas Campus
              </div>
              <div style={{ textAlign: 'center', fontSize: '7.5pt', color: '#333', marginTop: '4px' }}>
                Date: ____________________
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <div
        style={{
          marginTop: '6px',
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '7.5pt',
          color: '#333',
        }}
      >
        <span>Copy Distribution: 1 – PDAS Office, 1 – Maintenance Personnel, 1 – Supply &amp; Property / Client</span>
        <span>Generated via FixIT PDAS — ISAT U Dumangas Campus</span>
      </div>
    </div>
  );
};

export default TechnicalAssessmentReportSheet;

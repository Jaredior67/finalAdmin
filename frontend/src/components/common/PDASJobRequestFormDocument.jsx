import isatuLogo from '../../assets/isatu-logo.png';
import { PDAS_HEAD_TITLE, APPROVER_TITLE, signatoryName, approvalStamp, formatGovTimestamp } from '../../utils/approvalSignatures';
import { useData } from '../../context/DataContext';

export const PDASJobRequestFormDocument = ({ req, customConfig = null }) => {
  const { formTemplateConfig } = useData() || {};
  const tpl = customConfig || formTemplateConfig || {};
  if (!req) return null;

  const scope = req.scopeOfWorks || {};
  const actionTaken = req.actionTaken || {};
  const finalAction = req.finalAction || {};

  /* Signatories. A personal name prints only when the form or the database
     recorded one; otherwise the line is left blank for wet ink and the
     "Electronically approved" stamp is suppressed. */
  const pdasSignatory = signatoryName(actionTaken.pdasHeadName, req.pdasHeadName);
  const pdasStamp = approvalStamp(actionTaken.pdasHeadName, req.pdasHeadName);
  // Show stamp ONLY when that specific approver has actually clicked Approve.
  // Status-based fallbacks are intentionally removed — they caused stamps to
  // appear for approvers who had not yet acted on the request.
  const pdasApproved = Boolean(req.adminApproved);
  const approverSignatory = signatoryName(finalAction.approverName, req.approverName);
  const approverStamp = approvalStamp(finalAction.approverName, req.approverName);
  const approverApproved = Boolean(req.campusAdminApproved);
  // Same as the print sheet: urgent dispatches hide wet-ink blanks — signatures

  const getChecked = (catKey, optName) => {
    const section = scope[catKey];
    if (section && Array.isArray(section.options) && section.options.length > 0) {
      return section.options.includes(optName);
    }
    const catMap = {
      drawingDesign: 'Drawing/Design',
      physicalStructures: 'Physical Structures',
      electrical: 'Electrical',
      mechanical: 'Mechanical',
      waterSanitary: 'Water/Sanitary',
      airConditioning: 'Air Conditioning'
    };
    if (req.category === catMap[catKey]) {
      if (!section || !section.options || section.options.length === 0) {
        return optName === 'Rehabilitation/Repair' || optName === 'Repair' || optName === 'Floor Plans' || optName === 'Perspective';
      }
    }
    return false;
  };

  return (
    <div style={{
      background: '#ffffff',
      border: '2px solid #000000',
      padding: '24px 28px',
      color: '#000000',
      fontFamily: tpl.fontFamily === 'sans' ? "'Inter', -apple-system, BlinkMacSystemFont, Arial, sans-serif" : '"Times New Roman", Times, serif',
      fontSize: '12px',
      lineHeight: '1.3'
    }}>
      {/* 1. Header Box */}
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000000', marginBottom: '14px' }}>
        <tbody>
          <tr>
            <td style={{ width: '70px', padding: '6px', textAlign: 'center', borderRight: '1px solid #000' }}>
              <img
                src={tpl.customLogoUrl || isatuLogo}
                alt="Logo"
                style={{ width: '56px', height: '56px', objectFit: 'contain' }}
                onError={(e) => { e.target.src = '/isatu-logo.png'; }}
              />
            </td>
            <td style={{ padding: '6px 12px', textAlign: 'center', borderRight: '1px solid #000' }}>
              <div style={{ fontSize: '10px', textTransform: 'uppercase' }}>{tpl.republicLine || 'Republic of the Philippines'}</div>
              <div style={{ fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                {tpl.institutionName || 'ILOILO SCIENCE AND TECHNOLOGY UNIVERSITY'}
              </div>
              <div style={{ fontSize: '11px', fontWeight: 'bold' }}>{tpl.campusName || 'DUMANGAS CAMPUS'}</div>
              <div style={{ fontSize: '9.5px' }}>{tpl.campusAddress || 'P.D. Monfort South, Dumangas, Iloilo'}</div>
              <div style={{ fontSize: '12px', fontWeight: 'bold', marginTop: '4px', textTransform: 'uppercase' }}>
                {tpl.documentTitle || 'JOB REQUEST FOR REPAIR, MAINTENANCE AND CONSTRUCTION'}
              </div>
            </td>
            <td style={{ width: '210px', padding: '0', verticalAlign: 'top' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #000' }}>
                    <td style={{ padding: '3px 6px', borderRight: '1px solid #000', fontWeight: 'bold' }}>Department:</td>
                    <td style={{ padding: '3px 6px', fontWeight: 'bold' }}>{tpl.department?.replace(/^Department:\s*/i, '') || 'PDAS'}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #000' }}>
                    <td style={{ padding: '3px 6px', borderRight: '1px solid #000', fontWeight: 'bold' }}>Document Code:</td>
                    <td style={{ padding: '3px 6px', fontWeight: 'bold' }}>{tpl.documentCode || 'QF-PDAS-DC-01'}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '3px 6px', borderRight: '1px solid #000' }}>Revision Number: {tpl.revisionNo || '00'}</td>
                    <td style={{ padding: '3px 6px' }}>Effective Date:<br />{tpl.effectiveDate || 'February 3, 2025'}</td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>

      {/* 2. Tracking & Requester Details */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '14px', fontSize: '11px' }}>
        <tbody>
          <tr>
            <td style={{ padding: '3px 0', width: '55%', verticalAlign: 'top' }}>
              <strong>{tpl.trackingLabel || 'Tracking Number:'}</strong> <span style={{ textDecoration: 'underline', fontWeight: 'bold' }}>{req.controlNo || 'PENDING, issued when the work order is assigned'}</span>
            </td>
            <td style={{ padding: '3px 0', width: '45%', verticalAlign: 'top' }}>
              <strong>{tpl.dateLabel || 'Date of Request:'}</strong> <span style={{ textDecoration: 'underline' }}>{req.date}</span>
            </td>
          </tr>
          <tr>
            <td style={{ padding: '3px 0', verticalAlign: 'top' }}>
              <strong>{tpl.clientNameLabel || 'Name of Client:'}</strong> <span style={{ textDecoration: 'underline' }}>{req.requestedBy}</span>
              {req.requesterApproved && (
                <div style={{ color: '#002699', fontWeight: 'bold', fontSize: '10.5px', marginTop: '2px', fontStyle: 'italic' }}>
                  ✓ Electronically signed: {req.requestedBy || 'Requester'}{req.requesterApprovedAt ? ` on ${formatGovTimestamp(req.requesterApprovedAt)}` : ''}
                </div>
              )}
            </td>
            <td style={{ padding: '3px 0', verticalAlign: 'top' }}></td>
          </tr>
          <tr>
            <td style={{ padding: '3px 0', verticalAlign: 'top' }}>
              <strong>{tpl.clientOfficeLabel || 'Office of Client:'}</strong> <span style={{ textDecoration: 'underline' }}>{req.department || req.office || req.location}</span>
            </td>
            <td style={{ padding: '3px 0', verticalAlign: 'top' }}>
              {req.location && (
                <span><strong>{tpl.locationLabel || 'Location:'}</strong> <span style={{ textDecoration: 'underline' }}>{req.location}</span></span>
              )}
            </td>
          </tr>
          <tr>
            <td style={{ padding: '3px 0', verticalAlign: 'top' }}>
              <strong>{tpl.supervisorLabel || 'Immediate Supervisor:'}</strong> <span style={{ textDecoration: 'underline' }}>{req.immediateSupervisor || 'Department Head / Supervisor'}</span>
              {req.supervisorApproved && (
                <div style={{ color: '#002699', fontWeight: 'bold', fontSize: '10.5px', marginTop: '2px', fontStyle: 'italic' }}>
                  ✓ Electronically approved: {req.immediateSupervisor || 'Immediate Supervisor'}{req.supervisorApprovedAt ? ` on ${formatGovTimestamp(req.supervisorApprovedAt)}` : ''}
                </div>
              )}
            </td>
            <td style={{ padding: '3px 0', verticalAlign: 'top' }}></td>
          </tr>
          {req.contactNumber && (
            <tr>
              <td colSpan={2} style={{ padding: '3px 0', verticalAlign: 'top' }}>
                <strong>Contact:</strong> <span style={{ textDecoration: 'underline' }}>{req.contactNumber}</span>
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* 3. Areas / Scope of Works Header */}
      <div style={{
        background: '#e2e8f0',
        border: '1px solid #000000',
        textAlign: 'center',
        fontWeight: 'bold',
        padding: '3px',
        fontSize: '11.5px',
        textTransform: 'uppercase'
      }}>
        AREAS / SCOPE OF WORKS
      </div>

      {/* Scope of Works 6-Box Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', border: '1px solid #000000', borderTop: 'none', marginBottom: '14px' }}>
        {/* 1. DRAWING / DESIGN */}
        <div style={{ borderRight: '1px solid #000', borderBottom: '1px solid #000', padding: '6px' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>1. DRAWING / DESIGN</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px', fontSize: '10.5px' }}>
            {['Floor Plans', 'Detailed Drawings', 'Perspective', 'Specifications', 'List of Materials', 'Other Services'].map(opt => (
              <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input type="checkbox" checked={getChecked('drawingDesign', opt)} readOnly /> {opt}
              </label>
            ))}
          </div>
          <div style={{ marginTop: '4px', fontSize: '10.5px' }}>
            <strong>Description of Work:</strong> {scope.drawingDesign?.description || (req.category === 'Drawing/Design' ? req.description : '')}
          </div>
        </div>

        {/* 2. PHYSICAL STRUCTURES */}
        <div style={{ borderBottom: '1px solid #000', padding: '6px' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>2. PHYSICAL STRUCTURES</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px', fontSize: '10.5px' }}>
            {['New Structure', 'Rehabilitation/Repair', 'Renovation', 'Partial', 'Full', 'Other Services'].map(opt => (
              <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input type="checkbox" checked={getChecked('physicalStructures', opt)} readOnly /> {opt}
              </label>
            ))}
          </div>
          <div style={{ marginTop: '4px', fontSize: '10.5px' }}>
            <strong>Description of Work:</strong> {scope.physicalStructures?.description || (req.category === 'Physical Structures' ? req.description : '')}
          </div>
        </div>

        {/* 3. ELECTRICAL */}
        <div style={{ borderRight: '1px solid #000', borderBottom: '1px solid #000', padding: '6px' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>3. ELECTRICAL</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px', fontSize: '10.5px' }}>
            {['New Installation', 'Repair', 'Rehabilitation', 'Other Services'].map(opt => (
              <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input type="checkbox" checked={getChecked('electrical', opt)} readOnly /> {opt}
              </label>
            ))}
          </div>
          <div style={{ marginTop: '4px', fontSize: '10.5px' }}>
            <strong>Description of Work:</strong> {scope.electrical?.description || (req.category === 'Electrical' ? req.description : '')}
          </div>
        </div>

        {/* 4. MECHANICAL */}
        <div style={{ borderBottom: '1px solid #000', padding: '6px' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>4. MECHANICAL</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px', fontSize: '10.5px' }}>
            {['New Installation', 'Repair', 'Rehabilitation', 'Other Services'].map(opt => (
              <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input type="checkbox" checked={getChecked('mechanical', opt)} readOnly /> {opt}
              </label>
            ))}
          </div>
          <div style={{ marginTop: '4px', fontSize: '10.5px' }}>
            <strong>Description of Work:</strong> {scope.mechanical?.description || (req.category === 'Mechanical' ? req.description : '')}
          </div>
        </div>

        {/* 5. WATER / SANITARY */}
        <div style={{ borderRight: '1px solid #000', padding: '6px' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>5. WATER / SANITARY</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px', fontSize: '10.5px' }}>
            {['New Installation', 'Repair', 'Rehabilitation', 'Other Services'].map(opt => (
              <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input type="checkbox" checked={getChecked('waterSanitary', opt)} readOnly /> {opt}
              </label>
            ))}
          </div>
          <div style={{ marginTop: '4px', fontSize: '10.5px' }}>
            <strong>Description of Work:</strong> {scope.waterSanitary?.description || (req.category === 'Water/Sanitary' ? req.description : '')}
          </div>
        </div>

        {/* 6. AIR CONDITIONING */}
        <div style={{ padding: '6px' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>6. AIR CONDITIONING</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px', fontSize: '10.5px' }}>
            {['New Installation', 'Repair', 'Rehabilitation', 'Other Services'].map(opt => (
              <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input type="checkbox" checked={getChecked('airConditioning', opt)} readOnly /> {opt}
              </label>
            ))}
          </div>
          <div style={{ marginTop: '4px', fontSize: '10.5px' }}>
            <strong>Description of Work:</strong> {scope.airConditioning?.description || (req.category === 'Air Conditioning' ? req.description : '')}
          </div>
        </div>
      </div>

      {/* 4. ACTION TAKEN Box */}
      <div style={{ border: '1px solid #000000', padding: '8px', marginBottom: '14px', fontSize: '11px' }}>
        <div style={{ fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '6px' }}>ACTION TAKEN:</div>
        
        <div style={{ marginBottom: '6px' }}>
          <label style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input type="checkbox" checked={actionTaken.endorsedDesignTeam?.checked || false} readOnly />
            Endorsed to Design Team for preparations of:
          </label>
          <div style={{ marginLeft: '24px', display: 'flex', gap: '16px', fontSize: '10.5px' }}>
            <span>[{actionTaken.endorsedDesignTeam?.detailedPlan ? 'x' : ' '}] Detailed Plan</span>
            <span>[{actionTaken.endorsedDesignTeam?.powBoq ? 'x' : ' '}] Program of Works and Bill of Quantities</span>
            <span>Received by: <span style={{ textDecoration: 'underline' }}>{actionTaken.endorsedDesignTeam?.receivedBy || '__________________'}</span></span>
          </div>
        </div>

        <div style={{ marginBottom: '6px' }}>
          <label style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input type="checkbox" checked={actionTaken.endorsedGSMHead?.checked || false} readOnly />
            Endorsed to GSM Head for issuance of Work Order
          </label>
          <div style={{ marginLeft: '24px', fontSize: '10.5px' }}>
            Received by: <span style={{ textDecoration: 'underline' }}>{actionTaken.endorsedGSMHead?.receivedBy || req.assignedTo || '__________________'}</span>
            <span style={{ marginLeft: '16px' }}>Date: {actionTaken.endorsedGSMHead?.date || req.date}</span>
          </div>
        </div>

        <div>
          <label style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input type="checkbox" checked={actionTaken.returnedToClient?.checked || false} readOnly />
            Returned to Client for:
          </label>
          <div style={{ marginLeft: '24px', fontSize: '10.5px' }}>
            <div>• Request cannot be done as per remarks</div>
            <div>• Preparation of Purchase Request (PR) for materials needed {req.replacementFlag?.isFlagged ? '(FLAGGED)' : ''}</div>
            <div>• Preparation of Job Request (JR) for procurement</div>
            <div>Remarks: <span style={{ textDecoration: 'underline' }}>{actionTaken.returnedToClient?.remarks || req.notes || 'None'}</span></div>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '14px' }}>
          <div style={{ fontWeight: 'bold', textDecoration: 'underline' }}>{pdasSignatory}</div>
          <div style={{ fontSize: '10px' }}>{tpl.pdasHeadTitle || PDAS_HEAD_TITLE}</div>
          {pdasApproved && pdasStamp && (
            <div style={{ color: '#002699', fontWeight: 'bold', fontSize: '10.5px', marginTop: '3px', fontStyle: 'italic' }}>
              ✓ Electronically approved: {pdasStamp}{req.adminApprovedAt ? ` on ${formatGovTimestamp(req.adminApprovedAt)}` : ''}
            </div>
          )}
        </div>
      </div>

      {/* 5. FINAL ACTION Box */}
      <div style={{ border: '1px solid #000000', padding: '8px', fontSize: '11px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
          <div style={{ fontWeight: 'bold' }}>FINAL ACTION:</div>
          <div style={{ display: 'flex', gap: '16px', fontWeight: 'bold' }}>
            <span>[{finalAction.status === 'Approved' || req.status === 'Approved' || req.status === 'Ongoing' || req.status === 'Completed' ? 'x' : ' '}] Approved</span>
            <span>[{finalAction.status === 'Disapproved' || req.status === 'Rejected' || req.status === 'Returned' ? 'x' : ' '}] Disapproved</span>
          </div>
          <div>Remarks: <span style={{ textDecoration: 'underline' }}>{finalAction.remarks || req.notes || 'N/A'}</span></div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '14px' }}>
          <div style={{ fontWeight: 'bold', textDecoration: 'underline' }}>{approverSignatory}</div>
          <div style={{ fontSize: '10px' }}>{tpl.approverTitle || APPROVER_TITLE}</div>
          {approverApproved && approverStamp && (
            <div style={{ color: '#002699', fontWeight: 'bold', fontSize: '10.5px', marginTop: '3px', fontStyle: 'italic' }}>
              ✓ Electronically approved: {approverStamp}{req.campusAdminApprovedAt ? ` on ${formatGovTimestamp(req.campusAdminApprovedAt)}` : ''}
            </div>
          )}
        </div>

        <div style={{ fontSize: '9.5px', marginTop: '8px', color: '#475569', textAlign: 'right' }}>
          {tpl.copyDistribution || 'Copy distribution: 1 – PDAS, 1 – GSM, 1 – Client'}
        </div>

        <div style={{ fontSize: '8.5px', marginTop: '8px', paddingTop: '6px', borderTop: '1px dashed #000000', color: '#334155', fontStyle: 'italic', textAlign: 'center', lineHeight: 1.35 }}>
          <strong>Notice / Disclaimer:</strong> {tpl.disclaimerNotice || 'The electronic approvals recorded on this form are internal, timestamped, auditable administrative confirmations and do not constitute legally binding digital signatures. This official document is automatically generated and archived for university facility audit, inventory, and printing purposes.'}
        </div>
      </div>
    </div>
  );
};

import isatuLogo from '../../assets/isatu-logo.png';

export const PDASJobRequestFormDocument = ({ req }) => {
  if (!req) return null;

  const scope = req.scopeOfWorks || {};
  const actionTaken = req.actionTaken || {};
  const finalAction = req.finalAction || {};
  // Same as the print sheet: urgent dispatches hide wet-ink blanks — signatures
  // are collected later on the signed hardcopy.
  const isUrgent = req.requestType === 'Urgent Request';

  const getChecked = (catKey, optName) => {
    const section = scope[catKey];
    if (!section) return req.category === catKey;
    if (section.options && section.options.includes(optName)) return true;
    return false;
  };

  return (
    <div style={{
      background: '#ffffff',
      border: '2px solid #000000',
      padding: '24px 28px',
      color: '#000000',
      fontFamily: '"Times New Roman", Times, serif',
      fontSize: '12px',
      lineHeight: '1.3'
    }}>
      {/* 1. Header Box */}
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000000', marginBottom: '14px' }}>
        <tbody>
          <tr>
            <td style={{ width: '70px', padding: '6px', textAlign: 'center', borderRight: '1px solid #000' }}>
              <img
                src={isatuLogo}
                alt="ISAT U Logo"
                style={{ width: '56px', height: '56px', objectFit: 'contain' }}
                onError={(e) => { e.target.src = '/isatu-logo.png'; }}
              />
            </td>
            <td style={{ padding: '6px 12px', textAlign: 'center', borderRight: '1px solid #000' }}>
              <div style={{ fontSize: '10px', textTransform: 'uppercase' }}>Republic of the Philippines</div>
              <div style={{ fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                ILOILO SCIENCE AND TECHNOLOGY UNIVERSITY
              </div>
              <div style={{ fontSize: '11px', fontWeight: 'bold' }}>DUMANGAS CAMPUS</div>
              <div style={{ fontSize: '9.5px' }}>P.D. Monfort South, Dumangas, Iloilo</div>
              <div style={{ fontSize: '12px', fontWeight: 'bold', marginTop: '4px', textTransform: 'uppercase' }}>
                JOB REQUEST FOR REPAIR, MAINTENANCE AND CONSTRUCTION
              </div>
            </td>
            <td style={{ width: '210px', padding: '0', verticalAlign: 'top' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #000' }}>
                    <td style={{ padding: '3px 6px', borderRight: '1px solid #000', fontWeight: 'bold' }}>Department:</td>
                    <td style={{ padding: '3px 6px', fontWeight: 'bold' }}>PDAS</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #000' }}>
                    <td style={{ padding: '3px 6px', borderRight: '1px solid #000', fontWeight: 'bold' }}>Document Code:</td>
                    <td style={{ padding: '3px 6px', fontWeight: 'bold' }}>QF-PDAS-DC-01</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '3px 6px', borderRight: '1px solid #000' }}>Revision Number: 00</td>
                    <td style={{ padding: '3px 6px' }}>Effective Date:<br />February 3, 2025</td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>

      {/* 2. Tracking & Requester Details */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px', marginBottom: '14px' }}>
        <div>
          <strong>Tracking Number:</strong> <span style={{ textDecoration: 'underline', fontWeight: 'bold' }}>{req.controlNo || 'PENDING — issued on Final Approval'}</span>
        </div>
        <div>
          <strong>Date of Request:</strong> <span style={{ textDecoration: 'underline' }}>{req.date}</span>
        </div>
        <div>
          <strong>Name of Client:</strong> <span style={{ textDecoration: 'underline' }}>{req.requestedBy}</span>
        </div>
        {!isUrgent && (
          <div>
            <strong>Signature:</strong> <span style={{ textDecoration: 'underline' }}>________________________</span> <span style={{ fontSize: '10px', color: '#64748b' }}>(Wet-Ink Physical Signature)</span>
          </div>
        )}
        <div>
          <strong>Office of Client:</strong> <span style={{ textDecoration: 'underline' }}>{req.department || req.location}</span>
        </div>
        <div>
          <strong>Immediate Supervisor:</strong> <span style={{ textDecoration: 'underline' }}>{req.immediateSupervisor || 'Department Head'}</span>
        </div>
      </div>

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
          <div style={{ fontWeight: 'bold', textDecoration: 'underline' }}>KRISTINE J. AMAR</div>
          <div style={{ fontSize: '10px' }}>Head, PDAS / Director, Planning Development and Auxiliary Services</div>
        </div>
      </div>

      {/* 5. FINAL ACTION Box */}
      <div style={{ border: '1px solid #000000', padding: '8px', fontSize: '11px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
          <div style={{ fontWeight: 'bold' }}>FINAL ACTION:</div>
          <div style={{ display: 'flex', gap: '16px', fontWeight: 'bold' }}>
            <span>[{finalAction.status === 'Approved' || req.status === 'Approved' || req.status === 'Ongoing' || req.status === 'Completed' ? 'x' : ' '}] Approved</span>
            <span>[{finalAction.status === 'Disapproved' || req.status === 'Rejected' ? 'x' : ' '}] Disapproved</span>
          </div>
          <div>Remarks: <span style={{ textDecoration: 'underline' }}>{finalAction.remarks || req.notes || 'N/A'}</span></div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '14px' }}>
          <div style={{ fontWeight: 'bold', textDecoration: 'underline' }}>RAMIL G. LUMAUAG, Ed.D., DIT</div>
          <div style={{ fontSize: '10px' }}>Campus Administrator</div>
        </div>

        <div style={{ fontSize: '9.5px', marginTop: '8px', color: '#475569', textAlign: 'right' }}>
          Copy distribution: 1 – PDAS, 1 – GSM, 1 – Client
        </div>
      </div>
    </div>
  );
};

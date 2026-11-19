import React from 'react';
import isatuLogo from '../../assets/isatu-logo.png';
import { useData } from '../../context/DataContext';

/**
 * Official Client Satisfaction Measurement (CSM) Print Sheet
 * Document Code: QF-HRM-15 Rev. 07
 * Renders the official paper form standard of ISAT U
 */
export const ClientSatisfactionPrintSheet = ({ evaluation = {}, request = {}, customConfig = null }) => {
  const { csmTemplateConfig } = useData() || {};
  const cfg = customConfig || csmTemplateConfig || {};

  const req = request || {};
  const ev = evaluation || {};

  // Computed values with fallbacks
  const office = cfg.officeTransactedWith || 'Physical Development and Auxiliary Services (PDAS)';
  const clientType = ev.clientType || 'Government';
  const evalDate = ev.submittedAt ? ev.submittedAt.split(',')[0] : new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const sex = ev.sex || '';
  const age = ev.age || '';
  const region = ev.region || cfg.defaultRegion || 'Region VI - Western Visayas';
  const service = ev.serviceAvailed || req.title || req.category || (req.controlNo ? `Facility Maintenance (${req.controlNo})` : 'Physical Plant & Facility Service');

  const cc1 = String(ev.cc1 || '1');
  const cc2 = String(ev.cc2 || '1');
  const cc3 = String(ev.cc3 || '1');

  const sqds = [
    { id: 'sqd0', text: cfg.sqd0 || 'I am satisfied with the service that I availed.' },
    { id: 'sqd1', text: cfg.sqd1 || 'I spent a reasonable amount of time for my transaction.' },
    { id: 'sqd2', text: cfg.sqd2 || "The office followed the transaction's requirements and steps based on the information provided." },
    { id: 'sqd3', text: cfg.sqd3 || 'The steps (including payment) I needed to do for my transaction were easy and simple.' },
    { id: 'sqd4', text: cfg.sqd4 || 'I easily found information about my transaction from the office or its website.' },
    { id: 'sqd5', text: cfg.sqd5 || 'I paid a reasonable amount of fees for my transaction.' },
    { id: 'sqd6', text: cfg.sqd6 || 'I feel the office was fair to everyone, or "walang palakasan", during my transaction.' },
    { id: 'sqd7', text: cfg.sqd7 || 'I was treated courteously by the staff, and (if asked for help) the staff was helpful.' },
    { id: 'sqd8', text: cfg.sqd8 || 'I got what I needed from the government office, or (if denied) denial of request was sufficiently explained to me.' }
  ];

  const getScore = (key) => {
    if (ev[key] !== undefined && ev[key] !== null) return Number(ev[key]);
    if (ev.csmData?.sqd && ev.csmData.sqd[key] !== undefined) return Number(ev.csmData.sqd[key]);
    return null;
  };

  return (
    <div className="csm-print-document" style={{
      fontFamily: '"Times New Roman", Times, Georgia, serif',
      color: '#000000',
      background: '#ffffff',
      padding: '24px 32px',
      fontSize: '11px',
      lineHeight: '1.25',
      maxWidth: '820px',
      margin: '0 auto',
      boxSizing: 'border-box'
    }}>
      {/* 1. Header Box matching QF-HRM-15 */}
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1.5px solid #000000', marginBottom: '8px' }}>
        <tbody>
          <tr>
            <td style={{ width: '70px', padding: '6px', textAlign: 'center', borderRight: '1px solid #000000', verticalAlign: 'middle' }}>
              <img
                src={cfg.customLogoUrl || isatuLogo}
                alt="ISAT U Seal"
                style={{
                  width: `${cfg.logoWidth || 56}px`,
                  height: `${cfg.logoWidth || 56}px`,
                  objectFit: 'contain',
                  transform: cfg.logoOffsetX || cfg.logoOffsetY ? `translate(${cfg.logoOffsetX || 0}px, ${cfg.logoOffsetY || 0}px)` : 'none'
                }}
              />
            </td>
            <td style={{ padding: '6px 12px', textAlign: 'center', borderRight: '1.5px solid #000000', verticalAlign: 'middle' }}>
              <div style={{ fontSize: '10.5px' }}>{cfg.republicLine || 'Republic of the Philippines'}</div>
              <div style={{ fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                {cfg.institutionName || 'ILOILO SCIENCE AND TECHNOLOGY UNIVERSITY'}
              </div>
              <div style={{ fontSize: '10px' }}>{cfg.campusAddress || 'La Paz, Iloilo City'}</div>
              <div style={{ fontSize: '12px', fontWeight: 'bold', marginTop: '4px', letterSpacing: '0.05em' }}>
                {cfg.documentTitle || 'CLIENT SATISFACTION MEASUREMENT'}
              </div>
            </td>
            <td style={{ width: '190px', padding: '4px 8px', fontSize: '10px', verticalAlign: 'top', borderLeft: '1.5px solid #000000' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '75px 1fr', rowGap: '2px' }}>
                <span>Department:</span><strong style={{ textTransform: 'uppercase' }}>{cfg.department || 'HRMO'}</strong>
                <span>Doc. Code:</span><strong>{cfg.documentCode || 'QF-HRM-15'}</strong>
                <span>Rev. No.:</span><strong>{cfg.revisionNo || '07'}</strong>
                <span>Effective Date:</span><strong>{cfg.effectiveDate || 'April 15, 2026'}</strong>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* 2. Intro Note */}
      <p style={{ margin: '0 0 6px', fontSize: '9.5px', textAlign: 'justify', lineHeight: '1.2' }}>
        {cfg.introText || 'This Client Satisfaction Measurement (CSM) tracks the customer experience of government offices. Your feedback on your recently concluded transaction will help this office provide a better service. Personal information shared will be kept confidential and you always have the option to not answer this form.'}
      </p>

      {/* 3. Data Privacy Commitment */}
      <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '10px', margin: '4px 0 2px' }}>
        {cfg.dataPrivacyTitle || 'Data Privacy Commitment'}
      </div>
      <p style={{ margin: '0 0 5px', fontSize: '9px', textAlign: 'justify', lineHeight: '1.2' }}>
        {cfg.dataPrivacyText || 'Pursuant to Republic Act No. 10173, also known as the Data Privacy Act of 2012, Iloilo Science and Technology University affirms its commitment to protect and respect the privacy of its clients and stakeholders. All information collected through the Client Satisfaction Measurement (CSM) Form shall be processed and safeguarded in accordance with the principles of transparency, legitimate purpose, and proportionality, as mandated under the Data Privacy Act of 2012.'}
      </p>

      {/* 4. Consent of Data Subject */}
      <div style={{ border: '1px dashed #666', padding: '4px 6px', marginBottom: '8px', fontSize: '9px', background: '#fafafa' }}>
        <div style={{ textAlign: 'center', fontWeight: 'bold', marginBottom: '2px' }}>
          {cfg.consentTitle || 'Consent of Data Subject'}
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
          <div style={{ whiteSpace: 'nowrap', display: 'flex', flexDirection: 'column', gap: '2px', fontWeight: 'bold' }}>
            <span>{Boolean(ev.consent !== false && ev.consent !== 0) ? '☒' : '☐'} Yes</span>
            <span>{ev.consent === false || ev.consent === 0 ? '☒' : '☐'} No</span>
          </div>
          <div style={{ textAlign: 'justify', lineHeight: '1.15' }}>
            {cfg.consentText || 'I hereby give my consent and authorize Iloilo Science and Technology University to collect, process, share, disclose, or transfer my personal data to authorized third parties when necessary for journalistic, artistic, literary, research, or other lawful purposes, in accordance with the provisions of Republic Act No. 10173, also known as the Data Privacy Act of 2012.'}
          </div>
        </div>
      </div>

      {/* 5. Demographics */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', rowGap: '4px', fontSize: '10px', marginBottom: '8px' }}>
        <div>
          <span>Office transacted with: </span>
          <span style={{ borderBottom: '1px solid #000', padding: '0 6px', fontWeight: 'bold' }}>{office}</span>
        </div>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span>Client type:</span>
          <span>{clientType.toLowerCase().includes('citizen') ? '☒' : '☐'} Citizen</span>
          <span>{clientType.toLowerCase().includes('business') ? '☒' : '☐'} Business</span>
          <span>{clientType.toLowerCase().includes('gov') ? '☒' : '☐'} Government (Employee or another agency)</span>
        </div>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <span>Date: </span>
            <span style={{ borderBottom: '1px solid #000', padding: '0 6px', fontWeight: 'bold' }}>{evalDate}</span>
          </div>
          <div>
            <span>Sex: </span>
            <span>{sex.toLowerCase() === 'male' || sex.toLowerCase() === 'm' ? '☒' : '☐'} Male </span>
            <span>{sex.toLowerCase() === 'female' || sex.toLowerCase() === 'f' ? '☒' : '☐'} Female</span>
          </div>
          <div>
            <span>Age: </span>
            <span style={{ borderBottom: '1px solid #000', padding: '0 12px', fontWeight: 'bold' }}>{age || '—'}</span>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <span>Region of residence: </span>
            <span style={{ borderBottom: '1px solid #000', padding: '0 6px', fontWeight: 'bold' }}>{region}</span>
          </div>
          <div>
            <span>Service Availed: </span>
            <span style={{ borderBottom: '1px solid #000', padding: '0 6px', fontWeight: 'bold' }}>{service}</span>
          </div>
        </div>
      </div>

      {/* 6. Citizen's Charter Section */}
      <div style={{ borderTop: '1px solid #000', paddingTop: '4px', marginBottom: '6px' }}>
        <div style={{ fontSize: '9.5px', fontWeight: 'bold', marginBottom: '3px' }}>
          INSTRUCTIONS: {cfg.ccInstructions || "Check mark (✓) your answer to the Citizen's Charter (CC) questions. The Citizen's Charter is an official document that reflects the services of a government agency/office including its requirements, fees, and processing times among others."}
        </div>

        {/* CC1 */}
        <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr', gap: '6px', fontSize: '9.5px', marginBottom: '4px' }}>
          <strong>CC1</strong>
          <div>
            <div style={{ fontWeight: 'bold' }}>{cfg.cc1Prompt || 'Which of the following best describes your awareness of a CC?'}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', rowGap: '1px', marginTop: '1px' }}>
              <span>{cc1 === '1' ? '☒' : '☐'} 1. I know what a CC is and I saw this office's CC.</span>
              <span>{cc1 === '2' ? '☒' : '☐'} 2. I know what a CC is but I did NOT see this office's CC.</span>
              <span>{cc1 === '3' ? '☒' : '☐'} 3. I learned of the CC only when I saw this office's CC.</span>
              <span>{cc1 === '4' ? '☒' : '☐'} 4. I do not know what a CC is and I did not see one in this office. (Answer 'N/A' on CC2 and CC3)</span>
            </div>
          </div>
        </div>

        {/* CC2 */}
        <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr', gap: '6px', fontSize: '9.5px', marginBottom: '4px' }}>
          <strong>CC2</strong>
          <div>
            <div style={{ fontWeight: 'bold' }}>{cfg.cc2Prompt || 'If aware of CC (answered 1-3 in CC1), would you say that the CC of this office was...?'}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: '1px', marginTop: '1px' }}>
              <span>{cc2 === '1' ? '☒' : '☐'} 1. Easy to see</span>
              <span>{cc2 === '4' ? '☒' : '☐'} 4. Not visible at all</span>
              <span>{cc2 === '2' ? '☒' : '☐'} 2. Somewhat easy to see</span>
              <span>{cc2 === '5' || cc2 === '0' || cc1 === '4' ? '☒' : '☐'} 5. N/A</span>
              <span>{cc2 === '3' ? '☒' : '☐'} 3. Difficult to see</span>
            </div>
          </div>
        </div>

        {/* CC3 */}
        <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr', gap: '6px', fontSize: '9.5px', marginBottom: '6px' }}>
          <strong>CC3</strong>
          <div>
            <div style={{ fontWeight: 'bold' }}>{cfg.cc3Prompt || 'If aware of CC (answered codes 1-3 in CC1), how much did the CC help you in your transaction?'}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: '1px', marginTop: '1px' }}>
              <span>{cc3 === '1' ? '☒' : '☐'} 1. Helped very much</span>
              <span>{cc3 === '3' ? '☒' : '☐'} 3. Did not help</span>
              <span>{cc3 === '2' ? '☒' : '☐'} 2. Somewhat helped</span>
              <span>{cc3 === '4' || cc3 === '0' || cc1 === '4' ? '☒' : '☐'} 4. N/A</span>
            </div>
          </div>
        </div>
      </div>

      {/* 7. SQD Table Section */}
      <div style={{ marginBottom: '8px' }}>
        <div style={{ fontSize: '9.5px', fontWeight: 'bold', marginBottom: '3px' }}>
          INSTRUCTIONS: {cfg.sqdInstructions || 'For SQD 0-8, please put a check mark (✓) on the column that best corresponds to your answer.'}
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1.5px solid #000000', textAlign: 'center', fontSize: '9px' }}>
          <thead>
            <tr style={{ borderBottom: '1.5px solid #000000', background: '#f3f4f6' }}>
              <th style={{ width: '48%', borderRight: '1px solid #000000', padding: '4px', textAlign: 'left' }}></th>
              <th style={{ width: '8.5%', borderRight: '1px solid #000000', padding: '4px 1px' }}>
                <div style={{ fontSize: '13px' }}>😃</div>
                <div style={{ fontWeight: 'bold', lineHeight: '1.1' }}>Strongly Agree<br />5</div>
              </th>
              <th style={{ width: '8.5%', borderRight: '1px solid #000000', padding: '4px 1px' }}>
                <div style={{ fontSize: '13px' }}>🙂</div>
                <div style={{ fontWeight: 'bold', lineHeight: '1.1' }}>Agree<br />4</div>
              </th>
              <th style={{ width: '9.5%', borderRight: '1px solid #000000', padding: '4px 1px' }}>
                <div style={{ fontSize: '13px' }}>😐</div>
                <div style={{ fontWeight: 'bold', lineHeight: '1.1' }}>Neither Agree nor Disagree<br />3</div>
              </th>
              <th style={{ width: '8.5%', borderRight: '1px solid #000000', padding: '4px 1px' }}>
                <div style={{ fontSize: '13px' }}>🙁</div>
                <div style={{ fontWeight: 'bold', lineHeight: '1.1' }}>Disagree<br />2</div>
              </th>
              <th style={{ width: '8.5%', borderRight: '1px solid #000000', padding: '4px 1px' }}>
                <div style={{ fontSize: '13px' }}>😫</div>
                <div style={{ fontWeight: 'bold', lineHeight: '1.1' }}>Strongly Disagree<br />1</div>
              </th>
              <th style={{ width: '8.5%', padding: '4px 1px' }}>
                <div style={{ fontSize: '12px' }}>—</div>
                <div style={{ fontWeight: 'bold', lineHeight: '1.1' }}>N/A Not Applicable<br />0</div>
              </th>
            </tr>
          </thead>
          <tbody>
            {sqds.map((q) => {
              const score = getScore(q.id);
              return (
                <tr key={q.id} style={{ borderBottom: '1px solid #000000' }}>
                  <td style={{ borderRight: '1px solid #000000', padding: '3px 6px', textAlign: 'left', lineHeight: '1.15' }}>
                    <strong>{q.id.toUpperCase()}.</strong> {q.text}
                  </td>
                  <td style={{ borderRight: '1px solid #000000', padding: '2px', fontWeight: 'bold', fontSize: '12px' }}>
                    {score === 5 ? '✓' : ''}
                  </td>
                  <td style={{ borderRight: '1px solid #000000', padding: '2px', fontWeight: 'bold', fontSize: '12px' }}>
                    {score === 4 ? '✓' : ''}
                  </td>
                  <td style={{ borderRight: '1px solid #000000', padding: '2px', fontWeight: 'bold', fontSize: '12px' }}>
                    {score === 3 ? '✓' : ''}
                  </td>
                  <td style={{ borderRight: '1px solid #000000', padding: '2px', fontWeight: 'bold', fontSize: '12px' }}>
                    {score === 2 ? '✓' : ''}
                  </td>
                  <td style={{ borderRight: '1px solid #000000', padding: '2px', fontWeight: 'bold', fontSize: '12px' }}>
                    {score === 1 ? '✓' : ''}
                  </td>
                  <td style={{ padding: '2px', fontWeight: 'bold', fontSize: '12px' }}>
                    {score === 0 ? '✓' : ''}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 8. Suggestions & Contact */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', rowGap: '4px', fontSize: '9.5px', marginBottom: '8px' }}>
        <div>
          <span>{cfg.suggestionsPrompt || 'Suggestions on how we can further improve our services (optional):'} </span>
          <span style={{ borderBottom: '1px solid #000', padding: '0 6px', display: 'inline-block', width: '60%', minHeight: '14px' }}>
            {ev.suggestions || ev.comments || ''}
          </span>
        </div>
        <div>
          <span>Email address (optional): </span>
          <span style={{ borderBottom: '1px solid #000', padding: '0 6px', fontWeight: 'bold' }}>
            {ev.email || req.requesterEmail || ''}
          </span>
        </div>
      </div>

      {/* 9. Closing */}
      <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '11px', letterSpacing: '0.1em', marginTop: '6px' }}>
        {cfg.footerClosing || 'THANK YOU!'}
      </div>
    </div>
  );
};

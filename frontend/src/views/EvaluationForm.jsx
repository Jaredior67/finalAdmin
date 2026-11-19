import React, { useState, useMemo } from 'react';
import { CheckCircle2, Send, ShieldCheck, Info } from 'lucide-react';
import { useOfflineAutoSave } from '../utils/useOfflineAutoSave';
import { AutoSaveIndicator } from '../components/common/AutoSaveIndicator';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import isatuLogo from '../assets/isatu-logo.png';

export const EvaluationForm = ({ request = {}, requesterName, submitEvaluation, onSubmitted }) => {
  const { csmTemplateConfig } = useData() || {};
  const { currentUser } = useAuth() || {};
  const cfg = csmTemplateConfig || {};

  // Automated pre-fill values
  const todayFormatted = useMemo(() => {
    return new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }, []);

  const defaultServiceAvailed = useMemo(() => {
    const parts = [];
    if (request.category) parts.push(request.category);
    if (request.title) parts.push(request.title);
    if (request.controlNo) parts.push(`(${request.controlNo})`);
    return parts.join(' — ') || 'Facility Maintenance Service';
  }, [request]);

  // Form State
  const [consent, setConsent] = useState(true);
  const [clientType, setClientType] = useState('Government (Employee or another agency)');
  const [date, setDate] = useState(todayFormatted);
  const [sex, setSex] = useState(currentUser?.gender || currentUser?.sex || 'Male');
  const [age, setAge] = useState(currentUser?.age ? String(currentUser.age) : '28');
  const [region, setRegion] = useState(cfg.defaultRegion || 'Region VI - Western Visayas');
  const [serviceAvailed, setServiceAvailed] = useState(defaultServiceAvailed);

  // CC Questions
  const [cc1, setCc1] = useState('1');
  const [cc2, setCc2] = useState('1');
  const [cc3, setCc3] = useState('1');

  // SQD Ratings (0 to 8) - start empty with no autofill so the respondent makes deliberate choices
  const initialSqds = {
    sqd0: null,
    sqd1: null,
    sqd2: null,
    sqd3: null,
    sqd4: null,
    sqd5: null,
    sqd6: null,
    sqd7: null,
    sqd8: null
  };
  const [sqds, setSqds] = useState(initialSqds);

  const [suggestions, setSuggestions] = useState('');
  const [email, setEmail] = useState(currentUser?.email || request.requesterEmail || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Ownership verification: strictly only original requester may submit CSM
  const isRequester = useMemo(() => {
    if (!currentUser) return false;
    if (request.userId && String(request.userId) === String(currentUser.id)) return true;
    if (request.requesterId && String(request.requesterId) === String(currentUser.id)) return true;
    if (currentUser.name && request.requestedBy && request.requestedBy.toLowerCase() === currentUser.name.toLowerCase()) return true;
    if (currentUser.email && request.requesterEmail && request.requesterEmail.toLowerCase() === currentUser.email.toLowerCase()) return true;
    return false;
  }, [currentUser, request]);

  // Draft Data for Offline AutoSave
  const evaluationDraftData = useMemo(() => ({
    consent,
    clientType,
    date,
    sex,
    age,
    region,
    serviceAvailed,
    cc1,
    cc2,
    cc3,
    sqds,
    suggestions,
    email
  }), [consent, clientType, date, sex, age, region, serviceAvailed, cc1, cc2, cc3, sqds, suggestions, email]);

  const { isOnline, lastSaved, hasDraft, clearDraft } = useOfflineAutoSave(
    `csm_eval_${request.id || request.controlNo || 'draft'}`,
    evaluationDraftData,
    (draft) => {
      if (draft.consent !== undefined) setConsent(draft.consent);
      if (draft.clientType) setClientType(draft.clientType);
      if (draft.sex) setSex(draft.sex);
      if (draft.age) setAge(draft.age);
      if (draft.region) setRegion(draft.region);
      if (draft.serviceAvailed) setServiceAvailed(draft.serviceAvailed);
      if (draft.cc1) setCc1(draft.cc1);
      if (draft.cc2) setCc2(draft.cc2);
      if (draft.cc3) setCc3(draft.cc3);
      if (draft.sqds) setSqds(draft.sqds);
      if (draft.suggestions) setSuggestions(draft.suggestions);
      if (draft.email) setEmail(draft.email);
    }
  );

  const sqdList = [
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

  const ratingOptions = [
    { score: 5, label: 'Strongly Agree', emoji: '😃' },
    { score: 4, label: 'Agree', emoji: '🙂' },
    { score: 3, label: 'Neutral', emoji: '😐' },
    { score: 2, label: 'Disagree', emoji: '🙁' },
    { score: 1, label: 'Strongly Disagree', emoji: '😫' },
    { score: 0, label: 'N/A', emoji: '🚫' }
  ];

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!isRequester) {
      setError('Only the original requester who filed this job request can submit Client Satisfaction (CSM) feedback.');
      return;
    }
    if (!consent) {
      setError('Please provide data privacy consent to submit this official form.');
      return;
    }

    // Ensure all mandatory SQDs are rated (0 to 8)
    for (let i = 0; i <= 8; i++) {
      const key = `sqd${i}`;
      if (sqds[key] === undefined || sqds[key] === null) {
        setError(`Please rate SQD${i} before submitting.`);
        return;
      }
    }

    setIsSubmitting(true);
    setError('');

    try {
      await submitEvaluation(request.id, {
        submittedBy: requesterName || currentUser?.name || request.requestedBy,
        consent,
        clientType,
        date,
        sex,
        age,
        region,
        serviceAvailed,
        cc1,
        cc2,
        cc3,
        ...sqds,
        suggestions,
        email
      });
      clearDraft();
      onSubmitted();
    } catch (err) {
      setError(err?.message || 'Failed to submit form. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #001f9c 0%, #1e3a8a 100%)',
        color: '#ffffff',
        padding: '16px 20px',
        borderRadius: '10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src={isatuLogo} alt="ISAT U Seal" style={{ width: '42px', height: '42px', objectFit: 'contain' }} />
          <div>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.9 }}>
              {cfg.institutionName || 'ILOILO SCIENCE AND TECHNOLOGY UNIVERSITY'}
            </div>
            <h3 style={{ margin: '2px 0 0', fontSize: '16px', fontWeight: '800' }}>
              {cfg.documentTitle || 'CLIENT SATISFACTION MEASUREMENT'}
            </h3>
            <div style={{ fontSize: '11px', opacity: 0.85, marginTop: '2px' }}>
              Doc. Code: <strong>{cfg.documentCode || 'QF-HRM-15'}</strong> • Rev: <strong>{cfg.revisionNo || '07'}</strong>
            </div>
          </div>
        </div>

        <AutoSaveIndicator 
          isOnline={isOnline} 
          lastSaved={lastSaved} 
          hasDraft={hasDraft} 
          compact 
          onClearDraft={() => {
            clearDraft();
            setSqds(initialSqds);
            setSuggestions('');
          }} 
        />
      </div>

      {/* Intro & Privacy Note */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 14px', fontSize: '12px', color: '#334155', lineHeight: '1.4' }}>
        <p style={{ margin: '0 0 6px' }}>
          {cfg.introText || 'This Client Satisfaction Measurement (CSM) tracks the customer experience of government offices. Your feedback on your recently concluded transaction will help this office provide a better service.'}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700', color: '#001f9c', marginTop: '6px' }}>
          <ShieldCheck size={14} /> {cfg.dataPrivacyTitle || 'Data Privacy Act of 2012 (R.A. 10173) Commitment'}
        </div>
        <p style={{ margin: '4px 0 8px', fontSize: '11.5px', color: '#64748b' }}>
          All information collected is treated with strict confidentiality under the Data Privacy Act of 2012.
        </p>

        {/* Consent checkbox */}
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', background: '#eff6ff', border: '1px solid #bfdbfe', padding: '8px 10px', borderRadius: '6px', fontSize: '12px', color: '#1e40af' }}>
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            style={{ marginTop: '2px' }}
          />
          <span><strong>Consent of Data Subject:</strong> I hereby give my consent and authorize ISAT U to process this feedback for quality assurance and continuous service improvement.</span>
        </label>
      </div>

      {/* Demographics & Transaction Pre-fills */}
      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', fontSize: '12.5px' }}>
        <div>
          <label style={{ fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>Office Transacted With</label>
          <input
            type="text"
            className="form-input"
            readOnly
            value={cfg.officeTransactedWith || 'Physical Development and Auxiliary Services (PDAS)'}
            style={{ background: 'var(--bg-sunken)', cursor: 'not-allowed' }}
          />
        </div>

        <div>
          <label style={{ fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>Service Availed / Ticket</label>
          <input
            type="text"
            className="form-input"
            value={serviceAvailed}
            onChange={(e) => setServiceAvailed(e.target.value)}
          />
        </div>

        <div>
          <label style={{ fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>Client Type</label>
          <select className="form-select" value={clientType} onChange={(e) => setClientType(e.target.value)}>
            <option value="Government (Employee or another agency)">Government (Employee / Faculty / Staff)</option>
            <option value="Citizen">Citizen (Student / Visitor / Parent)</option>
            <option value="Business">Business (Supplier / Contractor)</option>
          </select>
        </div>

        <div>
          <label style={{ fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>Date</label>
          <input
            type="text"
            className="form-input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <div>
          <label style={{ fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>Sex &amp; Age</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <select className="form-select" style={{ width: '50%' }} value={sex} onChange={(e) => setSex(e.target.value)}>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
            <input
              type="number"
              placeholder="Age"
              className="form-input"
              style={{ width: '50%' }}
              value={age}
              onChange={(e) => setAge(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label style={{ fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>Region of Residence</label>
          <input
            type="text"
            className="form-input"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
          />
        </div>
      </div>

      {/* Citizen's Charter (CC) Questions */}
      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ fontSize: '13px', fontWeight: '800', color: '#001f9c' }}>
          Citizen&apos;s Charter (CC) Questions
        </div>
        <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
          {cfg.ccInstructions || "The Citizen's Charter reflects the services of the office including requirements, processing time, and standards."}
        </p>

        {/* CC1 */}
        <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '8px' }}>
          <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#1e293b', marginBottom: '4px' }}>
            CC1: {cfg.cc1Prompt || 'Which of the following best describes your awareness of a CC?'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '6px', fontSize: '12px' }}>
            {[
              ['1', '1. I know what a CC is and I saw this office\'s CC.'],
              ['2', '2. I know what a CC is but I did NOT see this office\'s CC.'],
              ['3', '3. I learned of the CC only when I saw this office\'s CC.'],
              ['4', '4. I do not know what a CC is (N/A on CC2 and CC3).']
            ].map(([val, label]) => (
              <label key={val} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', padding: '4px 6px', borderRadius: '4px', background: cc1 === val ? '#eff6ff' : 'transparent' }}>
                <input type="radio" name="cc1" value={val} checked={cc1 === val} onChange={() => setCc1(val)} />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* CC2 */}
        {cc1 !== '4' && (
          <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '8px' }}>
            <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#1e293b', marginBottom: '4px' }}>
              CC2: {cfg.cc2Prompt || 'If aware of CC, would you say that the CC of this office was...?'}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', fontSize: '12px' }}>
              {[
                ['1', '1. Easy to see'],
                ['2', '2. Somewhat easy to see'],
                ['3', '3. Difficult to see'],
                ['4', '4. Not visible at all'],
                ['5', '5. N/A']
              ].map(([val, label]) => (
                <label key={val} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px', background: cc2 === val ? '#eff6ff' : 'transparent' }}>
                  <input type="radio" name="cc2" value={val} checked={cc2 === val} onChange={() => setCc2(val)} />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* CC3 */}
        {cc1 !== '4' && (
          <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '8px' }}>
            <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#1e293b', marginBottom: '4px' }}>
              CC3: {cfg.cc3Prompt || 'How much did the CC help you in your transaction?'}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', fontSize: '12px' }}>
              {[
                ['1', '1. Helped very much'],
                ['2', '2. Somewhat helped'],
                ['3', '3. Did not help'],
                ['4', '4. N/A']
              ].map(([val, label]) => (
                <label key={val} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px', background: cc3 === val ? '#eff6ff' : 'transparent' }}>
                  <input type="radio" name="cc3" value={val} checked={cc3 === val} onChange={() => setCc3(val)} />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Service Quality Dimensions (SQD0 to SQD8) */}
      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px' }}>
        <div style={{ marginBottom: '8px' }}>
          <div style={{ fontSize: '13.5px', fontWeight: '800', color: '#001f9c' }}>
            Service Quality Dimensions (SQD 0–8)
          </div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>
            {cfg.sqdInstructions || 'Rate your satisfaction for each dimension from 1 (Strongly Disagree) to 5 (Strongly Agree).'}
          </div>
        </div>

        {/* Responsive Grid for Questions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
          {sqdList.map((item) => {
            const currentScore = sqds[item.id];
            return (
              <div
                key={item.id}
                style={{
                  border: '1px solid #f1f5f9',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  background: currentScore !== null && currentScore !== undefined ? '#f8fafc' : '#ffffff',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                <div style={{ fontSize: '12.5px', color: '#1e293b', fontWeight: '600' }}>
                  <span style={{ color: '#001f9c', fontWeight: '800', marginRight: '6px' }}>
                    {item.id.toUpperCase()}:
                  </span>
                  {item.text}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '6px' }}>
                  {ratingOptions.map(opt => {
                    const isSelected = currentScore === opt.score;
                    return (
                      <button
                        key={opt.score}
                        type="button"
                        onClick={() => setSqds(prev => ({ ...prev, [item.id]: opt.score }))}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '6px 2px',
                          borderRadius: '6px',
                          border: isSelected ? '2px solid #001f9c' : '1px solid #e2e8f0',
                          background: isSelected ? '#eff6ff' : '#f8fafc',
                          color: isSelected ? '#001f9c' : '#475569',
                          fontWeight: isSelected ? '700' : '500',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <span style={{ fontSize: '16px' }}>{opt.emoji}</span>
                        <span style={{ fontSize: '11px', marginTop: '2px', textAlign: 'center' }}>
                          {opt.score === 0 ? 'N/A' : opt.score}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Suggestions & Email */}
      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div>
          <label style={{ fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px', fontSize: '12.5px' }}>
            {cfg.suggestionsPrompt || 'Suggestions on how we can further improve our services (optional):'}
          </label>
          <textarea
            className="form-textarea"
            rows={2}
            value={suggestions}
            onChange={(e) => setSuggestions(e.target.value)}
            placeholder="Share any comments, compliments, or suggestions for the PDAS team..."
          />
        </div>

        <div>
          <label style={{ fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px', fontSize: '12.5px' }}>
            Email Address (optional)
          </label>
          <input
            type="email"
            className="form-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="requester@gmail.com"
          />
        </div>
      </div>

      {!isRequester && (
        <div style={{ background: '#fffbeb', border: '1.5px solid #fde68a', color: '#92400e', padding: '12px 16px', borderRadius: '10px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Info size={18} style={{ flexShrink: 0 }} />
          <span>Notice: This form is reserved for the original requester ({request.requestedBy || 'Requester'}). Only they can submit ratings and official feedback.</span>
        </div>
      )}

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '10px 14px', borderRadius: '8px', fontSize: '12.5px' }}>
          {error}
        </div>
      )}

      {/* Footer Submit */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', alignItems: 'center' }}>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={isSubmitting || !isRequester}
          style={{
            background: isRequester ? '#001f9c' : '#94a3b8',
            cursor: isRequester ? 'pointer' : 'not-allowed',
            border: 'none',
            padding: '10px 24px',
            fontSize: '14px',
            fontWeight: '700',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Send size={15} /> {isSubmitting ? 'Submitting Feedback...' : 'Submit Client Satisfaction Feedback'}
        </button>
      </div>
    </form>
  );
};

import React, { useState, useMemo } from 'react';
import { CheckCircle2, Send } from 'lucide-react';
import { useOfflineAutoSave } from '../utils/useOfflineAutoSave';
import { AutoSaveIndicator } from '../components/common/AutoSaveIndicator';

const criteria = [
  ['functionalSuitability', 'Functional Suitability', 'The repair resolved the reported facility issue.'],
  ['usability', 'Usability', 'The repaired facility or equipment is easy to use.'],
  ['reliability', 'Reliability', 'The repair has remained dependable after completion.'],
  ['performanceEfficiency', 'Performance Efficiency', 'The repaired facility or equipment performs efficiently.']
];

export const EvaluationForm = ({ request, requesterName, submitEvaluation, onSubmitted }) => {
  const [ratings, setRatings] = useState({});
  const [comments, setComments] = useState('');
  const [error, setError] = useState('');

  const evaluationDraftData = useMemo(() => ({
    ratings,
    comments
  }), [ratings, comments]);

  const { isOnline, lastSaved, hasDraft, clearDraft } = useOfflineAutoSave(
    `eval_${request.id || request.controlNo || 'draft'}`,
    evaluationDraftData,
    (draft) => {
      if (draft.ratings) setRatings(draft.ratings);
      if (draft.comments) setComments(draft.comments);
    }
  );

  const handleSubmit = (event) => {
    event.preventDefault();
    if (criteria.some(([key]) => !ratings[key])) {
      setError('Please rate every ISO/IEC 25010 criterion before submitting.');
      return;
    }

    submitEvaluation(request.id, {
      ...ratings,
      comments,
      submittedBy: requesterName || request.requestedBy
    });
    clearDraft();
    onSubmitted();
  };

  return (
    <form onSubmit={handleSubmit} style={{ padding: '20px', marginBottom: '20px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0f3ba2' }}>
          <CheckCircle2 size={18} />
          <h3 style={{ margin: 0, fontSize: '16px' }}>Evaluate Completed Request {request.controlNo || request.id}</h3>
        </div>
        <AutoSaveIndicator 
          isOnline={isOnline} 
          lastSaved={lastSaved} 
          hasDraft={hasDraft} 
          compact 
          onClearDraft={() => { clearDraft(); setRatings({}); setComments(''); }} 
        />
      </div>
      <p style={{ margin: '0 0 16px', fontSize: '12.5px', color: '#475569' }}>Rate the completed service using the ISO/IEC 25010 criteria.</p>

      <div style={{ display: 'grid', gap: '12px' }}>
        {criteria.map(([key, label, prompt]) => (
          <label key={key} style={{ display: 'grid', gridTemplateColumns: '1fr minmax(150px, 220px)', gap: '12px', alignItems: 'center', fontSize: '13px' }}>
            <span><strong>{label}</strong><br /><span style={{ color: '#64748b', fontSize: '12px' }}>{prompt}</span></span>
            <select className="form-select" required value={ratings[key] || ''} onChange={(event) => setRatings(prev => ({ ...prev, [key]: Number(event.target.value) }))}>
              <option value="">Select rating</option>
              <option value="1">1 - Strongly disagree</option>
              <option value="2">2 - Disagree</option>
              <option value="3">3 - Neutral</option>
              <option value="4">4 - Agree</option>
              <option value="5">5 - Strongly agree</option>
            </select>
          </label>
        ))}
      </div>

      <label className="form-group" style={{ display: 'block', marginTop: '14px' }}>
        <span className="form-label">Optional comments</span>
        <textarea className="form-textarea" value={comments} onChange={(event) => setComments(event.target.value)} placeholder="Tell PDAS what went well or what should improve..." />
      </label>
      {error && <div style={{ color: '#b91c1c', fontSize: '12px', marginBottom: '10px' }}>{error}</div>}
      <button type="submit" className="btn btn-primary btn-sm"><Send size={14} /> Submit Evaluation</button>
    </form>
  );
};

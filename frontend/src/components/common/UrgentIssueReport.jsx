import React, { useEffect, useState } from 'react';
import { Send } from 'lucide-react';
import { Modal } from './Modal';
import { FormField, SelectInput } from '../ui/FormField';
import { LimitedTextArea, REMARKS_WORD_LIMIT } from './LimitedTextArea';
import { validateWordLimit } from '../../utils/wordLimit';
import { JobRequestLocationStep } from './JobRequestLocationStep';

/* ==========================================================================
   Urgent Issue — fast path
   Per the conceptual framework an urgent report must be submittable with the
   ESSENTIAL details only (location + issue type) so the site hazard is
   reported immediately. The full QF-PDAS-DC-01 form is still required, but it
   becomes a same-day follow-up task rather than a gate in front of the alert.
   ========================================================================== */

export const URGENT_ISSUE_TYPES = [
  'Electrical hazard / exposed wiring',
  'Water leak / flooding',
  'Structural damage / ceiling or wall',
  'Air conditioning failure (extreme heat)',
  'Fire / smoke risk',
  'Broken lock or door access',
  'Heating / ventilation failure',
  'Other urgent hazard'
];

const EMPTY_LOCATION = { building: '', floor: '', room: '', location: '' };

export const UrgentIssueReport = ({
  isOpen,
  onClose,
  onSubmit,
  buildingIndex,
  requesterName = '',
  requesterDepartment = ''
}) => {
  const [location, setLocation] = useState(EMPTY_LOCATION);
  const [issueType, setIssueType] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  // Reset every time the dialog opens so a previous report never leaks into
  // the next one.
  useEffect(() => {
    if (isOpen) {
      setLocation(EMPTY_LOCATION);
      setIssueType('');
      setNotes('');
      setErrors({});
      setBusy(false);
    }
  }, [isOpen]);

  const patchLocation = (patch) => {
    setLocation((prev) => ({ ...prev, ...patch }));
    setErrors((prev) => {
      if (!prev.location && !prev.room) return prev;
      const next = { ...prev };
      delete next.location;
      delete next.room;
      return next;
    });
  };

  const validate = () => {
    const next = {};
    if (!location.building || !location.room) {
      next.location = 'Pick the building and room, or type the location instead.';
    }
    if (!issueType) next.issueType = 'Select the type of hazard.';
    const overLimit = validateWordLimit(notes, REMARKS_WORD_LIMIT, 'The description');
    if (overLimit) next.notes = overLimit;
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    setBusy(true);
    onSubmit({
      building: location.building,
      floor: location.floor,
      room: location.room,
      location:
        location.location.trim() || joinLocation(location.building, location.floor, location.room),
      issueType,
      notes: notes.trim(),
      requesterName,
      requesterDepartment
    });
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        onBack={onClose}
        title="Report Urgent Issue"
        maxWidth="640px"
        footer={
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              width: '100%',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '10px'
            }}
          >
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
                Cancel
              </button>
              <button type="submit" form="urgent-issue-form" className="btn btn-danger" disabled={busy}>
                <Send size={15} /> {busy ? 'Sending…' : 'Send Urgent Alert'}
              </button>
            </div>
          </div>
        }
      >
        <form id="urgent-issue-form" onSubmit={submit}>
          <JobRequestLocationStep
            buildingIndex={buildingIndex}
            value={location}
            onChange={patchLocation}
            error={errors.location}
            disabled={busy}
          />

          <div style={{ marginTop: '18px' }}>
            <FormField
              label="Type of issue"
              required
              htmlFor="urgent-type"
              error={errors.issueType}
              style={{ marginBottom: 0 }}
            >
              <SelectInput
                id="urgent-type"
                disabled={busy}
                value={issueType}
                onChange={(e) => {
                  setIssueType(e.target.value);
                  setErrors((prev) => {
                    if (!prev.issueType) return prev;
                    const next = { ...prev };
                    delete next.issueType;
                    return next;
                  });
                }}
              >
                <option value="">Select the hazard…</option>
                {URGENT_ISSUE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </SelectInput>
            </FormField>
          </div>

          <div style={{ marginTop: '14px' }}>
            <LimitedTextArea
              id="urgent-notes"
              label="What is happening? (optional)"
              rows={3}
              disabled={busy}
              value={notes}
              onChange={setNotes}
              error={errors.notes}
              hint="One or two lines is enough. You can add detail and photos later on the full form."
              placeholder="e.g. Water is coming through the ceiling above the lab bench."
            />
          </div>
        </form>
      </Modal>
    </>
  );
};

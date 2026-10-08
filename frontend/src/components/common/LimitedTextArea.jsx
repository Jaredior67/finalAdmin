import React, { useState } from 'react';
import { FormField, TextArea } from '../ui/FormField';
import {
  clampWords,
  countWords,
  DESCRIPTION_WORD_LIMIT,
  REMARKS_WORD_LIMIT
} from '../../utils/wordLimit';

/* ==========================================================================
   A description/remarks textarea with a hard word cap and a live counter.

   The cap is on the text the user can enter, not on how it is stored — a
   long value that arrived from the database (or from a paste into another
   field) is trimmed on blur rather than silently truncated on render.
   ========================================================================== */
export const LimitedTextArea = ({
  id,
  label,
  value = '',
  onChange,
  limit = DESCRIPTION_WORD_LIMIT,
  rows = 3,
  placeholder,
  hint,
  error,
  required = false,
  disabled = false,
  style,
  ...rest
}) => {
  const [overLimit, setOverLimit] = useState(false);

  const count = countWords(value);
  const nearLimit = count > limit * 0.9;
  const remaining = limit - count;

  const handleChange = (e) => {
    const raw = e.target.value;
    if (countWords(raw) > limit) {
      setOverLimit(true);
      const clamped = clampWords(raw, limit);
      onChange(clamped);
      return;
    }
    setOverLimit(false);
    onChange(raw);
  };

  const handleBlur = (e) => {
    const trimmed = clampWords(e.target.value, limit);
    if (trimmed !== e.target.value) onChange(trimmed);
    setOverLimit(false);
  };

  const counterStyle = {
    marginTop: '4px',
    display: 'flex',
    justifyContent: 'space-between',
    gap: '8px',
    fontSize: '11.5px',
    fontWeight: '500',
    lineHeight: 1.4
  };

  const countColor = overLimit
    ? '#b91c1c'
    : nearLimit
      ? '#b45309'
      : count > 0
        ? '#64748b'
        : '#94a3b8';

  return (
    <FormField label={label} htmlFor={id} required={required} hint={hint} error={error}>
      <TextArea
        id={id}
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        rows={rows}
        placeholder={placeholder}
        disabled={disabled}
        style={{
          minHeight: rows === 3 ? '95px' : undefined,
          resize: 'vertical',
          lineHeight: 1.6,
          ...style
        }}
        {...rest}
      />
      <div style={counterStyle}>
        <span style={{ color: overLimit ? '#b91c1c' : '#b91c1c' }}>
          {overLimit
            ? `Word limit reached — ${limit} words maximum.`
            : remaining <= 50
              ? `${remaining} word${remaining === 1 ? '' : 's'} remaining`
              : ''}
        </span>
        <span style={{ color: countColor, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
          {count} / {limit} words
        </span>
      </div>
    </FormField>
  );
};

export { DESCRIPTION_WORD_LIMIT, REMARKS_WORD_LIMIT };

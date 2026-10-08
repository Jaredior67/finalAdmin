/* ==========================================================================
   Word limit for free-text form fields.

   Applied to descriptions and remarks only. Identifier fields (tracking
   numbers, names) are untouched.

   The limit is enforced in three places, deliberately:
     1. onChange  — the textarea refuses to grow past the cap, so a user can
                   never *enter* more than the limit.
     2. onBlur    — text pasted in from another field is trimmed.
     3. backend   — the API rejects an over-limit payload that bypassed the UI.

   Word counting splits on whitespace, which is what a reader means by
   "words"; punctuation and newlines do not count as separators.
   ========================================================================== */

export const DESCRIPTION_WORD_LIMIT = 500;
export const REMARKS_WORD_LIMIT = 500;

export const countWords = (text) => {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
};

/* Trim `text` to at most `limit` words, preserving the original whitespace
   between the words that survive. */
export const clampWords = (text, limit) => {
  const original = String(text ?? '');
  if (countWords(original) <= limit) return original;

  // Walk the original string, keeping each word plus the whitespace that
  // followed it, and stop once the word budget is spent.
  let words = 0;
  let out = '';
  let i = 0;
  while (i < original.length && words < limit) {
    // skip leading whitespace
    while (i < original.length && /\s/.test(original[i])) i += 1;
    if (i >= original.length) break;
    // copy the word
    while (i < original.length && !/\s/.test(original[i])) {
      out += original[i];
      i += 1;
    }
    words += 1;
    // copy one whitespace run, but only if another word follows
    let j = i;
    while (j < original.length && /\s/.test(original[j])) j += 1;
    if (j < original.length && words < limit) out += original.slice(i, j);
    i = j;
  }
  return out;
};

/* The onChange handler for a limited textarea. Returns the value to store and
   the running count, so the field can show a live counter. */
export const limitedChange = (rawValue, limit, onChange, onCount) => {
  const next = clampWords(rawValue, limit);
  const count = countWords(next);
  onChange(next);
  if (onCount) onCount(count);
  return { value: next, count };
};

/* Backend-side guard. Returns null when the text is acceptable, otherwise a
   user-facing error message. */
export const validateWordLimit = (text, limit, label) => {
  const count = countWords(text);
  if (count > limit) {
    return `${label} must be ${limit} words or fewer. Yours is ${count} words.`;
  }
  return null;
};

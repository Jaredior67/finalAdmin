/* Word-limit helpers shared by the request routes.
 *
 * The cap is on WORDS, not characters, so it is independent of the database
 * column type. Keeping it in one module means the create endpoint, the
 * urgent-form completion endpoint, and any future endpoint all enforce the
 * same number and report it the same way.
 *
 * Mirrors frontend/src/utils/wordLimit.js — keep the two in step.
 */

export const DESCRIPTION_WORD_LIMIT = 500;
export const REMARKS_WORD_LIMIT = 500;

/* Count words the way a reader does: whitespace-separated runs. */
export const countWords = (text) => {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
};

/* Returns null when acceptable, otherwise a user-facing error message. */
export const wordLimitError = (text, limit, label) => {
  const count = countWords(text);
  if (count > limit) {
    return { message: `${label} must be ${limit} words or fewer (received ${count}).` };
  }
  return null;
};

/* ---------------------------------------------------------------------------
   Character limits for the narrow VARCHAR columns.

   A word cap says nothing about a VARCHAR(100). This database runs WITHOUT
   STRICT_TRANS_TABLES, so an over-length value is not rejected: it is silently
   truncated to the column width, with no error and no warning. A schedule whose
   title loses its last ten characters, or an office whose name is cut in half,
   is a data-integrity failure that no layer would report.

   Free-text fields (description, remarks, rejection reasons) are TEXT columns
   and deliberately have no length cap — use wordLimitError for those instead.
   --------------------------------------------------------------------------- */
export const lengthError = (value, max, label) => {
  if (value === null || value === undefined || value === '') return null;
  const len = String(value).length;
  if (len > max) {
    return { message: `${label} must be ${max} characters or fewer (received ${len}).` };
  }
  return null;
};

/** Check several fields at once; returns the first error, or null. */
export const lengthErrors = (fields) => {
  for (const [label, value, max] of fields) {
    const err = lengthError(value, max, label);
    if (err) return err;
  }
  return null;
};

/* The narrow columns the application writes, with their declared widths.
 * Anything a person can type into must be listed here. */
export const VARCHAR_LIMITS = {
  immediateSupervisor: 150,
  procurementStatus: 100,
  rejectionStage: 50,
  scheduleTitle: 255,
  scheduleLocation: 255,
  scheduleTimeWindow: 100,
  scheduleCategory: 100,
  inChargeName: 150,
  rejectionReason: 255,
  originalFileName: 255,
  photoName: 255
};

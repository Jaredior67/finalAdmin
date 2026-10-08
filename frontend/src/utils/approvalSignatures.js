/**
 * approvalSignatures — signatory names and titles for the printable job-request
 * documents.
 *
 * The print documents used to hardcode two people's personal names as the
 * fallback whenever the ticket carried
 * no recorded approver, and even as the text of the "Electronically Approved by"
 * stamp. Neither name appears anywhere in the capstone papers, so a printed
 * official form could assert that a specific named official had approved a
 * request that nobody had in fact approved.
 *
 * The rule now: print a personal name only when the database recorded it.
 * Otherwise leave the line blank for wet-ink signature and print the OFFICE
 * instead. Offices are constants; people are data.
 */

/** Office held by the PDAS signatory on the form. */
export const PDAS_HEAD_TITLE =
  'Head, PDAS / Director, Planning Development and Auxiliary Services';

/** Office held by the final approver. */
export const APPROVER_TITLE = 'Campus Administrator (Final Approver)';

/** An unsigned line. A form with no recorded signatory must look unsigned. */
export const UNSIGNED_LINE = '________________________';

/**
 * First non-blank candidate, or the blank signature line.
 *
 * @param {...(string|null|undefined)} candidates values in priority order
 * @returns {string}
 */
export const signatoryName = (...candidates) => {
  for (const candidate of candidates) {
    const name = typeof candidate === 'string' ? candidate.trim() : '';
    if (name) return name;
  }
  return UNSIGNED_LINE;
};

/**
 * The "Electronically Approved by …" stamp text, or null when no real person is
 * on record. Returning null (rather than a placeholder) is what stops a form
 * from carrying an approval stamp naming someone who never acted.
 *
 * @param {...(string|null|undefined)} candidates values in priority order
 * @returns {string|null}
 */
export const approvalStamp = (...candidates) => {
  const name = signatoryName(...candidates);
  return name === UNSIGNED_LINE ? null : name;
};

/**
 * Formats a timestamp into a formal government standard timestamp format.
 * Format: [Month] [Day], [Year] at [HH:mm AM/PM]
 *
 * @param {string|Date} dateString 
 * @returns {string}
 */
export const formatGovTimestamp = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  
  const formattedDate = date.toLocaleString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
  const formattedTime = date.toLocaleString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
  
  return `${formattedDate} at ${formattedTime}`;
};


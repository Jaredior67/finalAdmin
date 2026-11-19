/* "Which requests are mine?"
   
   The Dashboard tiles and the Request History / Active Tickets views both
   answer that question. This single robust predicate is imported everywhere.
   Supports loose string/number ID equality, trimmed case-insensitive email,
   idNumber match, and name containment. */
export const filterMyRequests = (requisitions, currentUser) => {
  if (!currentUser) return [];

  const myId = currentUser.id != null ? String(currentUser.id).trim() : null;
  const myEmail = currentUser.email ? currentUser.email.trim().toLowerCase() : null;
  const myName = currentUser.name ? currentUser.name.trim().toLowerCase() : null;
  const myIdNumber = currentUser.idNumber ? String(currentUser.idNumber).trim().toLowerCase() : null;

  return (requisitions || []).filter((r) => {
    // Hidden only if manually archived and not a completed/rejected record
    const visible = !r.isArchived || r.status === 'Completed' || r.status === 'Rejected';
    if (!visible) return false;

    // 1. Direct ID match (loose string/number)
    const rId = r.requesterId ?? r.requester_id;
    if (myId && rId != null && String(rId).trim() === myId) return true;

    // 2. Email match (case-insensitive & trimmed)
    const rEmail = (r.requesterEmail || r.requester_email || '')?.trim().toLowerCase();
    if (myEmail && rEmail && rEmail === myEmail) return true;

    // 3. ID Number match (e.g. employee/faculty ID number)
    const rIdNumber = (r.idNumber || r.id_number || '')?.trim().toLowerCase();
    if (myIdNumber && rIdNumber && rIdNumber === myIdNumber) return true;

    // 4. Name match (case-insensitive containment either way)
    const rName = (r.requestedBy || r.requester_name || '')?.trim().toLowerCase();
    if (myName && rName && (rName.includes(myName) || myName.includes(rName))) return true;

    return false;
  });
};

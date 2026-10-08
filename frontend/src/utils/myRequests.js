/* "Which requests are mine?"

   The Dashboard tiles and the list pages ("My Active Tickets", "Request
   History") both answer that question, and each used to hold its own copy of
   the answer. The Dashboard matched on e-mail and name only and had no archive
   rule, so a request could raise a count on the Dashboard and be missing from
   the list that count claimed to summarise.

   One predicate, imported by both. Change it here or not at all. */
export const filterMyRequests = (requisitions, currentUser) =>
  (requisitions || []).filter((r) => {
    /* Completed and Rejected requests are archived the instant they are
       written. Leaving those out would empty the History tab and take the
       "Rate Service" button away before anyone could press it, so the archive
       flag only hides tickets filed away by hand. */
    const visible = !r.isArchived || r.status === 'Completed' || r.status === 'Rejected';
    if (!visible) return false;

    const id = currentUser?.id;
    const email = currentUser?.email?.toLowerCase();
    const name = currentUser?.name?.toLowerCase();

    return Boolean(
      (id && (r.requesterId === id || r.requester_id === id)) ||
      (email && (
        r.requesterEmail?.toLowerCase() === email ||
        r.requester_email?.toLowerCase() === email
      )) ||
      (name && r.requestedBy?.toLowerCase().includes(name))
    );
  });

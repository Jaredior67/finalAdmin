/* ============================================================================
   Request intake — the ONE definition of how a job request is started.

   This module is deliberately role-agnostic. Every account that can file a
   request (Faculty, Staff, PDAS Administration) must produce the same record
   from the same form, so anything that shapes that record lives here rather
   than being re-implemented per dashboard.

   Before this existed the Faculty portal and the Admin dashboard each had their
   own copy of the category list, the scope-of-works builder and the
   addRequisition payload. They had already drifted apart:

     - the Admin's category list was missing "Safety & Compliance"
     - the two scope builders disagreed on categories with no matching section
       (Faculty silently fell back to ELECTRICAL, Admin checked nothing)
     - the Admin passed `urgentPendingStandardForm: false`, which overrode the
       value DataContext derives — so an urgent request filed by an admin never
       showed the "complete the standard form" reminder that faculty saw
   ========================================================================== */

/* The one category list. QF-PDAS-DC-01 scope sections cover six trades; the
   remaining categories are legitimate request types that simply have no
   dedicated trade section on the form. */
export const CATEGORY_OPTIONS = [
  'Electrical',
  'Air Conditioning',
  'Mechanical',
  'Water/Sanitary',
  'Physical Structures',
  'Drawing/Design',
  'Safety & Compliance'
];

export const SCOPE_SECTIONS = [
  { key: 'drawingDesign', label: '1. DRAWING / DESIGN', options: ['Floor Plans', 'Detailed Drawings', 'Perspective', 'Specifications', 'List of Materials', 'Other Services'] },
  { key: 'physicalStructures', label: '2. PHYSICAL STRUCTURES', options: ['New Structure', 'Rehabilitation/Repair', 'Renovation', 'Partial', 'Full', 'Other Services'] },
  { key: 'electrical', label: '3. ELECTRICAL', options: ['New Installation', 'Repair', 'Rehabilitation', 'Other Services'] },
  { key: 'mechanical', label: '4. MECHANICAL', options: ['New Installation', 'Repair', 'Rehabilitation', 'Other Services'] },
  { key: 'waterSanitary', label: '5. WATER / SANITARY', options: ['New Installation', 'Repair', 'Rehabilitation', 'Other Services'] },
  { key: 'airConditioning', label: '6. AIR CONDITIONING', options: ['New Installation', 'Repair', 'Rehabilitation', 'Other Services'] },
];

/* Category -> QF-PDAS-DC-01 scope section key. A category with no entry (e.g.
   Safety & Compliance) must leave every section unchecked: pre-ticking
   ELECTRICAL on a fire-safety request is a false statement on an official
   document. */
export const CATEGORY_SCOPE_KEY = {
  'Drawing/Design': 'drawingDesign',
  'Physical Structures': 'physicalStructures',
  Electrical: 'electrical',
  Mechanical: 'mechanical',
  'Water/Sanitary': 'waterSanitary',
  'Air Conditioning': 'airConditioning'
};

const SCOPE_KEYS = Object.values(CATEGORY_SCOPE_KEY);

/* Builds the Scope of Works block. The shape matches the overlay's own
   blankScope() — options / description / dateComplied. There is no `checked`
   flag: nothing in the app or the print sheet reads one. */
export function buildScopeOfWorks(category, description = '', selectedOptions = []) {
  const target = CATEGORY_SCOPE_KEY[category] || null;
  return SCOPE_KEYS.reduce((acc, key) => {
    acc[key] = {
      options: key === target ? [...selectedOptions] : [],
      description: key === target ? description : '',
      dateComplied: ''
    };
    return acc;
  }, {});
}

/** The "Building — Floor — Room" string used on the official form. */
export const composeLocation = (building, floor, room) =>
  [building, floor, room].filter(Boolean).join(' — ');

/** Human label for who is filing, used in the confirmation copy. */
export const requesterDisplayName = (requester = {}) =>
  requester.name || 'Requester';

/* ---------------------------------------------------------------------------
   buildRequisitionPayload — the single mapping from the filled form to the
   record that addRequisition() stores.

   Both entry paths (Standard overlay and Urgent fast path) go through here, so
   a request filed by an admin and a request filed by a lecturer are structurally
   identical. `DataContext.addRequisition` derives fields we deliberately do
   not set here (urgentPendingStandardForm, tracking numbers, timestamps).
   --------------------------------------------------------------------------- */
export function buildRequisitionPayload({
  form = {},
  requestType = 'Standard Request',
  urgency,
  requester = {},
  office = '',
  isDraft = false,
  photoUrl = ''
}) {
  const isUrgent = requestType === 'Urgent Request';

  // The overlay always returns the three location parts alongside the composed
  // string, so a scanned room arrives here already split out.
  const building = form.building || '';
  const floor = form.floor || '';
  const room = form.room || '';
  const location =
    form.location?.trim() || composeLocation(building, floor, room);

  const description = (form.description || '').trim();
  const category = form.category || 'Electrical';

  return {
    title: form.title || '',
    description,
    building,
    floor,
    room,
    location,

    // A scanned room gets a stable reference so the ticket can be traced back
    // to the physical QR tag it came from. The form's own `qrCodeRef` — the
    // value the scanner actually matched — wins; recomputing from the room name
    // produced a different tag than the one on the wall (scanning ISATU-ADM-PDAS
    // recorded "ISATU-PLANNING") and broke the trace. The computed value is only
    // a fallback for a hand-typed location.
    qrCodeRef:
      form.qrCodeRef ||
      (room ? `ISATU-${room.replace(/\s+/g, '-').slice(0, 10).toUpperCase()}` : ''),

    // Foreign key into campus_locations. Sent only when it is a real database
    // id; the locally seeded registry uses string ids like "loc-adm-01", which
    // would silently coerce to 0 against an INT column.
    locationId:
      form.locationId !== undefined && form.locationId !== null && /^\d+$/.test(String(form.locationId))
        ? Number(form.locationId)
        : null,

    category,
    // Urgent is always High Risk; the standard path honours what was chosen.
    urgency: isUrgent ? 'High Risk' : urgency || form.urgency || 'Medium Risk',
    requestType,
    isStandardFormFilled: !isUrgent,

    immediateSupervisor: form.immediateSupervisor || '',
    scopeOfWorks: form.scopeOfWorks || buildScopeOfWorks(category, description),
    actionTaken: form.actionTaken || {
      endorsedDesignTeam: { checked: false },
      endorsedGSMHead: { checked: false },
      returnedToClient: { checked: false }
    },
    finalAction: form.finalAction || { status: 'Pending', remarks: '' },

    pdasFormName: '',
    requestedBy: form.requestedBy || requesterDisplayName(requester),
    requesterEmail: requester.email || '',
    requesterRole: requester.role || 'Faculty',
    department: form.department || requester.department || office || 'ISAT U Dumangas',
    contactNumber: form.contactNumber || requester.phone || '',
    idNumber: requester.idNumber || '',

    photoUrl: photoUrl || form.photoUrl || '',
    // The attachment's display name. It was carried in the form state and then
    // dropped here, so every stored request claimed an unnamed photo even when
    // the picture itself arrived.
    photoName: form.photoName || '',
    isDraft
  };
}

import fs from 'fs';
import path from 'path';

/* Notification and toast copy.
 *
 * These strings are read by other people, in a bell, while doing something
 * else. They were rewritten to one rule each: name the record, name the state,
 * stop. The previous text carried emoji, ALL-CAPS prefixes, ampersands,
 * instructions to the reader ("Please generate tracking number..."), raw
 * database ids, and sentences of fourteen words where six would do.
 */
const file = path.resolve('src/routes/requisitionRoutes.js');
let text = fs.readFileSync(file, 'utf8');

const swaps = [
  // Submission
  [
    "'\u{1F6A8} High Risk Facility Alert'",
    "'High Risk request filed'"
  ],
  [
    '`URGENT: ${ticketNo} submitted at location (${finalCategory}). Rapid response required.`',
    '`${ticketNo} was filed as High Risk, ${finalCategory}. It needs a response now.`'
  ],
  [
    "'New Job Request for Immediate Supervisor Review'",
    "'Awaiting your endorsement'"
  ],
  [
    '`${ticketNo} submitted by ${req.user.email} awaits your supervisory review & endorsement.`',
    '`${ticketNo} was filed by ${req.user.email} and is waiting on you.`'
  ],
  [
    "`Your request ${ticketNo} was submitted and routed to your Immediate Supervisor for initial endorsement.`",
    "`${ticketNo} is with your Immediate Supervisor.`"
  ],

  // Supervisor stage
  [
    "`${jr.ticket_no} approved by Immediate Supervisor and routed to PDAS Admin.`",
    "`${jr.ticket_no} was endorsed by the Immediate Supervisor. It is now with PDAS.`"
  ],
  [
    "`Your request ${jr.ticket_no} was approved by your Immediate Supervisor and forwarded to PDAS Admin for review.`",
    "`${jr.ticket_no} was endorsed by your Immediate Supervisor and is now with PDAS.`"
  ],
  [
    '`Your request ${jr.ticket_no} was returned for revision: ${remarks.trim()}`',
    '`${jr.ticket_no} was returned for revision: ${remarks.trim()}`'
  ],

  // PDAS stage
  [
    "`PDAS Admin has begun evaluation of ${jr.ticket_no}.`",
    "`PDAS has started work on ${jr.ticket_no}.`"
  ],
  [
    "`${jr.ticket_no} has received PDAS Admin approval and awaits your final signatory review.`",
    "`${jr.ticket_no} is waiting for your final approval.`"
  ],
  [
    "`Your request ${jr.ticket_no} was approved by Administrator and is now Pending Final Approval with Campus Administrator.`",
    "`${jr.ticket_no} was approved by PDAS. It is now with the Campus Administrator.`"
  ],
  [
    "`PDAS Admin returned ${jr.ticket_no} for revision: ${combinedRemarks}`",
    "`${jr.ticket_no} was returned for revision: ${combinedRemarks}`"
  ],

  // Campus Administrator stage
  [
    "`${jr.ticket_no} has received final approval from Campus Administrator. Please generate tracking number and assign maintenance personnel.`",
    "`${jr.ticket_no} was approved by the Campus Administrator. It needs a control number and an assignee.`"
  ],
  [
    "`Your request ${jr.ticket_no} has received Final Approval from Campus Administrator. Work order assignment in progress.`",
    "`${jr.ticket_no} was approved by the Campus Administrator. Maintenance is being assigned.`"
  ],
  [
    "`${jr.ticket_no} was disapproved by Campus Administrator: ${remarks.trim()}. Returned through PDAS Admin to requester.`",
    "`${jr.ticket_no} was not approved: ${remarks.trim()}`"
  ],
  [
    "`${jr.ticket_no} was returned through PDAS Admin following Campus Administrator review: ${remarks.trim()}`",
    "`${jr.ticket_no} was not approved: ${remarks.trim()}`"
  ],

  // Assignment
  [
    "`You have been assigned to ${jr.ticket_no} (Tracking: ${officialTracking}). Work is now Ongoing.`",
    "`${jr.ticket_no} is assigned to you. Control number ${officialTracking}.`"
  ],
  [
    "`Your request ${jr.ticket_no} (Tracking: ${officialTracking}) has been assigned to PDAS maintenance staff and is now Ongoing.`",
    "`${jr.ticket_no} has been assigned to maintenance. Control number ${officialTracking}.`"
  ],
  [
    "'Technician Assigned & Ongoing'",
    "'Work order assigned'"
  ],
  // The old text leaked a raw database id and carried a mangled dash.
  [
    "`${jr.ticket_no} (${officialTracking}) is now Ongoing �?\" assigned to personnel ID ${assignedTo}.`",
    "`${jr.ticket_no} is assigned. Control number ${officialTracking}.`"
  ],

  // Replacement flag
  [
    "'\u{1F6A8}\u{FFFD}\u{FFFD}?,? Replacement and Disposal Flag Raised'",
    "'Replacement flagged'"
  ],
  [
    '`Item marked irreparable on ${jr.ticket_no} by maintenance staff: ${reason.trim()}. Initiate procurement/replacement.`',
    '`${jr.ticket_no}: ${reason.trim()}. Procurement is required.`'
  ],
  [
    "'\u{1F6A8}\u{FFFD}\u{FFFD}?,? Irreparable Item Flagged for Replacement'",
    "'Replacement flagged'"
  ],
  [
    "`${jobRequest.ticket_no}: Maintenance reported irreparable equipment. Procurement replacement needed.`",
    "`${jobRequest.ticket_no} was reported irreparable. Procurement is required.`"
  ],

  // Status change
  [
    '`${jobRequest.ticket_no} is now "${targetStatus}". ${remarks ? `(${remarks})` : \'\'}`',
    '`${jobRequest.ticket_no} is now ${targetStatus}.${remarks ? ` ${remarks}` : \'\'}`'
  ],
  [
    '`Assigned job ${jobRequest.ticket_no} updated to "${targetStatus}".`',
    '`${jobRequest.ticket_no} is now ${targetStatus}.`'
  ],
  [
    '`${jobRequest.ticket_no} changed from "${currentStatus}" to "${targetStatus}".`',
    '`${jobRequest.ticket_no} moved from ${currentStatus} to ${targetStatus}.`'
  ],

  // Evaluation prompt
  [
    '`${jobRequest.ticket_no} has been completed. Please submit your ISO/IEC 25010 service quality feedback.`',
    '`${jobRequest.ticket_no} is complete. Please rate the work.`'
  ]
];

let applied = 0;
let missed = [];

for (const [from, to] of swaps) {
  if (text.includes(from)) {
    text = text.split(from).join(to);
    applied += 1;
  } else {
    missed.push(from.slice(0, 70));
  }
}

fs.writeFileSync(file, text, 'utf8');
console.log(`applied ${applied}/${swaps.length}`);
if (missed.length) {
  console.log('not found:');
  for (const m of missed) console.log('  ', m);
}

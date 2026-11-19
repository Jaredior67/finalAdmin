
import nodemailer from 'nodemailer';

const { GMAIL_USER, GMAIL_APP_PASSWORD } = process.env;
const FRONTEND_URL = (process.env.FRONTEND_ORIGIN || 'http://localhost:5173').split(',')[0].trim();

const transporter =
  GMAIL_USER && GMAIL_APP_PASSWORD
    ? nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: GMAIL_USER,
          pass: GMAIL_APP_PASSWORD.replace(/\s/g, ''),
        },
      })
    : null;

// Email notifications are disabled per study objectives (using in-app notifications only).
// Can be optionally re-enabled by setting ENABLE_EMAIL_NOTIFICATIONS=true in .env
const EMAIL_NOTIFICATIONS_ENABLED = process.env.ENABLE_EMAIL_NOTIFICATIONS === 'true';

function getTransporter() {
  const user = process.env.GMAIL_USER;
  const rawPass = process.env.GMAIL_APP_PASSWORD;
  const pass = rawPass ? rawPass.replace(/\s/g, '') : null;
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });
}

/** Low-level send. Never throws — email is best-effort; workflow must not fail. */
export async function sendNotification({ to, subject, text, html }) {
  if (!EMAIL_NOTIFICATIONS_ENABLED) {
    return; // Email notifications disabled — in-app notifications only
  }
  const mailer = getTransporter() || transporter;
  if (!mailer) {
    console.warn('[Email] Skipped — GMAIL_USER / GMAIL_APP_PASSWORD not set in .env');
    return;
  }
  if (!to) return;
  try {
    await mailer.sendMail({
      from: `"FixIT – PDAS Notifications" <${process.env.GMAIL_USER || GMAIL_USER}>`,
      to,
      subject,
      text: text || subject,
      html: html || `<p>${text || subject}</p>`,
    });
  } catch (err) {
    console.warn(`[Email] Failed to send "${subject}" to ${to}:`, err.message);
  }
}

/**
 * Send Password Reset OTP Email via Gmail.
 * Authentication security service — operates independently of optional study notification toggles.
 */
export async function sendPasswordResetOtpEmail({ to, recipientName = 'User', otpCode }) {
  const mailer = getTransporter() || transporter;
  const subject = `Your FixIT Verification Code: ${otpCode}`;
  const senderUser = process.env.GMAIL_USER || GMAIL_USER;

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#0d1b4c;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d1b4c;padding:32px 16px">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 12px 36px rgba(0,0,0,0.35)">
          <tr>
            <td style="background:linear-gradient(135deg,#001f9c,#071670);padding:24px 32px;text-align:left">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <div style="color:#ffffff;font-size:22px;font-weight:800;letter-spacing:-0.02em">FixIT PDAS</div>
                    <div style="color:#93c5fd;font-size:12px;font-weight:600;margin-top:2px">ISAT U Dumangas Campus · Security Authentication</div>
                  </td>
                  <td align="right">
                    <span style="background:rgba(255,255,255,0.15);color:#ffffff;font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;border:1px solid rgba(255,255,255,0.25)">Password Reset</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 32px 24px">
              <h2 style="margin:0 0 12px;color:#0f172a;font-size:19px;font-weight:800">Verification Code Request</h2>
              <p style="margin:0 0 16px;color:#475569;font-size:14px;line-height:1.6">
                Hello <strong>${recipientName}</strong>,<br>
                We received a request to reset your password for your FixIT PDAS account. Enter the verification code below on the reset screen:
              </p>
              
              <div style="text-align:center;margin:28px 0;padding:20px;background:#f8faff;border:2px dashed #bfdbfe;border-radius:12px">
                <div style="font-size:12px;font-weight:800;color:#001f9c;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px">One-Time Verification Code</div>
                <div style="display:inline-block;background:#001f9c;color:#ffffff;font-size:34px;font-weight:900;letter-spacing:10px;padding:12px 24px;border-radius:10px;font-family:Consolas,Monaco,'Courier New',monospace;box-shadow:0 6px 16px rgba(0,31,156,0.3)">
                  ${otpCode}
                </div>
                <div style="color:#64748b;font-size:12px;margin-top:10px">
                  ⏳ This code expires in <strong>15 minutes</strong> and can only be used once.
                </div>
              </div>

              <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px 14px;margin-bottom:20px">
                <table cellpadding="0" cellspacing="0">
                  <tr>
                    <td valign="top" style="font-size:16px;padding-right:8px">🔒</td>
                    <td style="font-size:12px;color:#92400e;line-height:1.5">
                      <strong>Security Tip:</strong> Never share this code with anyone. FixIT administrators or technical personnel will never ask for your code. If you did not request this password reset, please ignore this email or contact the PDAS office immediately.
                    </td>
                  </tr>
                </table>
              </div>

              <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
              <p style="font-size:11px;color:#94a3b8;margin:0;line-height:1.5">
                ISAT U Dumangas Campus — Physical Development &amp; Auxiliary Services<br>
                Automated security notification. Please do not reply directly to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body></html>`;

  if (!mailer) {
    console.log(`[AUTH GMAIL OTP] Dispatched verification code to ${to} (dev fallback): ${otpCode}`);
    console.warn('[AUTH GMAIL OTP] Gmail transporter not configured — logged to console above.');
    return { success: true, delivered: false, simulated: true };
  }

  console.log(`[AUTH GMAIL OTP] Dispatched verification code to ${to} [REDACTED]`);

  try {
    const info = await mailer.sendMail({
      from: `"FixIT Security" <${senderUser}>`,
      to,
      subject,
      text: `Your FixIT verification code is: ${otpCode}. It expires in 15 minutes.`,
      html,
    });
    return { success: true, delivered: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[AUTH GMAIL OTP] Error sending to ${to}:`, err.message);
    // Don't crash — OTP is recorded in DB and console
    return { success: true, delivered: false, error: err.message };
  }
}

/**
 * Send Password Reset Success Alert via Gmail.
 */
export async function sendPasswordResetSuccessEmail({ to, recipientName = 'User' }) {
  const mailer = getTransporter() || transporter;
  const subject = `Security Alert: Your FixIT Password Has Been Changed`;
  const senderUser = process.env.GMAIL_USER || GMAIL_USER;

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#0d1b4c;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d1b4c;padding:32px 16px">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 12px 36px rgba(0,0,0,0.35)">
          <tr>
            <td style="background:#059669;padding:20px 32px;text-align:left">
              <div style="color:#ffffff;font-size:20px;font-weight:800">FixIT PDAS · Password Changed</div>
              <div style="color:#d1fae5;font-size:12px;font-weight:600;margin-top:2px">ISAT U Dumangas Campus</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px">
              <h2 style="margin:0 0 12px;color:#0f172a;font-size:18px;font-weight:800">Password Reset Completed</h2>
              <p style="margin:0 0 16px;color:#475569;font-size:14px;line-height:1.6">
                Hello <strong>${recipientName}</strong>,<br>
                The password for your FixIT PDAS account has been successfully reset. You can now log in using your new password.
              </p>
              <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:14px;color:#166534;font-size:13px;line-height:1.5;margin-bottom:20px">
                ✓ If you authorized this change, you do not need to take any further action.
              </div>
              <p style="margin:0 0 16px;color:#dc2626;font-size:13px;line-height:1.5">
                ⚠️ If you did <strong>NOT</strong> authorize this password reset, please contact the System Administrator or PDAS office immediately to secure your account.
              </p>
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
              <p style="font-size:11px;color:#94a3b8;margin:0">
                FixIT PDAS Automated Security System
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body></html>`;

  if (!mailer) return { success: true, delivered: false };

  try {
    await mailer.sendMail({
      from: `"FixIT Security" <${senderUser}>`,
      to,
      subject,
      text: `Your FixIT password has been successfully reset. If you did not authorize this, contact PDAS immediately.`,
      html,
    });
    return { success: true, delivered: true };
  } catch (err) {
    console.warn(`[AUTH GMAIL] Failed to send password reset confirmation to ${to}:`, err.message);
    return { success: false, error: err.message };
  }
}


/** Send the same notification to multiple addresses (deduped). */
export async function sendBulk(recipients, { subject, text, html }) {
  const unique = [...new Set((recipients || []).filter(Boolean))];
  await Promise.allSettled(unique.map((to) => sendNotification({ to, subject, text, html })));
}

// ─── Styled HTML template ────────────────────────────────────────────────────
function renderHtml(title, bodyHtml, ctaLabel = null, ctaUrl = null) {
  const cta = ctaLabel && ctaUrl
    ? `<p style="text-align:center;margin:24px 0">
         <a href="${ctaUrl}" style="background:#1e40af;color:#fff;text-decoration:none;padding:10px 24px;border-radius:6px;font-weight:600;font-size:14px">${ctaLabel}</a>
       </p>`
    : '';
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
      <tr><td style="background:#1e40af;padding:20px 32px">
        <span style="color:#fff;font-size:20px;font-weight:700">FixIT – PDAS</span>
        <span style="color:#93c5fd;font-size:13px;margin-left:12px">ISAT-U Dumangas Campus</span>
      </td></tr>
      <tr><td style="padding:32px">
        <h2 style="margin:0 0 16px;color:#1e293b;font-size:18px">${title}</h2>
        ${bodyHtml}
        ${cta}
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
        <p style="font-size:11px;color:#94a3b8;margin:0">This is an automated message from FixIT. Do not reply to this email.</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

// ─── Workflow event helpers ───────────────────────────────────────────────────

export async function emailNewRequest(adminEmails, { ticketNo, category, urgency, requesterName, isUrgent }) {
  const subject = isUrgent
    ? `URGENT: Emergency Incident ${ticketNo} Filed`
    : `New Job Request Filed – ${ticketNo}`;
  const body = `<p>Hello,</p>
    <p>${isUrgent ? '<strong>⚠️ Urgent incident filed — immediate dispatch required.</strong>' : 'A new job request has been submitted and is awaiting action.'}</p>
    <table style="font-size:13px;border-collapse:collapse;width:100%">
      <tr><td style="padding:6px 12px;background:#f8fafc;font-weight:600;width:40%">Ticket No.</td><td style="padding:6px 12px">${ticketNo}</td></tr>
      <tr><td style="padding:6px 12px;background:#f8fafc;font-weight:600">Requester</td><td style="padding:6px 12px">${requesterName}</td></tr>
      <tr><td style="padding:6px 12px;background:#f8fafc;font-weight:600">Category</td><td style="padding:6px 12px">${category}</td></tr>
      <tr><td style="padding:6px 12px;background:#f8fafc;font-weight:600">Urgency</td><td style="padding:6px 12px">${urgency}</td></tr>
    </table>`;
  await sendBulk(adminEmails, {
    subject, text: `${subject}\nTicket: ${ticketNo} | ${category} | ${urgency}`,
    html: renderHtml(subject, body, 'View in FixIT', `${FRONTEND_URL}/admin-dashboard`),
  });
}

export async function emailSupervisorEndorsed(requesterEmail, { ticketNo, supervisorName }) {
  const subject = `Supervisor Endorsed – ${ticketNo}`;
  const body = `<p>Hello,</p>
    <p>Your job request <strong>${ticketNo}</strong> was endorsed by <strong>${supervisorName}</strong> and is now with the PDAS Office.</p>`;
  await sendNotification({
    to: requesterEmail, subject,
    text: `${ticketNo} endorsed by ${supervisorName}. Now with PDAS.`,
    html: renderHtml(subject, body, 'Track Your Request', `${FRONTEND_URL}/faculty-staff-portal`),
  });
}

export async function emailSupervisorReturned(requesterEmail, { ticketNo, remarks }) {
  const subject = `Request Returned for Revision – ${ticketNo}`;
  const body = `<p>Hello,</p>
    <p>Your job request <strong>${ticketNo}</strong> was returned by your Immediate Supervisor:</p>
    <blockquote style="border-left:3px solid #e2e8f0;margin:12px 0;padding:8px 16px;color:#475569">${remarks}</blockquote>
    <p>Please revise and resubmit your request.</p>`;
  await sendNotification({
    to: requesterEmail, subject,
    text: `${ticketNo} returned by Supervisor: ${remarks}`,
    html: renderHtml(subject, body, 'Revise Your Request', `${FRONTEND_URL}/faculty-staff-portal`),
  });
}

export async function emailAdminApproved(approverEmails, requesterEmail, { ticketNo }) {
  const approverSubject = `Pending Final Approval – ${ticketNo}`;
  const approverBody = `<p>Hello,</p><p>Job request <strong>${ticketNo}</strong> was reviewed by PDAS and is now awaiting your final approval.</p>`;
  const requesterSubject = `PDAS Approved – ${ticketNo}`;
  const requesterBody = `<p>Hello,</p><p>Your job request <strong>${ticketNo}</strong> was approved by PDAS and forwarded to the Campus Administrator for final approval.</p>`;
  await sendBulk(approverEmails, {
    subject: approverSubject,
    text: `${ticketNo} is pending your final approval.`,
    html: renderHtml(approverSubject, approverBody, 'Review in FixIT', `${FRONTEND_URL}/campus-admin-dashboard`),
  });
  await sendNotification({
    to: requesterEmail, subject: requesterSubject,
    text: `${ticketNo} approved by PDAS. Now with Campus Administrator.`,
    html: renderHtml(requesterSubject, requesterBody, 'Track Your Request', `${FRONTEND_URL}/faculty-staff-portal`),
  });
}

export async function emailFinalApproved(requesterEmail, adminEmails, { ticketNo }) {
  const subject = `Final Approval Granted – ${ticketNo}`;
  const requesterBody = `<p>Hello,</p><p>Your job request <strong>${ticketNo}</strong> received final approval from the Campus Administrator. Maintenance will be dispatched shortly.</p>`;
  const adminBody = `<p>Hello,</p><p>Job request <strong>${ticketNo}</strong> was finally approved. Please assign a technician and issue a control number.</p>`;
  await sendNotification({
    to: requesterEmail, subject,
    text: `${ticketNo} received final approval. Maintenance is being assigned.`,
    html: renderHtml(subject, requesterBody, 'Track Your Request', `${FRONTEND_URL}/faculty-staff-portal`),
  });
  await sendBulk(adminEmails, {
    subject,
    text: `${ticketNo} approved. Please assign a technician.`,
    html: renderHtml(subject, adminBody, 'Assign Technician', `${FRONTEND_URL}/admin-dashboard`),
  });
}

export async function emailFinalRejected(adminEmails, requesterEmail, { ticketNo, remarks }) {
  const subject = `Request Not Approved – ${ticketNo}`;
  const body = `<p>Hello,</p>
    <p>Job request <strong>${ticketNo}</strong> was not approved by the Campus Administrator:</p>
    <blockquote style="border-left:3px solid #e2e8f0;margin:12px 0;padding:8px 16px;color:#475569">${remarks}</blockquote>
    <p>It has been returned to the PDAS Office for further action.</p>`;
  await sendBulk(adminEmails, {
    subject, text: `${ticketNo} not approved: ${remarks}`,
    html: renderHtml(subject, body, 'View in FixIT', `${FRONTEND_URL}/admin-dashboard`),
  });
  await sendNotification({
    to: requesterEmail, subject,
    text: `${ticketNo} not approved: ${remarks}`,
    html: renderHtml(subject, body, 'Track Your Request', `${FRONTEND_URL}/faculty-staff-portal`),
  });
}

export async function emailAssigned(technicianEmail, requesterEmail, { ticketNo, officialTracking, technicianName }) {
  const techSubject = `Work Order Assigned to You – ${ticketNo}`;
  const techBody = `<p>Hello <strong>${technicianName}</strong>,</p>
    <p>A work order has been assigned to you.</p>
    <table style="font-size:13px;border-collapse:collapse;width:100%">
      <tr><td style="padding:6px 12px;background:#f8fafc;font-weight:600;width:40%">Ticket No.</td><td style="padding:6px 12px">${ticketNo}</td></tr>
      <tr><td style="padding:6px 12px;background:#f8fafc;font-weight:600">Control No.</td><td style="padding:6px 12px">${officialTracking}</td></tr>
    </table>`;
  const reqSubject = `Maintenance Dispatched – ${ticketNo}`;
  const reqBody = `<p>Hello,</p><p>Maintenance for <strong>${ticketNo}</strong> (Control No. <strong>${officialTracking}</strong>) has been assigned to <strong>${technicianName}</strong>.</p>`;
  await sendNotification({
    to: technicianEmail, subject: techSubject,
    text: `${ticketNo} (${officialTracking}) assigned to you.`,
    html: renderHtml(techSubject, techBody, 'View Work Order', `${FRONTEND_URL}/maintenance-dashboard`),
  });
  await sendNotification({
    to: requesterEmail, subject: reqSubject,
    text: `${ticketNo} assigned to ${technicianName}. Control: ${officialTracking}.`,
    html: renderHtml(reqSubject, reqBody, 'Track Your Request', `${FRONTEND_URL}/faculty-staff-portal`),
  });
}

export async function emailCompleted(requesterEmail, { ticketNo }) {
  const subject = `Work Completed – Please Rate the Service – ${ticketNo}`;
  const body = `<p>Hello,</p>
    <p>Job request <strong>${ticketNo}</strong> has been marked as <strong>Completed</strong>.</p>
    <p>Please take a moment to rate the service using the ISO/IEC 25010 evaluation form. Your feedback helps us improve.</p>`;
  await sendNotification({
    to: requesterEmail, subject,
    text: `${ticketNo} is complete. Please rate the service in FixIT.`,
    html: renderHtml(subject, body, 'Rate the Service', `${FRONTEND_URL}/faculty-staff-portal`),
  });
}

export async function emailUrgentFollowUpRequired(requesterEmail, { ticketNo }) {
  const subject = `Action Required: Submit Follow-Up Form – ${ticketNo}`;
  const body = `<p>Hello,</p>
    <p>Urgent incident <strong>${ticketNo}</strong> has been resolved. You are required to submit the official <strong>QF-PDAS-DC-01</strong> follow-up form within <strong>24 hours</strong>.</p>`;
  await sendNotification({
    to: requesterEmail, subject,
    text: `Urgent ${ticketNo} resolved. Submit QF-PDAS-DC-01 within 24 hours.`,
    html: renderHtml(subject, body, 'Submit Follow-Up Form', `${FRONTEND_URL}/faculty-staff-portal`),
  });
}

export async function emailUrgentAssignedReminder(requesterEmail, { ticketNo, officialTracking }) {
  const subject = `Action Required: Submit Standard Form (24h Deadline) – ${ticketNo}`;
  const body = `<p>Hello,</p>
    <p>Maintenance personnel has been dispatched for urgent incident <strong>${ticketNo}</strong> (Tracking No. <strong>${officialTracking}</strong>).</p>
    <p style="color: #b91c1c; font-weight: 600;">Please submit the official standard form (QF-PDAS-DC-01) within 24 hours to fulfill the standard process.</p>`;
  await sendNotification({
    to: requesterEmail, subject,
    text: `Urgent request ${ticketNo} assigned. Submit standard form (QF-PDAS-DC-01) within 24 hours.`,
    html: renderHtml(subject, body, 'Submit Standard Form', `${FRONTEND_URL}/faculty-staff-portal`),
  });
}

export async function emailUrgentOverdueRequester(requesterEmail, { ticketNo, officialTracking }) {
  const subject = `OVERDUE NOTICE: Standard Form Required – ${ticketNo}`;
  const body = `<p>Hello,</p>
    <p>The 24-hour window to pass the official standard form (QF-PDAS-DC-01) for urgent request <strong>${ticketNo}</strong> (Tracking No. <strong>${officialTracking}</strong>) has elapsed.</p>
    <p>Your tracking number remains permanently assigned to avoid any conflict, but please submit the form immediately as your immediate supervisor has also been notified.</p>`;
  await sendNotification({
    to: requesterEmail, subject,
    text: `OVERDUE: Submit standard form (QF-PDAS-DC-01) for ${ticketNo} (${officialTracking}). Immediate supervisor notified.`,
    html: renderHtml(subject, body, 'Submit Form Now', `${FRONTEND_URL}/faculty-staff-portal`),
  });
}

export async function emailUrgentOverdueSupervisor(supervisorEmail, { requesterName, ticketNo, officialTracking }) {
  const subject = `Supervisor Notice: Urgent Request Form Overdue – ${ticketNo}`;
  const body = `<p>Hello,</p>
    <p>Requester <strong>${requesterName}</strong> has not submitted the official standard form (QF-PDAS-DC-01) within the required 24-hour period for urgent request <strong>${ticketNo}</strong> (Tracking No. <strong>${officialTracking}</strong>).</p>
    <p>The tracking number remains allocated to this urgent request. Please follow up with the requester to complete the standard form filing.</p>`;
  await sendNotification({
    to: supervisorEmail, subject,
    text: `Requester ${requesterName} has not submitted standard form for urgent request ${ticketNo} (${officialTracking}) within 24 hours.`,
    html: renderHtml(subject, body, 'Open Supervisor Dashboard', `${FRONTEND_URL}/supervisor-dashboard`),
  });
}

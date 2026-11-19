
import "dotenv/config";
import nodemailer from "nodemailer";

const recipient = process.env.GMAIL_USER;
const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, '');

if (!recipient || !pass) {
    console.error("GMAIL_USER or GMAIL_APP_PASSWORD missing from backend/.env");
    process.exit(1);
}

try {
    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: recipient,
            pass: pass
        }
    });

    console.log("Verifying connection to Gmail SMTP...");
    await transporter.verify();
    console.log("✓ Gmail SMTP connection verified successfully!");

    console.log(`Sending real test message to ${recipient}...`);
    const info = await transporter.sendMail({
        from: `"FixIT – Security Authentication" <${recipient}>`,
        to: recipient,
        subject: "FixIT – Gmail SMTP Connection Verified",
        text: "Success! FixIT can send security authentication and password reset emails through your Gmail account.",
        html: "<div style='font-family:sans-serif;padding:20px;border-radius:8px;background:#f0fdf4;border:1px solid #86efac;color:#166534;'><h2>✓ FixIT Gmail Authentication Working</h2><p>Your Gmail App Password is valid and connected to FixIT PDAS.</p></div>"
    });

    console.log("✓ Email successfully sent! Message ID:", info.messageId);
} catch (error) {
    console.error("❌ Email test failed:", error.message);
    process.exitCode = 1;
}

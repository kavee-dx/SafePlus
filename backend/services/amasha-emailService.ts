import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

import { ROLE_LABELS, type UserRole } from "../models/registration";

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  const service = process.env.SMTP_SERVICE?.trim();
  const host = process.env.SMTP_HOST?.trim();

 
  if (!service && !host) return null;

  if (!transporter) {
    const auth = process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined;

    transporter = service
      ? // Well-known provider (e.g. "gmail") -> nodemailer resolves host/port.
        nodemailer.createTransport({ service, auth })
      : nodemailer.createTransport({
          host,
          port: Number(process.env.SMTP_PORT || 587),
          secure: String(process.env.SMTP_SECURE || "false") === "true",
          auth,
        });
  }

  return transporter;
}

export interface VerificationEmailInput {
  to: string;
  fullName: string;
  role: UserRole;
  approved: boolean;
  reason?: string | null;
  /**
   * Who made the decision. The Super Admin reviews most registrations, but a
   * rescue organization's own admin approves the teams registered under it.
   */
  reviewer?: string;
}

function buildEmail({
  fullName,
  role,
  approved,
  reason,
  reviewer = "Super Admin",
}: VerificationEmailInput): { subject: string; html: string } {
  const roleLabel = ROLE_LABELS[role] ?? role;

  if (approved) {
    return {
      subject: "Your SafePlus registration has been approved",
      html: `
        <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#101828">
          <h2 style="color:#12B76A">Registration Approved ✅</h2>
          <p>Hello ${fullName},</p>
          <p>
            Good news! Your <strong>${roleLabel}</strong> registration with
            SafePlus has been <strong>approved</strong> by the ${reviewer}.
          </p>
          <p>
            Your account is now active. You can sign in to the SafePlus portal
            and start using your dashboard.
          </p>
          <p style="color:#667085;font-size:13px">
            — SafePlus Disaster Management Centre
          </p>
        </div>`,
    };
  }

  return {
    subject: "Your SafePlus registration was not approved",
    html: `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#101828">
        <h2 style="color:#D92D20">Registration Rejected ❌</h2>
        <p>Hello ${fullName},</p>
        <p>
          Thank you for registering as a <strong>${roleLabel}</strong> with
          SafePlus. After review, your registration was
          <strong>not approved</strong>.
        </p>
        ${
          reason
            ? `<p style="background:#FEE4E2;border-radius:8px;padding:12px">
                 <strong>Reason:</strong> ${reason}
               </p>`
            : ""
        }
        <p>
          You may correct the highlighted details and submit your registration
          again for review.
        </p>
        <p style="color:#667085;font-size:13px">
          — SafePlus Disaster Management Centre
        </p>
      </div>`,
  };
}

export async function sendVerificationResultEmail(
  input: VerificationEmailInput
): Promise<void> {
  const { subject, html } = buildEmail(input);
  const from = process.env.EMAIL_FROM || "SafePlus DMC <no-reply@safeplus.lk>";
  const transport = getTransporter();

  if (!transport) {
    console.log(
      `[email:console] SMTP not configured. Would send to ${input.to}: "${subject}"`
    );
    return;
  }

  try {
    const info = await transport.sendMail({
      from,
      to: input.to,
      subject,
      html,
    });
    console.log(
      `[email:sent] ${approvedLabel(input.approved)} email sent to ${input.to} (messageId: ${info.messageId})`
    );
  } catch (error) {
    // Never fail the approval/rejection request because an email could not be sent.
    const reason = error instanceof Error ? error.message : String(error);
    console.error(
      `[email:error] Failed to send email to ${input.to}: ${reason}. ` +
        `Check SMTP_SERVICE / SMTP_USER / SMTP_PASS in backend/.env.`
    );
  }
}

function approvedLabel(approved: boolean): string {
  return approved ? "Approval" : "Rejection";
}

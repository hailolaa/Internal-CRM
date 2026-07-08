import { config } from "../config/index.js";
import { ApiError } from "../utils/ApiError.js";
import logger from "../utils/logger.js";

interface EmailAddress {
  email: string;
  name?: string;
}

interface SendEmailInput {
  to: EmailAddress[];
  subject: string;
  htmlContent: string;
  textContent?: string;
  tags?: string[];
}

interface BrevoSendResponse {
  messageId?: string;
}

function parseSender(value: string): Required<EmailAddress> {
  const match = value.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (match?.[2]) {
    return {
      name: match[1]?.trim() || "The Growth Group",
      email: match[2].trim(),
    };
  }

  return {
    name: "The Growth Group",
    email: value.trim(),
  };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildButtonHtml(label: string, href: string) {
  return `<a href="${escapeHtml(href)}" style="display:inline-block;background:#14b8a6;color:#04111a;text-decoration:none;font-weight:700;border-radius:8px;padding:12px 18px">${escapeHtml(label)}</a>`;
}

export class EmailService {
  async sendTransactionalEmail(input: SendEmailInput) {
    if (config.email.provider !== "brevo") {
      logger.info("[EMAIL LOG] Transactional email queued", {
        provider: config.email.provider,
        to: input.to.map((recipient) => recipient.email),
        subject: input.subject,
        tags: input.tags,
      });
      return { messageId: "log-provider" };
    }

    if (!config.email.brevoApiKey) {
      throw ApiError.internal("Brevo email is not configured");
    }

    const response = await fetch(config.email.brevoApiUrl, {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": config.email.brevoApiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: parseSender(config.email.from),
        to: input.to,
        subject: input.subject,
        htmlContent: input.htmlContent,
        textContent: input.textContent,
        tags: input.tags,
      }),
    });

    const body = await response.text();
    let payload: BrevoSendResponse | { message?: string } | undefined;

    try {
      payload = body ? JSON.parse(body) : undefined;
    } catch {
      payload = undefined;
    }

    if (!response.ok) {
      logger.error("Brevo transactional email failed", {
        status: response.status,
        response: payload || body,
      });
      throw ApiError.internal("Unable to send transactional email");
    }

    logger.info("Brevo transactional email sent", {
      messageId: (payload as BrevoSendResponse | undefined)?.messageId,
      to: input.to.map((recipient) => recipient.email),
      tags: input.tags,
    });

    return payload as BrevoSendResponse;
  }

  async sendTeamInviteEmail(input: {
    email: string;
    role: string;
    inviteUrl: string;
    clinicName: string;
    personalMessage?: string;
  }) {
    const safeClinicName = escapeHtml(input.clinicName);
    const safeRole = escapeHtml(input.role.replace("_", " ").toLowerCase());
    const personalMessage = input.personalMessage
      ? `<p style="margin:0 0 16px">${escapeHtml(input.personalMessage)}</p>`
      : "";

    return this.sendTransactionalEmail({
      to: [{ email: input.email }],
      subject: `You're invited to join ${input.clinicName}`,
      tags: ["team-invite"],
      textContent: [
        `You've been invited to join ${input.clinicName} as ${input.role}.`,
        input.personalMessage || "",
        `Accept your invitation: ${input.inviteUrl}`,
        "This invitation expires in 48 hours.",
      ].filter(Boolean).join("\n\n"),
      htmlContent: `
        <html>
          <body style="font-family:Arial,sans-serif;color:#111827;line-height:1.5">
            <h1 style="font-size:22px;margin:0 0 16px">You're invited to join ${safeClinicName}</h1>
            <p style="margin:0 0 16px">You've been invited as <strong>${safeRole}</strong>.</p>
            ${personalMessage}
            <p style="margin:0 0 24px">This invitation expires in 48 hours.</p>
            ${buildButtonHtml("Accept invitation", input.inviteUrl)}
          </body>
        </html>`,
    });
  }

  async sendPasswordResetEmail(input: {
    email: string;
    resetUrl: string;
    expiresMinutes: number;
  }) {
    return this.sendTransactionalEmail({
      to: [{ email: input.email }],
      subject: "Reset your The Growth Group Internal CRM password",
      tags: ["password-reset"],
      textContent: [
        "We received a request to reset your The Growth Group Internal CRM password.",
        `Reset your password: ${input.resetUrl}`,
        `This link expires in ${input.expiresMinutes} minutes.`,
        "If you did not request this, you can ignore this email.",
      ].join("\n\n"),
      htmlContent: `
        <html>
          <body style="font-family:Arial,sans-serif;color:#111827;line-height:1.5">
            <h1 style="font-size:22px;margin:0 0 16px">Reset your password</h1>
            <p style="margin:0 0 16px">We received a request to reset your The Growth Group Internal CRM password.</p>
            <p style="margin:0 0 24px">This link expires in ${input.expiresMinutes} minutes.</p>
            ${buildButtonHtml("Reset password", input.resetUrl)}
            <p style="margin:24px 0 0;color:#6b7280;font-size:13px">If you did not request this, you can ignore this email.</p>
          </body>
        </html>`,
    });
  }

  async sendEmailVerificationEmail(input: {
    email: string;
    verifyUrl: string;
    expiresHours: number;
  }) {
    return this.sendTransactionalEmail({
      to: [{ email: input.email }],
      subject: "Verify your The Growth Group Internal CRM email",
      tags: ["email-verification"],
      textContent: [
        "Welcome to The Growth Group Internal CRM.",
        `Verify your email: ${input.verifyUrl}`,
        `This link expires in ${input.expiresHours} hours.`,
        "If you did not create this account, you can ignore this email.",
      ].join("\n\n"),
      htmlContent: `
        <html>
          <body style="font-family:Arial,sans-serif;color:#111827;line-height:1.5">
            <h1 style="font-size:22px;margin:0 0 16px">Verify your email</h1>
            <p style="margin:0 0 16px">Welcome to The Growth Group Internal CRM. Please verify your email address to finish securing your account.</p>
            <p style="margin:0 0 24px">This link expires in ${input.expiresHours} hours.</p>
            ${buildButtonHtml("Verify email", input.verifyUrl)}
            <p style="margin:24px 0 0;color:#6b7280;font-size:13px">If you did not create this account, you can ignore this email.</p>
          </body>
        </html>`,
    });
  }
}

export const emailService = new EmailService();

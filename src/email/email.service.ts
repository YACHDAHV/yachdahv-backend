import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Resend } from "resend";

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] ?? character);
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend | null;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>("RESEND_API_KEY");
    this.resend = apiKey ? new Resend(apiKey) : null;
  }

  async sendVerificationCode(input: { email: string; name: string; code: string; codeId: string }) {
    return this.send({
      to: input.email,
      subject: `${input.code} is your Yachdahv verification code`,
      heading: "Verify your email",
      greeting: `Hi ${input.name},`,
      content: "Enter this code to verify your email address and continue setting up your Yachdahv profile.",
      code: input.code,
      footer: "This code expires in 10 minutes. If you did not create a Yachdahv account, you can ignore this email.",
      idempotencyKey: `email-verification/${input.codeId}`,
    });
  }

  async sendPasswordReset(input: { email: string; name: string; token: string; requestId: string }) {
    const frontendOrigin = this.config.getOrThrow<string>("FRONTEND_ORIGIN").split(",")[0].replace(/\/$/, "");
    const resetUrl = `${frontendOrigin}/reset-password?token=${encodeURIComponent(input.token)}`;
    return this.send({
      to: input.email,
      subject: "Reset your Yachdahv password",
      heading: "Reset your password",
      greeting: `Hi ${input.name},`,
      content: "We received a request to reset your password. Use the secure button below to choose a new one.",
      actionLabel: "Reset password",
      actionUrl: resetUrl,
      footer: "This link expires in 20 minutes. If you did not request a password reset, no action is needed.",
      idempotencyKey: `password-reset/${input.requestId}`,
    });
  }

  async sendWelcome(input: { email: string; name: string; userId: string }) {
    const frontendOrigin = this.config.getOrThrow<string>("FRONTEND_ORIGIN").split(",")[0].replace(/\/$/, "");
    return this.send({
      to: input.email,
      subject: "Welcome to Yachdahv",
      heading: "Your email is verified",
      greeting: `Welcome, ${input.name}!`,
      content: "You can now continue building your profile and meet people who share your faith, values, and intentions.",
      actionLabel: "Continue your profile",
      actionUrl: `${frontendOrigin}/onboarding/profile`,
      footer: "Faith first. Love with purpose.",
      idempotencyKey: `welcome/${input.userId}`,
    });
  }

  async sendIdentityDecision(input: { email: string; name: string; status: "verified" | "rejected"; note?: string | null; submissionId: string }) {
    const frontendOrigin = this.config.getOrThrow<string>("FRONTEND_ORIGIN").split(",")[0].replace(/\/$/, "");
    const verified = input.status === "verified";
    return this.send({
      to: input.email,
      subject: verified ? "Your Yachdahv identity is verified" : "An update on your Yachdahv verification",
      heading: verified ? "You are verified" : "Please update your verification",
      greeting: `Hi ${input.name},`,
      content: verified
        ? "Your identity review is complete. Your verified profile now has access to Yachdahv's curated matching experience."
        : `We could not approve your latest identity submission.${input.note ? ` Reviewer note: ${input.note}` : " Please review your documents and submit them again."}`,
      actionLabel: verified ? "Discover matches" : "Try verification again",
      actionUrl: verified ? `${frontendOrigin}/home/dashboard` : `${frontendOrigin}/identity-verification`,
      footer: "Keeping profiles verified helps us build a safer, faith-filled community.",
      idempotencyKey: `identity-${input.status}/${input.submissionId}`,
    });
  }

  private async send(input: {
    to: string;
    subject: string;
    heading: string;
    greeting: string;
    content: string;
    footer: string;
    idempotencyKey: string;
    code?: string;
    actionLabel?: string;
    actionUrl?: string;
  }) {
    const from = this.config.get<string>("RESEND_FROM_EMAIL");
    if (!this.resend || !from) throw new ServiceUnavailableException("Email delivery is not configured");

    const heading = escapeHtml(input.heading);
    const greeting = escapeHtml(input.greeting);
    const content = escapeHtml(input.content);
    const footer = escapeHtml(input.footer);
    const actionUrl = input.actionUrl ? escapeHtml(input.actionUrl) : undefined;
    const actionLabel = input.actionLabel ? escapeHtml(input.actionLabel) : undefined;
    const code = input.code ? escapeHtml(input.code) : undefined;
    const html = `<!doctype html><html><body style="margin:0;background:#f6f3ec;font-family:Arial,sans-serif;color:#18352d"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fff;border-radius:20px;overflow:hidden"><tr><td style="background:#18352d;padding:24px 32px;color:#fff;font-size:24px;font-weight:700">Yachdahv</td></tr><tr><td style="padding:36px 32px"><h1 style="margin:0 0 24px;font-size:28px;color:#18352d">${heading}</h1><p style="margin:0 0 14px;line-height:1.6">${greeting}</p><p style="margin:0 0 24px;line-height:1.6;color:#52635e">${content}</p>${code ? `<div style="margin:28px 0;padding:18px;border:1px solid #d8bd58;border-radius:14px;background:#fffaf0;text-align:center;font-size:32px;font-weight:700;letter-spacing:10px;color:#18352d">${code}</div>` : ""}${actionUrl && actionLabel ? `<p style="margin:28px 0"><a href="${actionUrl}" style="display:inline-block;padding:14px 22px;border-radius:10px;background:#18352d;color:#fff;text-decoration:none;font-weight:700">${actionLabel}</a></p>` : ""}<p style="margin:28px 0 0;font-size:13px;line-height:1.6;color:#75817d">${footer}</p></td></tr></table></td></tr></table></body></html>`;

    const { data, error } = await this.resend.emails.send({
      from,
      to: [input.to],
      subject: input.subject,
      html,
      text: `${input.heading}\n\n${input.greeting}\n\n${input.content}${input.code ? `\n\nCode: ${input.code}` : ""}${input.actionUrl ? `\n\n${input.actionLabel}: ${input.actionUrl}` : ""}\n\n${input.footer}`,
    }, { idempotencyKey: input.idempotencyKey });

    if (error) {
      this.logger.error(`Resend rejected email to ${input.to}: ${error.message}`);
      throw new ServiceUnavailableException("We could not send the email. Please try again.");
    }
    return data;
  }
}

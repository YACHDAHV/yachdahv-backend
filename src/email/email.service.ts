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
      eyebrow: "Email verification",
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
      eyebrow: "Account security",
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
      eyebrow: "Welcome to Yachdahv",
      heading: "Your email is verified",
      greeting: `Welcome, ${input.name}!`,
      content: "You can now continue building your profile and meet people who share your faith, values, and intentions.",
      actionLabel: "Continue your profile",
      actionUrl: `${frontendOrigin}/onboarding/profile`,
      footer: "Faith first. Love with purpose.",
      idempotencyKey: `welcome/${input.userId}`,
    });
  }

  async sendAdminInvitation(input: { email: string; name: string; role: string; token: string; invitationId: string }) {
    const frontendOrigin = this.config.getOrThrow<string>("FRONTEND_ORIGIN").split(",")[0].replace(/\/$/, "");
    const resetUrl = `${frontendOrigin}/reset-password?token=${encodeURIComponent(input.token)}&admin=1`;
    return this.send({
      to: input.email,
      subject: "You have been invited to administer Yachdahv",
      eyebrow: "Administrator access",
      heading: "Administrator invitation",
      greeting: `Hi ${input.name},`,
      content: `You have been invited to join the Yachdahv administration team as ${input.role}. Set your secure password to activate access.`,
      actionLabel: "Set administrator password",
      actionUrl: resetUrl,
      footer: "This invitation expires in 24 hours. If you were not expecting it, contact the Yachdahv team.",
      idempotencyKey: `admin-invitation/${input.invitationId}`,
    });
  }

  async sendAdminAlert(input: { email: string; name: string; subject: string; heading: string; content: string; targetUrl: string; eventId: string }) {
    const frontendOrigin = this.config.getOrThrow<string>("FRONTEND_ORIGIN").split(",")[0].replace(/\/$/, "");
    return this.send({
      to: input.email,
      subject: input.subject,
      eyebrow: "Team update",
      heading: input.heading,
      greeting: `Hi ${input.name},`,
      content: input.content,
      actionLabel: "Open admin dashboard",
      actionUrl: `${frontendOrigin}${input.targetUrl}`,
      footer: "You can control these administrator alerts from your Yachdahv settings.",
      idempotencyKey: `admin-alert/${input.eventId}`,
    });
  }

  async sendWaitlistInvitation(input: { email: string; code: string; churchName?: string; expiresAt: Date; invitationId: string }) {
    const frontendOrigin = this.config.getOrThrow<string>("FRONTEND_ORIGIN").split(",")[0].replace(/\/$/, "");
    return this.send({
      to: input.email,
      subject: "Your Yachdahv invitation code",
      eyebrow: "You are invited",
      heading: "Your invitation is ready",
      greeting: "Welcome to Yachdahv,",
      content: `Use this single-use code to complete onboarding${input.churchName ? ` through ${input.churchName}` : ""}. The code is linked to this email address and cannot be transferred.`,
      code: input.code,
      footer: `This invitation expires on ${input.expiresAt.toLocaleDateString("en-NG", { dateStyle: "long" })}. If you did not join the Yachdahv waitlist, ignore this email.`,
      idempotencyKey: `waitlist-invitation/${input.invitationId}`,
    });
  }

  async sendIdentityDecision(input: { email: string; name: string; status: "verified" | "rejected"; note?: string | null; submissionId: string }) {
    const frontendOrigin = this.config.getOrThrow<string>("FRONTEND_ORIGIN").split(",")[0].replace(/\/$/, "");
    const verified = input.status === "verified";
    return this.send({
      to: input.email,
      subject: verified ? "Your Yachdahv identity is verified" : "An update on your Yachdahv verification",
      eyebrow: "Trust and safety",
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
    eyebrow: string;
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

    const html = this.buildHtml({
      eyebrow: escapeHtml(input.eyebrow),
      heading: escapeHtml(input.heading),
      greeting: escapeHtml(input.greeting),
      content: escapeHtml(input.content),
      footer: escapeHtml(input.footer),
      code: input.code ? escapeHtml(input.code) : undefined,
      actionUrl: input.actionUrl ? escapeHtml(input.actionUrl) : undefined,
      actionLabel: input.actionLabel ? escapeHtml(input.actionLabel) : undefined,
    });

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

  private buildHtml(input: {
    eyebrow: string;
    heading: string;
    greeting: string;
    content: string;
    footer: string;
    code?: string;
    actionUrl?: string;
    actionLabel?: string;
  }) {
    const year = new Date().getFullYear();
    const preheader = `${input.heading} ${input.content}`.slice(0, 120);
    const codeBlock = input.code ? `<tr style="margin:0;padding:0"><td style="margin:0;padding:0 0 34px"><table width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="background-color:#F5F1E6;border:1px solid #D4A72C;border-radius:14px"><tbody><tr><td align="center" style="padding:22px 16px;font-family:'Work Sans',Arial,sans-serif;font-size:20px;font-weight:700;letter-spacing:5px;color:#0B1F3A">${input.code}</td></tr></tbody></table></td></tr>` : "";
    const cta = input.actionUrl && input.actionLabel ? `<table border="0" cellPadding="0" cellSpacing="0" role="presentation" style="margin:0 0 38px"><tbody><tr><td style="border-radius:10px;background-color:#D4A72C"><a href="${input.actionUrl}" style="display:inline-block;padding:15px 28px;font-family:'Work Sans',Arial,sans-serif;font-size:14px;font-weight:700;color:#0B1F3A;text-decoration:none">${input.actionLabel}</a></td></tr></tbody></table>` : "";
    return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd"><html dir="ltr" lang="en"><head><meta content="width=device-width" name="viewport"/><meta content="text/html; charset=UTF-8" http-equiv="Content-Type"/><meta name="x-apple-disable-message-reformatting"/><meta content="IE=edge" http-equiv="X-UA-Compatible"/><meta content="telephone=no,address=no,email=no,date=no,url=no" name="format-detection"/><title>${input.heading}</title><style>@media (prefers-color-scheme: dark){li::marker{color:#c4c4c4}}</style><style>*{margin:0;padding:0;box-sizing:border-box}body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}table,td{mso-table-lspace:0pt;mso-table-rspace:0pt}img{-ms-interpolation-mode:bicubic;border:0;outline:none;text-decoration:none}body{margin:0!important;padding:0!important;background-color:#0B1F3A}@media only screen and (max-width:600px){.email-wrapper{width:100%!important}.main-panel{padding:44px 30px 40px!important}.top-strip{padding:24px 30px!important}.foot-strip{padding:22px 30px!important}.hero-title{font-size:21px!important}}</style></head><body dir="ltr" lang="en"><div style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0">${preheader}&#8202;&#8203;&#8204;</div><table border="0" width="100%" cellPadding="0" cellSpacing="0" role="presentation" align="center" style="background-color:#0B1F3A"><tbody><tr><td align="center" style="padding:32px 12px"><table width="600" border="0" cellPadding="0" cellSpacing="0" role="presentation" class="email-wrapper" style="max-width:600px;width:100%"><tbody><tr><td class="top-strip" align="center" style="padding:30px 48px;background-color:#F5F1E6;text-align:center"><h3 style="text-align:center;margin:0;padding:0;font-family:'Work Sans',Arial,sans-serif;font-size:20px;font-weight:700;letter-spacing:0.02em;color:#0B1F3A">Yachdahv</h3></td></tr><tr><td class="main-panel" style="padding:56px 48px 48px;background-color:#0B1F3A"><p style="font-family:'Work Sans',Arial,sans-serif;font-size:11px;font-weight:600;color:#D4A72C;letter-spacing:0.18em;text-transform:uppercase;margin-bottom:18px;text-align:left">${input.eyebrow}</p><h1 class="hero-title" style="margin:0 0 24px;font-family:'Playfair Display',Georgia,serif;font-size:24px;font-weight:700;color:#FFFFFF;line-height:1.3;text-align:left">${input.heading}</h1><p style="margin:0 0 22px;font-family:'Work Sans',Arial,sans-serif;font-size:15px;color:rgba(255,255,255,0.7);line-height:1.8;text-align:left">${input.greeting}</p><p style="margin:0 0 26px;font-family:'Work Sans',Arial,sans-serif;font-size:15px;color:rgba(255,255,255,0.7);line-height:1.8;text-align:left">${input.content}</p>${codeBlock}${cta}<p style="margin:0 0 2px;font-family:'Work Sans',Arial,sans-serif;font-size:14px;color:rgba(255,255,255,0.5);line-height:1.7;text-align:left">Welcome,</p><p style="margin:0;font-family:'Playfair Display',Georgia,serif;font-size:13px;font-weight:700;color:#FFFFFF;text-align:left">The YACHDAHV Team</p></td></tr><tr><td class="foot-strip" align="center" style="padding:26px 48px;background-color:#F5F1E6;text-align:center"><p style="margin:0;font-family:'Work Sans',Arial,sans-serif;font-size:11px;color:#7A7365;line-height:1.7;letter-spacing:0.02em">Lagos, Nigeria &middot; &copy; ${year} YACHDAHV<br/>${input.footer}</p></td></tr></tbody></table></td></tr></tbody></table></body></html>`;
  }
}

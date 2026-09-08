import { BadRequestException, ConflictException, Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { createHash } from "crypto";
import { Repository } from "typeorm";
import { User, VerificationStatus, VerificationSubmission } from "../database/entities";
import { SubmitVerificationDto } from "./dto/verification.dto";
import { AdminEmailAlertsService } from "../email/admin-email-alerts.service";
import { EmailService } from "../email/email.service";
import { PremblyCheckResult, PremblyClient, sanitizePremblyPayload } from "./prembly.client";
import { StorageService } from "../storage/storage.service";

@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);

  constructor(
    @InjectRepository(VerificationSubmission) private readonly submissions: Repository<VerificationSubmission>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly adminAlerts: AdminEmailAlertsService,
    private readonly email: EmailService,
    private readonly prembly: PremblyClient,
    private readonly storage: StorageService,
  ) {}

  async status(userId: string) {
    const submission = await this.submissions.findOne({ where: { userId }, order: { createdAt: "DESC" } });
    const user = await this.users.findOneBy({ id: userId });
    return {
      status: submission?.status ?? user?.identityStatus ?? VerificationStatus.NOT_STARTED,
      documentType: submission?.documentType ?? null,
      documentCountry: submission?.documentCountry ?? null,
      documentNumberLast4: submission?.documentNumberLast4 ?? null,
      livenessPassed: submission?.livenessPassed ?? null,
      faceMatchPassed: submission?.faceMatchPassed ?? null,
      reviewNote: submission?.reviewNote ?? null,
      provider: submission?.provider ?? null,
      providerReady: this.prembly.isConfigured(),
      createdAt: submission?.createdAt ?? null,
    };
  }

  async submit(userId: string, payload: SubmitVerificationDto) {
    const user = await this.users.findOneBy({ id: userId });
    if (!user) throw new BadRequestException("Your account was not found");
    if (user.identityStatus === VerificationStatus.VERIFIED) {
      throw new ConflictException("Your identity is already verified");
    }
    const pending = await this.submissions.exists({ where: { userId, status: VerificationStatus.SUBMITTED } });
    if (pending) throw new ConflictException("A verification submission is already being reviewed");

    const documentType = payload.documentType;
    const isNin = documentType === "nin";
    if (isNin && !payload.nin) throw new BadRequestException("Enter your 11-digit NIN");
    if (!isNin && (!payload.documentKey || !payload.documentCountry)) {
      throw new BadRequestException("Upload a government ID and select the issuing country");
    }
    this.storage.assertOwnedPrivateKey(userId, payload.selfieKey);
    if (payload.documentKey) this.storage.assertOwnedPrivateKey(userId, payload.documentKey);

    const documentNumber = isNin ? payload.nin! : null;
    const documentNumberHash = documentNumber ? hashIdentifier(documentNumber) : null;
    if (documentNumberHash) {
      const reused = await this.submissions.exists({
        where: { documentNumberHash, status: VerificationStatus.VERIFIED },
      });
      if (reused) throw new ConflictException("This identity has already been verified on another account");
    }

    const submission = await this.submissions.save(this.submissions.create({
      userId,
      documentType,
      documentKey: payload.documentKey ?? null,
      documentCountry: isNin ? "NG" : payload.documentCountry?.toUpperCase() ?? null,
      documentNumberLast4: documentNumber ? documentNumber.slice(-4) : null,
      documentNumberHash,
      selfieKey: payload.selfieKey,
      status: VerificationStatus.SUBMITTED,
      provider: this.prembly.isConfigured() ? "prembly" : "manual",
      providerPayload: {},
    }));

    if (!this.prembly.isConfigured()) {
      await this.users.update(userId, { identityStatus: VerificationStatus.SUBMITTED });
      await this.notifyAdmins(submission.id);
      return this.publicSubmission(submission);
    }

    try {
      const result = isNin
        ? await this.verifyNigerian(userId, payload.nin!, payload.selfieKey)
        : await this.verifyDocument(userId, payload);
      return this.finalize(user, submission, result);
    } catch (error) {
      this.logger.error(`Prembly verification failed for user ${userId}`, error instanceof Error ? error.stack : undefined);
      submission.reviewNote = "Automatic verification is temporarily unavailable. An administrator will review this submission.";
      await this.submissions.save(submission);
      await this.users.update(userId, { identityStatus: VerificationStatus.SUBMITTED });
      await this.notifyAdmins(submission.id);
      return this.publicSubmission(submission);
    }
  }

  async handlePremblyWebhook(payload: Record<string, unknown>, submissionId?: string) {
    if (!submissionId) return { received: true };
    const submission = await this.submissions.findOneBy({ id: submissionId });
    if (!submission || submission.status !== VerificationStatus.SUBMITTED) return { received: true };
    const verification = asRecord(payload.verification);
    const verified = payload.status === true || String(verification.status ?? "").toUpperCase() === "VERIFIED";
    submission.provider = "prembly";
    submission.providerReference = String(verification.reference ?? payload.reference_id ?? submission.providerReference ?? "");
    submission.providerPayload = { ...submission.providerPayload, webhook: sanitizePremblyPayload(payload) };
    submission.status = verified ? VerificationStatus.VERIFIED : VerificationStatus.REJECTED;
    submission.reviewNote = verified ? "Verified by Prembly" : String(payload.detail ?? payload.message ?? "Verification was not successful");
    await this.submissions.save(submission);
    await this.users.update(submission.userId, { identityStatus: submission.status });
    return { received: true };
  }

  private async verifyNigerian(userId: string, nin: string, selfieKey: string) {
    const selfie = await this.storage.getPrivateObjectBase64(userId, selfieKey);
    const liveness = await this.prembly.livelinessCheck(selfie);
    if (!liveness.ok) {
      return this.failedResult(liveness, "We could not confirm that this selfie is a live photo. Please smile at the camera and try again.", {
        livenessPassed: false,
        faceMatchPassed: false,
      });
    }
    const ninCheck = await this.prembly.ninWithFace(nin, selfie);
    if (!ninCheck.ok) {
      return this.failedResult(ninCheck, "We could not match this selfie to the NIN you entered. Check the number and try again.", {
        livenessPassed: true,
        faceMatchPassed: false,
      });
    }
    return {
      status: VerificationStatus.VERIFIED,
      livenessPassed: true,
      faceMatchPassed: true,
      reference: ninCheck.reference ?? liveness.reference,
      note: "Verified with NIN and liveness check",
      payload: { liveness: liveness.payload, identity: ninCheck.payload },
    };
  }

  private async verifyDocument(userId: string, payload: SubmitVerificationDto) {
    const selfie = await this.storage.getPrivateObjectBase64(userId, payload.selfieKey);
    const document = await this.storage.getPrivateObjectBase64(userId, payload.documentKey!);
    const liveness = await this.prembly.livelinessCheck(selfie);
    if (!liveness.ok) {
      return this.failedResult(liveness, "We could not confirm that this selfie is a live photo. Please smile at the camera and try again.", {
        livenessPassed: false,
        faceMatchPassed: false,
      });
    }
    const documentCheck = await this.prembly.documentWithFace({
      documentType: payload.documentType,
      country: payload.documentCountry!.toUpperCase(),
      documentBase64: document,
      selfieBase64: selfie,
    });
    if (!documentCheck.ok) {
      return this.failedResult(documentCheck, "We could not verify this document against your selfie. Use a clear photo of a valid government ID.", {
        livenessPassed: true,
        faceMatchPassed: false,
      });
    }
    return {
      status: VerificationStatus.VERIFIED,
      livenessPassed: true,
      faceMatchPassed: true,
      reference: documentCheck.reference ?? liveness.reference,
      note: "Verified with government ID and liveness check",
      payload: { liveness: liveness.payload, identity: documentCheck.payload },
    };
  }

  private async finalize(
    user: User,
    submission: VerificationSubmission,
    result: {
      status: VerificationStatus;
      livenessPassed: boolean;
      faceMatchPassed: boolean;
      reference: string | null;
      note: string;
      payload: Record<string, unknown>;
    },
  ) {
    submission.status = result.status;
    submission.livenessPassed = result.livenessPassed;
    submission.faceMatchPassed = result.faceMatchPassed;
    submission.provider = "prembly";
    submission.providerReference = result.reference;
    submission.providerPayload = result.payload;
    submission.reviewNote = result.note;
    await this.submissions.save(submission);
    await this.users.update(user.id, { identityStatus: result.status });
    if (result.status === VerificationStatus.VERIFIED || result.status === VerificationStatus.REJECTED) {
      await this.sendDecisionEmail(user, submission);
    }
    if (result.status === VerificationStatus.SUBMITTED) await this.notifyAdmins(submission.id);
    return this.publicSubmission(submission);
  }

  private failedResult(
    check: PremblyCheckResult,
    fallback: string,
    flags: { livenessPassed: boolean; faceMatchPassed: boolean },
  ) {
    return {
      status: VerificationStatus.REJECTED,
      livenessPassed: flags.livenessPassed,
      faceMatchPassed: flags.faceMatchPassed,
      reference: check.reference,
      note: check.message || fallback,
      payload: check.payload,
    };
  }

  private publicSubmission(submission: VerificationSubmission) {
    return {
      id: submission.id,
      status: submission.status,
      documentType: submission.documentType,
      documentCountry: submission.documentCountry,
      documentNumberLast4: submission.documentNumberLast4,
      livenessPassed: submission.livenessPassed,
      faceMatchPassed: submission.faceMatchPassed,
      reviewNote: submission.reviewNote,
      provider: submission.provider,
      createdAt: submission.createdAt,
    };
  }

  private async notifyAdmins(submissionId: string) {
    await this.adminAlerts.notify("verification", {
      subject: "A verification submission needs review",
      heading: "Verification queue update",
      content: "A member submitted identity documents for administrator review.",
      targetUrl: "/admin/verification",
      eventId: `verification/${submissionId}`,
    });
  }

  private async sendDecisionEmail(user: User, submission: VerificationSubmission) {
    if (!user.email || (submission.status !== VerificationStatus.VERIFIED && submission.status !== VerificationStatus.REJECTED)) return;
    try {
      await this.email.sendIdentityDecision({
        email: user.email,
        name: user.name,
        status: submission.status,
        note: submission.reviewNote,
        submissionId: submission.id,
      });
    } catch (error) {
      this.logger.error(`Verification email failed for user ${user.id}`, error instanceof Error ? error.stack : undefined);
    }
  }
}

function hashIdentifier(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

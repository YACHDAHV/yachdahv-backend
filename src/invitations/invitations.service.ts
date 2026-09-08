import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { createHmac, randomInt } from "node:crypto";
import { EntityManager, Repository } from "typeorm";
import { Church, User, UserRole, WaitlistInvite, WaitlistInviteStatus } from "../database/entities";
import { EmailService } from "../email/email.service";
import { BatchWaitlistInviteDto, CreateChurchDto, CreateWaitlistInviteDto, normalizeInviteCode, UpdateChurchDto, ValidateWaitlistInviteDto } from "./dto/invitation.dto";

const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

@Injectable()
export class InvitationsService {
  constructor(
    @InjectRepository(Church) private readonly churches: Repository<Church>,
    @InjectRepository(WaitlistInvite) private readonly invites: Repository<WaitlistInvite>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly config: ConfigService,
    private readonly email: EmailService,
  ) {}

  listChurches(includeInactive = false) {
    return this.churches.find({ where: includeInactive ? {} : { active: true }, order: { name: "ASC" } });
  }

  async createChurch(actorId: string, payload: CreateChurchDto) {
    await this.assertAdmin(actorId);
    const name = payload.name.trim();
    const existing = await this.churches.createQueryBuilder("church").where("LOWER(church.name) = LOWER(:name)", { name }).getOne();
    if (existing) throw new ConflictException("This church already exists");
    return this.churches.save(this.churches.create({ name, active: true }));
  }

  async updateChurch(actorId: string, id: string, payload: UpdateChurchDto) {
    await this.assertAdmin(actorId);
    const church = await this.churches.findOneBy({ id });
    if (!church) throw new NotFoundException("Church was not found");
    if (payload.name) church.name = payload.name.trim();
    if (payload.active !== undefined) church.active = payload.active;
    return this.churches.save(church);
  }

  async listInvites(actorId: string, search?: string, status?: string) {
    await this.assertAdmin(actorId);
    const query = this.invites.createQueryBuilder("invite").leftJoinAndSelect("invite.church", "church").orderBy("invite.createdAt", "DESC").take(500);
    if (search) query.andWhere("LOWER(invite.email) LIKE LOWER(:search)", { search: `%${search.trim()}%` });
    if (status === "expired") query.andWhere("invite.status = :pending AND invite.expiresAt <= :now", { pending: WaitlistInviteStatus.PENDING, now: new Date() });
    else if (Object.values(WaitlistInviteStatus).includes(status as WaitlistInviteStatus)) query.andWhere("invite.status = :status", { status });
    return (await query.getMany()).map((invite) => this.view(invite));
  }

  async createInvite(actorId: string, payload: CreateWaitlistInviteDto) {
    await this.assertAdmin(actorId);
    const { invite } = await this.issue(actorId, payload.email, payload.churchId, payload.expiresInDays);
    return invite;
  }

  async batchCreate(actorId: string, payload: BatchWaitlistInviteDto) {
    await this.assertAdmin(actorId);
    if (!payload.entries.length || payload.entries.length > 500) throw new BadRequestException("Upload between 1 and 500 waitlist entries at a time");
    const entries = [...new Map(payload.entries.map((entry) => {
      const email = entry.email.trim().toLowerCase();
      return [email, { ...entry, email }] as const;
    })).values()];
    const results: Array<{ email: string; ok: boolean; invite?: ReturnType<InvitationsService["view"]>; error?: string }> = [];
    for (const entry of entries) {
      try {
        const { invite } = await this.issue(actorId, entry.email, entry.churchId, payload.expiresInDays);
        results.push({ email: entry.email, ok: true, invite });
      } catch (error) {
        results.push({ email: entry.email, ok: false, error: error instanceof Error ? error.message : "Invitation failed" });
      }
    }
    return { total: results.length, sent: results.filter((item) => item.ok).length, failed: results.filter((item) => !item.ok).length, results };
  }

  async replaceAndResend(actorId: string, id: string) {
    await this.assertAdmin(actorId);
    const invite = await this.invites.findOneBy({ id });
    if (!invite) throw new NotFoundException("Invitation was not found");
    if (invite.status === WaitlistInviteStatus.REDEEMED) throw new ConflictException("A redeemed invitation cannot be replaced");
    const { invite: replacement } = await this.issue(actorId, invite.email, invite.churchId ?? undefined, Math.max(1, Math.ceil((invite.expiresAt.getTime() - Date.now()) / 86_400_000)));
    return replacement;
  }

  async revoke(actorId: string, id: string) {
    await this.assertAdmin(actorId);
    const invite = await this.invites.findOneBy({ id });
    if (!invite) throw new NotFoundException("Invitation was not found");
    if (invite.status === WaitlistInviteStatus.REDEEMED) throw new ConflictException("A redeemed invitation cannot be revoked");
    invite.status = WaitlistInviteStatus.REVOKED;
    await this.invites.save(invite);
    return { success: true };
  }

  async requestForUser(userId: string, churchId?: string) {
    const user = await this.users.findOneBy({ id: userId });
    if (!user?.email || !user.emailVerified) throw new BadRequestException("Your account must have a verified email address");
    if (user.onboardingCompleted) throw new ConflictException("Your profile is already set up");
    const recent = await this.invites.findOne({
      where: { email: user.email.trim().toLowerCase() },
      order: { createdAt: "DESC" },
    });
    if (recent?.sentAt && Date.now() - recent.sentAt.getTime() < 60_000) {
      throw new BadRequestException("Please wait a minute before requesting another invitation code");
    }
    const { invite, code } = await this.issue(userId, user.email, churchId, 14);
    return {
      sent: true,
      email: maskEmail(user.email),
      expiresAt: invite.expiresAt,
      ...(this.exposeDevelopmentCodes() ? { developmentCode: code } : {}),
    };
  }

  async validateForUser(userId: string, payload: ValidateWaitlistInviteDto) {
    const user = await this.users.findOneBy({ id: userId });
    if (!user?.email || !user.emailVerified) throw new BadRequestException("Your account must have a verified email address");
    const invite = await this.findValid(user.email, payload.churchId, payload.code, this.invites.manager);
    return { valid: true, inviteId: invite.id, church: invite.church, expiresAt: invite.expiresAt };
  }

  async consumeForUser(user: User, churchId: string, code: string, manager: EntityManager) {
    if (!user.email || !user.emailVerified) throw new BadRequestException("Your account must have a verified email address");
    const invite = await this.findValid(user.email, churchId, code, manager, true);
    invite.status = WaitlistInviteStatus.REDEEMED;
    invite.redeemedById = user.id;
    invite.redeemedAt = new Date();
    await manager.save(WaitlistInvite, invite);
    return invite;
  }

  private async issue(actorId: string, rawEmail: string, churchId: string | undefined, expiresInDays = 14) {
    const email = rawEmail.trim().toLowerCase();
    const existingUser = await this.users.findOneBy({ email });
    if (existingUser?.onboardingCompleted) throw new ConflictException("This member has already completed onboarding");
    let church: Church | null = null;
    if (churchId) {
      church = await this.churches.findOneBy({ id: churchId, active: true });
      if (!church) throw new BadRequestException("Select an active church");
    }
    const code = this.generateCode();
    const invite = await this.invites.save(this.invites.create({
      email,
      churchId: church?.id ?? null,
      codeHash: this.hashCode(code),
      codeHint: `YDV-••••-••••-${code.slice(-4)}`,
      status: WaitlistInviteStatus.PENDING,
      expiresAt: new Date(Date.now() + expiresInDays * 86_400_000),
      sentAt: null,
      redeemedById: null,
      redeemedAt: null,
      createdById: actorId,
    }));
    try {
      await this.email.sendWaitlistInvitation({ email, code, churchName: church?.name, expiresAt: invite.expiresAt, invitationId: invite.id });
    } catch (error) {
      await this.invites.delete(invite.id);
      throw error;
    }
    invite.sentAt = new Date();
    await this.invites.save(invite);
    await this.invites.createQueryBuilder().update(WaitlistInvite).set({ status: WaitlistInviteStatus.REVOKED })
      .where("LOWER(email) = LOWER(:email)", { email })
      .andWhere("status = :status", { status: WaitlistInviteStatus.PENDING })
      .andWhere("id != :id", { id: invite.id })
      .execute();
    invite.church = church ?? undefined;
    return { invite: this.view(invite), code };
  }

  private async findValid(email: string, churchId: string, code: string, manager: EntityManager, lock = false) {
    const query = manager.getRepository(WaitlistInvite).createQueryBuilder("invite")
      .where("invite.codeHash = :codeHash", { codeHash: this.hashCode(code) })
      .andWhere("LOWER(invite.email) = LOWER(:email)", { email: email.trim() })
      .andWhere("invite.status = :status", { status: WaitlistInviteStatus.PENDING });
    if (lock) {
      query.setLock("pessimistic_write");
    } else {
      query.leftJoinAndSelect("invite.church", "church");
    }
    const invite = await query.getOne();
    if (!invite || invite.expiresAt <= new Date()) throw new BadRequestException("This invitation code is invalid or has expired");
    if (invite.churchId && invite.churchId !== churchId) throw new BadRequestException("This invitation code does not match the selected church");
    const church = await manager.getRepository(Church).findOneBy({ id: churchId, active: true });
    if (!church) throw new BadRequestException("Select an active church");
    invite.church = church;
    return invite;
  }

  private generateCode() {
    const part = () => Array.from({ length: 4 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
    return `YDV-${part()}-${part()}-${part()}`;
  }

  private hashCode(code: string) {
    const secret = this.config.get<string>("INVITE_CODE_SECRET") || this.config.getOrThrow<string>("JWT_RESET_SECRET");
    const normalized = String(normalizeInviteCode(code) ?? "").replace(/[^A-Z0-9]/g, "");
    return createHmac("sha256", secret).update(normalized).digest("hex");
  }

  private exposeDevelopmentCodes() {
    return this.config.get("NODE_ENV") !== "production" && this.config.get("EXPOSE_DEVELOPMENT_CODES") === "true";
  }

  private async assertAdmin(actorId: string) {
    const actor = await this.users.findOneBy({ id: actorId });
    if (!actor || ![UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(actor.role) || (actor.role !== UserRole.SUPER_ADMIN && !actor.permissions.includes("manage_users"))) {
      throw new ForbiddenException("You do not have permission to manage waitlist invitations");
    }
  }

  private view(invite: WaitlistInvite) {
    return {
      id: invite.id,
      email: invite.email,
      churchId: invite.churchId,
      church: invite.church,
      codeHint: invite.codeHint,
      status: invite.status === WaitlistInviteStatus.PENDING && invite.expiresAt <= new Date() ? "expired" : invite.status,
      expiresAt: invite.expiresAt,
      sentAt: invite.sentAt,
      redeemedById: invite.redeemedById,
      redeemedAt: invite.redeemedAt,
      createdAt: invite.createdAt,
    };
  }
}

function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const visible = local.slice(0, 1);
  return `${visible}***@${domain}`;
}

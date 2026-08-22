import { ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import { hash } from "bcryptjs";
import { randomUUID } from "node:crypto";
import { In, Not, Repository } from "typeorm";
import { AuditLog, Match, Report, ReportStatus, User, UserRole, UserStatus, VerificationStatus, VerificationSubmission } from "../database/entities";
import { EmailService } from "../email/email.service";
import { PlatformService } from "../platform/platform.service";
import { ADMIN_PERMISSIONS, ADMIN_ROLES, AdminPermission, AdminRoleName, DEFAULT_ROLE_PERMISSIONS } from "./admin.permissions";
import { AdminListQueryDto, InviteAdminDto, ReviewReportDto, ReviewVerificationDto, UpdateAdminPreferencesDto, UpdateRolePermissionsDto, UpdateSystemControlsDto, UpdateUserStatusDto } from "./dto/admin.dto";

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Match) private readonly matches: Repository<Match>,
    @InjectRepository(Report) private readonly reports: Repository<Report>,
    @InjectRepository(VerificationSubmission) private readonly verifications: Repository<VerificationSubmission>,
    @InjectRepository(AuditLog) private readonly auditLogs: Repository<AuditLog>,
    private readonly email: EmailService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly platform: PlatformService,
  ) {}

  async dashboard(actorId: string) {
    await this.assertPermission(actorId, "view_users");
    const [users, activeUsers, verifiedUsers, matches, openReports, pendingVerifications] = await Promise.all([
      this.users.count(),
      this.users.countBy({ status: UserStatus.ACTIVE }),
      this.users.countBy({ identityStatus: VerificationStatus.VERIFIED }),
      this.matches.count(),
      this.reports.countBy({ status: ReportStatus.OPEN }),
      this.verifications.countBy({ status: VerificationStatus.SUBMITTED }),
    ]);
    return { users, activeUsers, verifiedUsers, matches, openReports, pendingVerifications };
  }

  async listUsers(actorId: string, query: AdminListQueryDto) {
    await this.assertPermission(actorId, "view_users");
    const builder = this.users.createQueryBuilder("user")
      .leftJoinAndSelect("user.profile", "profile")
      .orderBy("user.createdAt", "DESC")
      .skip((query.page - 1) * query.limit)
      .take(query.limit);
    if (query.search) builder.andWhere("(LOWER(user.name) LIKE LOWER(:search) OR LOWER(user.email) LIKE LOWER(:search) OR user.phone LIKE :search)", { search: `%${query.search}%` });
    if (query.status) builder.andWhere("user.status = :status", { status: query.status });
    if (query.verification) builder.andWhere("user.identityStatus = :verification", { verification: query.verification });
    const [items, total] = await builder.getManyAndCount();
    return { items, total, page: query.page, limit: query.limit };
  }

  async user(id: string, actorId?: string) {
    if (actorId) await this.assertPermission(actorId, "view_users");
    const user = await this.users.findOne({ where: { id }, relations: { profile: true, preference: true } });
    if (!user) throw new NotFoundException("User was not found");
    return user;
  }

  async updateUserStatus(actorId: string, id: string, payload: UpdateUserStatusDto) {
    await this.assertPermission(actorId, "manage_users");
    const user = await this.user(id);
    user.status = payload.status;
    await this.users.save(user);
    await this.audit(actorId, "user.status.updated", "user", id, { status: payload.status });
    return user;
  }

  async listMatches(actorId: string) {
    await this.assertPermission(actorId, "view_users");
    return this.matches.find({
      relations: { userA: { profile: true }, userB: { profile: true } },
      order: { updatedAt: "DESC" },
      take: 200,
    });
  }

  async listActivity(actorId: string) {
    await this.assertPermission(actorId, "view_users");
    return this.auditLogs.find({ order: { createdAt: "DESC" }, take: 200 });
  }

  async listVerifications(actorId: string) {
    await this.assertPermission(actorId, "review_verification");
    return this.verifications.find({ where: { status: VerificationStatus.SUBMITTED }, relations: { user: { profile: true } }, order: { createdAt: "ASC" } });
  }

  async reviewVerification(actorId: string, id: string, payload: ReviewVerificationDto) {
    await this.assertPermission(actorId, "review_verification");
    const submission = await this.verifications.findOneBy({ id });
    if (!submission) throw new NotFoundException("Verification submission was not found");
    submission.status = payload.status;
    submission.reviewNote = payload.note ?? null;
    await this.verifications.save(submission);
    await this.users.update(submission.userId, { identityStatus: payload.status });
    await this.audit(actorId, "verification.reviewed", "verification", id, { status: payload.status });
    if (payload.status === VerificationStatus.VERIFIED || payload.status === VerificationStatus.REJECTED) {
      const user = await this.users.findOneBy({ id: submission.userId });
      if (user?.email) {
        try {
          await this.email.sendIdentityDecision({
            email: user.email,
            name: user.name,
            status: payload.status,
            note: submission.reviewNote,
            submissionId: submission.id,
          });
        } catch (error) {
          this.logger.error(`Verification email failed for user ${user.id}`, error instanceof Error ? error.stack : undefined);
        }
      }
    }
    return submission;
  }

  async listReports(actorId: string) {
    await this.assertPermission(actorId, "resolve_reports");
    return this.reports.find({ relations: { reporter: true, reported: true }, order: { createdAt: "DESC" }, take: 200 });
  }

  async reviewReport(actorId: string, id: string, payload: ReviewReportDto) {
    await this.assertPermission(actorId, "resolve_reports");
    const report = await this.reports.findOneBy({ id });
    if (!report) throw new NotFoundException("Report was not found");
    report.status = payload.status;
    await this.reports.save(report);
    await this.audit(actorId, "report.reviewed", "report", id, { status: payload.status });
    return report;
  }

  async listAdmins(actorId: string) {
    await this.assertPermission(actorId, "manage_admins");
    return this.users.find({
      where: { role: Not(UserRole.MEMBER) },
      order: { createdAt: "ASC" },
      select: { id: true, name: true, email: true, role: true, adminRole: true, permissions: true, status: true, emailVerified: true, createdAt: true },
    });
  }

  async inviteAdmin(actorId: string, payload: InviteAdminDto) {
    await this.assertPermission(actorId, "manage_admins");
    const email = payload.email.trim().toLowerCase();
    if (await this.users.exists({ where: { email } })) throw new ConflictException("An account already uses this email");
    const rolePermissions = await this.rolePermissions();
    const invitationId = randomUUID();
    const user = await this.users.save(this.users.create({
      name: payload.name.trim(),
      email,
      phone: null,
      passwordHash: await hash(randomUUID(), 12),
      role: payload.role === "Super Admin" ? UserRole.SUPER_ADMIN : UserRole.ADMIN,
      adminRole: payload.role,
      permissions: rolePermissions[payload.role] ?? [],
      emailVerified: true,
      onboardingCompleted: true,
      status: UserStatus.ACTIVE,
    }));
    const token = await this.jwt.signAsync({ sub: user.id, type: "password-reset" }, {
      secret: this.config.getOrThrow("JWT_RESET_SECRET"),
      expiresIn: "24h",
    });
    try {
      await this.email.sendAdminInvitation({ email, name: user.name, role: payload.role, token, invitationId });
    } catch (error) {
      await this.users.delete(user.id);
      throw error;
    }
    await this.audit(actorId, "admin.invited", "user", user.id, { role: payload.role, email });
    return { id: user.id, name: user.name, email: user.email, role: user.adminRole, status: "invited" };
  }

  async removeAdmin(actorId: string, id: string) {
    await this.assertPermission(actorId, "manage_admins");
    if (actorId === id) throw new ForbiddenException("You cannot remove your own administrator account");
    const admin = await this.users.findOneBy({ id, role: In([UserRole.ADMIN, UserRole.SUPER_ADMIN]) });
    if (!admin) throw new NotFoundException("Administrator was not found");
    admin.status = UserStatus.DEACTIVATED;
    await this.users.save(admin);
    await this.audit(actorId, "admin.removed", "user", id, { role: admin.adminRole });
    return { success: true };
  }

  async rolePermissions() {
    return this.platform.get<Record<AdminRoleName, AdminPermission[]>>("role_permissions", DEFAULT_ROLE_PERMISSIONS);
  }

  async updateRolePermissions(actorId: string, payload: UpdateRolePermissionsDto) {
    await this.assertPermission(actorId, "manage_admins");
    const roles = Object.fromEntries(ADMIN_ROLES.map((role) => [role,
      [...new Set((payload.roles?.[role] ?? []).filter((permission): permission is AdminPermission => ADMIN_PERMISSIONS.includes(permission as AdminPermission)))],
    ])) as Record<AdminRoleName, AdminPermission[]>;
    roles["Super Admin"] = [...ADMIN_PERMISSIONS];
    await this.platform.set("role_permissions", roles);
    for (const role of ADMIN_ROLES) await this.users.update({ adminRole: role }, { permissions: roles[role] });
    await this.audit(actorId, "admin.permissions.updated", "platform", "role_permissions", roles);
    return roles;
  }

  async adminPreferences(actorId: string) {
    const admin = await this.users.findOneBy({ id: actorId });
    if (!admin) throw new NotFoundException("Administrator was not found");
    return { newUsers: true, verification: true, reports: true, digest: false, ...admin.adminPreferences };
  }

  async updateAdminPreferences(actorId: string, payload: UpdateAdminPreferencesDto) {
    const preferences = { newUsers: payload.newUsers, verification: payload.verification, reports: payload.reports, digest: payload.digest };
    await this.users.update(actorId, { adminPreferences: preferences });
    return preferences;
  }

  async systemControls(actorId: string) {
    await this.assertPermission(actorId, "manage_system");
    return this.platform.controls();
  }

  async updateSystemControls(actorId: string, payload: UpdateSystemControlsDto) {
    await this.assertPermission(actorId, "manage_system");
    const controls = { matching: payload.matching, maintenance: payload.maintenance, weeklyLimit: payload.weeklyLimit };
    await this.platform.set("system_controls", controls);
    await this.audit(actorId, "system.controls.updated", "platform", "system_controls", controls);
    return controls;
  }

  private async assertPermission(actorId: string, permission: AdminPermission) {
    const actor = await this.users.findOneBy({ id: actorId });
    if (!actor || ![UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(actor.role)) throw new ForbiddenException("Administrator access is required");
    if (actor.role !== UserRole.SUPER_ADMIN && !actor.permissions.includes(permission)) throw new ForbiddenException("You do not have permission for this action");
  }

  private async audit(actorId: string, action: string, targetType: string, targetId: string, metadata: Record<string, unknown>) {
    await this.auditLogs.save(this.auditLogs.create({ actorId, action, targetType, targetId, metadata }));
  }
}

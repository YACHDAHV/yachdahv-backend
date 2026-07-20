import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AuditLog, Match, Report, ReportStatus, User, UserStatus, VerificationStatus, VerificationSubmission } from "../database/entities";
import { EmailService } from "../email/email.service";
import { AdminListQueryDto, ReviewReportDto, ReviewVerificationDto, UpdateUserStatusDto } from "./dto/admin.dto";

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
  ) {}

  async dashboard() {
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

  async listUsers(query: AdminListQueryDto) {
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

  async user(id: string) {
    const user = await this.users.findOne({ where: { id }, relations: { profile: true, preference: true } });
    if (!user) throw new NotFoundException("User was not found");
    return user;
  }

  async updateUserStatus(actorId: string, id: string, payload: UpdateUserStatusDto) {
    const user = await this.user(id);
    user.status = payload.status;
    await this.users.save(user);
    await this.audit(actorId, "user.status.updated", "user", id, { status: payload.status });
    return user;
  }

  listMatches() {
    return this.matches.find({
      relations: { userA: { profile: true }, userB: { profile: true } },
      order: { updatedAt: "DESC" },
      take: 200,
    });
  }

  listActivity() {
    return this.auditLogs.find({ order: { createdAt: "DESC" }, take: 200 });
  }

  listVerifications() {
    return this.verifications.find({ where: { status: VerificationStatus.SUBMITTED }, relations: { user: { profile: true } }, order: { createdAt: "ASC" } });
  }

  async reviewVerification(actorId: string, id: string, payload: ReviewVerificationDto) {
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

  listReports() {
    return this.reports.find({ relations: { reporter: true, reported: true }, order: { createdAt: "DESC" }, take: 200 });
  }

  async reviewReport(actorId: string, id: string, payload: ReviewReportDto) {
    const report = await this.reports.findOneBy({ id });
    if (!report) throw new NotFoundException("Report was not found");
    report.status = payload.status;
    await this.reports.save(report);
    await this.audit(actorId, "report.reviewed", "report", id, { status: payload.status });
    return report;
  }

  private async audit(actorId: string, action: string, targetType: string, targetId: string, metadata: Record<string, unknown>) {
    await this.auditLogs.save(this.auditLogs.create({ actorId, action, targetType, targetId, metadata }));
  }
}

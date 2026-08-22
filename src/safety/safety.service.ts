import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Block, Match, MatchStatus, Report, User } from "../database/entities";
import { ReportUserDto } from "./dto/safety.dto";
import { AdminEmailAlertsService } from "../email/admin-email-alerts.service";

@Injectable()
export class SafetyService {
  constructor(
    @InjectRepository(Block) private readonly blocks: Repository<Block>,
    @InjectRepository(Report) private readonly reports: Repository<Report>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Match) private readonly matches: Repository<Match>,
    private readonly adminAlerts: AdminEmailAlertsService,
  ) {}

  async listBlocks(userId: string) {
    return this.blocks.find({ where: { blockerId: userId }, relations: { blocked: { profile: true } }, order: { createdAt: "DESC" } });
  }

  async block(userId: string, memberId: string) {
    if (userId === memberId) throw new BadRequestException("You cannot block yourself");
    if (!await this.users.exists({ where: { id: memberId } })) throw new NotFoundException("Member was not found");
    let block = await this.blocks.findOneBy({ blockerId: userId, blockedId: memberId });
    block ??= await this.blocks.save(this.blocks.create({ blockerId: userId, blockedId: memberId }));
    const [userAId, userBId] = [userId, memberId].sort();
    await this.matches.update({ userAId, userBId }, { status: MatchStatus.PASSED });
    return block;
  }

  async unblock(userId: string, memberId: string) {
    await this.blocks.delete({ blockerId: userId, blockedId: memberId });
    return { success: true };
  }

  async report(userId: string, payload: ReportUserDto) {
    if (userId === payload.memberId) throw new BadRequestException("You cannot report yourself");
    if (!await this.users.exists({ where: { id: payload.memberId } })) throw new NotFoundException("Member was not found");
    const report = await this.reports.save(this.reports.create({
      reporterId: userId,
      reportedId: payload.memberId,
      reason: payload.reason,
      details: payload.details ?? null,
    }));
    await this.adminAlerts.notify("reports", {
      subject: "A safety report needs attention",
      heading: "New safety report",
      content: `A member submitted a ${payload.reason} report for the trust and safety team.`,
      targetUrl: "/admin/verification",
      eventId: `report/${report.id}`,
    });
    return report;
  }
}

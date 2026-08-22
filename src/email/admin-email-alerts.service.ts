import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { User, UserRole, UserStatus } from "../database/entities";
import { EmailService } from "./email.service";

@Injectable()
export class AdminEmailAlertsService {
  private readonly logger = new Logger(AdminEmailAlertsService.name);

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly email: EmailService,
  ) {}

  async notify(preference: "newUsers" | "verification" | "reports", input: { subject: string; heading: string; content: string; targetUrl: string; eventId: string }) {
    const admins = await this.users.find({ where: { role: In([UserRole.ADMIN, UserRole.SUPER_ADMIN]), status: UserStatus.ACTIVE } });
    const recipients = admins.filter((admin) => admin.email && admin.adminPreferences?.[preference] !== false);
    const results = await Promise.allSettled(recipients.map((admin) => this.email.sendAdminAlert({
      email: admin.email!,
      name: admin.name,
      ...input,
      eventId: `${input.eventId}/${admin.id}`,
    })));
    results.forEach((result, index) => {
      if (result.status === "rejected") this.logger.error(`Admin alert failed for ${recipients[index].id}`, result.reason instanceof Error ? result.reason.stack : undefined);
    });
  }
}

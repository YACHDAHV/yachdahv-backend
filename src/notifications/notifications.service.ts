import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Notification } from "../database/entities";

@Injectable()
export class NotificationsService {
  constructor(@InjectRepository(Notification) private readonly notifications: Repository<Notification>) {}

  list(userId: string) {
    return this.notifications.find({ where: { userId }, order: { createdAt: "DESC" }, take: 100 });
  }

  async markRead(userId: string, id: string) {
    const notification = await this.notifications.findOneBy({ id, userId });
    if (!notification) throw new NotFoundException("Notification was not found");
    notification.readAt = new Date();
    return this.notifications.save(notification);
  }

  async markAllRead(userId: string) {
    await this.notifications.createQueryBuilder().update(Notification).set({ readAt: new Date() })
      .where("user_id = :userId", { userId }).andWhere("read_at IS NULL").execute();
    return { success: true };
  }
}

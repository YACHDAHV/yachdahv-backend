import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "../auth/auth.module";
import { Notification } from "../database/entities";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";

@Module({ imports: [AuthModule, TypeOrmModule.forFeature([Notification])], controllers: [NotificationsController], providers: [NotificationsService] })
export class NotificationsModule {}

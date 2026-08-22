import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { User } from "../database/entities";
import { AdminEmailAlertsService } from "./admin-email-alerts.service";
import { EmailService } from "./email.service";

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [EmailService, AdminEmailAlertsService],
  exports: [EmailService, AdminEmailAlertsService],
})
export class EmailModule {}

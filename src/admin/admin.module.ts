import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "../auth/auth.module";
import { AuditLog, Match, Report, User, VerificationSubmission } from "../database/entities";
import { EmailModule } from "../email/email.module";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";

@Module({ imports: [AuthModule, EmailModule, TypeOrmModule.forFeature([User, Match, Report, VerificationSubmission, AuditLog])], controllers: [AdminController], providers: [AdminService] })
export class AdminModule {}

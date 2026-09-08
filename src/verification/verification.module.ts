import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "../auth/auth.module";
import { User, VerificationSubmission } from "../database/entities";
import { EmailModule } from "../email/email.module";
import { StorageModule } from "../storage/storage.module";
import { PremblyClient } from "./prembly.client";
import { VerificationController, VerificationWebhooksController } from "./verification.controller";
import { VerificationService } from "./verification.service";

@Module({
  imports: [AuthModule, EmailModule, StorageModule, TypeOrmModule.forFeature([VerificationSubmission, User])],
  controllers: [VerificationController, VerificationWebhooksController],
  providers: [VerificationService, PremblyClient],
})
export class VerificationModule {}

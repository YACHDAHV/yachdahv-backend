import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "../auth/auth.module";
import { Church, User, WaitlistInvite } from "../database/entities";
import { EmailModule } from "../email/email.module";
import { AdminInvitationsController, OnboardingInvitationsController } from "./invitations.controller";
import { InvitationsService } from "./invitations.service";

@Module({
  imports: [AuthModule, EmailModule, TypeOrmModule.forFeature([Church, WaitlistInvite, User])],
  controllers: [OnboardingInvitationsController, AdminInvitationsController],
  providers: [InvitationsService],
  exports: [InvitationsService],
})
export class InvitationsModule {}

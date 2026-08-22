import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "../auth/auth.module";
import { Preference, Profile, User } from "../database/entities";
import { EmailModule } from "../email/email.module";
import { InvitationsModule } from "../invitations/invitations.module";
import { OnboardingController } from "./onboarding.controller";
import { OnboardingService } from "./onboarding.service";

@Module({
  imports: [AuthModule, EmailModule, InvitationsModule, TypeOrmModule.forFeature([User, Profile, Preference])],
  controllers: [OnboardingController],
  providers: [OnboardingService],
})
export class OnboardingModule {}

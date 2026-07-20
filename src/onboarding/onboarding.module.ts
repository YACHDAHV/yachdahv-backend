import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "../auth/auth.module";
import { Preference, Profile, User } from "../database/entities";
import { OnboardingController } from "./onboarding.controller";
import { OnboardingService } from "./onboarding.service";

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([User, Profile, Preference])],
  controllers: [OnboardingController],
  providers: [OnboardingService],
})
export class OnboardingModule {}

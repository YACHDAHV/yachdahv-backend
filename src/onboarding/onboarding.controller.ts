import { Body, Controller, Get, Put, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/auth.decorators";
import { AuthenticatedUser } from "../auth/auth.types";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CreateOnboardingDto } from "./dto/create-onboarding.dto";
import { OnboardingService } from "./onboarding.service";

@Controller("onboarding")
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  @UseGuards(JwtAuthGuard)
  @Get("me")
  getMine(@CurrentUser() user: AuthenticatedUser) { return this.onboarding.findForUser(user.sub); }

  @UseGuards(JwtAuthGuard)
  @Put("me")
  completeMine(@CurrentUser() user: AuthenticatedUser, @Body() payload: CreateOnboardingDto) {
    return this.onboarding.completeForUser(user.sub, payload);
  }
}

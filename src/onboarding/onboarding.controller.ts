import { Body, Controller, Get, Post, Put, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/auth.decorators";
import { AuthenticatedUser } from "../auth/auth.types";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CreateOnboardingDto } from "./dto/create-onboarding.dto";
import { OnboardingService } from "./onboarding.service";

@Controller("onboarding")
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  // Temporary compatibility endpoint for the current frontend's final onboarding screen.
  @Post()
  create(@Body() payload: CreateOnboardingDto) { return this.onboarding.createCompatibilityProfile(payload); }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  getMine(@CurrentUser() user: AuthenticatedUser) { return this.onboarding.findForUser(user.sub); }

  @UseGuards(JwtAuthGuard)
  @Put("me")
  completeMine(@CurrentUser() user: AuthenticatedUser, @Body() payload: CreateOnboardingDto) {
    return this.onboarding.completeForUser(user.sub, payload);
  }
}

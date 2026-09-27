import { Body, Controller, Delete, Get, Headers, Ip, Patch, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/auth.decorators";
import { AuthenticatedUser } from "../auth/auth.types";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { UpdatePreferencesDto, UpdateProfileDto } from "./dto/update-user.dto";
import { UsersService } from "./users.service";
import { UpdateConsentDto } from "./consent";

@UseGuards(JwtAuthGuard)
@Controller("users/me")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  getMe(@CurrentUser() user: AuthenticatedUser) { return this.users.getMe(user.sub); }

  @Patch("profile")
  updateProfile(@CurrentUser() user: AuthenticatedUser, @Body() payload: UpdateProfileDto) {
    return this.users.updateProfile(user.sub, payload);
  }

  @Patch("preferences")
  updatePreferences(@CurrentUser() user: AuthenticatedUser, @Body() payload: UpdatePreferencesDto) {
    return this.users.updatePreferences(user.sub, payload);
  }

  @Patch("password")
  changePassword(@CurrentUser() user: AuthenticatedUser, @Body() payload: ChangePasswordDto) {
    return this.users.changePassword(user.sub, payload);
  }

  @Get("consents")
  consentHistory(@CurrentUser() user: AuthenticatedUser) { return this.users.consentHistory(user.sub); }

  @Post("consents")
  recordConsent(@CurrentUser() user: AuthenticatedUser, @Body() payload: UpdateConsentDto, @Ip() ipAddress: string, @Headers("user-agent") userAgent?: string) {
    return this.users.recordConsent(user.sub, payload, { ipAddress, userAgent });
  }

  @Delete()
  deactivate(@CurrentUser() user: AuthenticatedUser) { return this.users.deactivate(user.sub); }

  @Post("reactivate")
  reactivate(@CurrentUser() user: AuthenticatedUser) { return this.users.reactivate(user.sub); }
}

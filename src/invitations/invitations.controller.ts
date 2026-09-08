import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { CurrentUser, Roles } from "../auth/auth.decorators";
import { AuthenticatedUser } from "../auth/auth.types";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { UserRole } from "../database/entities";
import { BatchWaitlistInviteDto, CreateChurchDto, CreateWaitlistInviteDto, RequestWaitlistInviteDto, UpdateChurchDto, ValidateWaitlistInviteDto } from "./dto/invitation.dto";
import { InvitationsService } from "./invitations.service";

@UseGuards(JwtAuthGuard)
@Controller("onboarding")
export class OnboardingInvitationsController {
  constructor(private readonly invitations: InvitationsService) {}
  @Get("churches") churches() { return this.invitations.listChurches(); }
  @Throttle({ default: { limit: 3, ttl: 600_000 } })
  @Post("invitation/request") request(@CurrentUser() user: AuthenticatedUser, @Body() payload: RequestWaitlistInviteDto = {}) { return this.invitations.requestForUser(user.sub, payload.churchId); }
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  @Post("invitation/validate") validate(@CurrentUser() user: AuthenticatedUser, @Body() payload: ValidateWaitlistInviteDto) { return this.invitations.validateForUser(user.sub, payload); }
}

@UseGuards(JwtAuthGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Controller("admin")
export class AdminInvitationsController {
  constructor(private readonly invitations: InvitationsService) {}
  @Get("churches") churches() { return this.invitations.listChurches(true); }
  @Post("churches") createChurch(@CurrentUser() actor: AuthenticatedUser, @Body() payload: CreateChurchDto) { return this.invitations.createChurch(actor.sub, payload); }
  @Patch("churches/:id") updateChurch(@CurrentUser() actor: AuthenticatedUser, @Param("id", ParseUUIDPipe) id: string, @Body() payload: UpdateChurchDto) { return this.invitations.updateChurch(actor.sub, id, payload); }
  @Get("waitlist-invites") invites(@CurrentUser() actor: AuthenticatedUser, @Query("search") search?: string, @Query("status") status?: string) { return this.invitations.listInvites(actor.sub, search, status); }
  @Post("waitlist-invites") createInvite(@CurrentUser() actor: AuthenticatedUser, @Body() payload: CreateWaitlistInviteDto) { return this.invitations.createInvite(actor.sub, payload); }
  @Post("waitlist-invites/batch") batch(@CurrentUser() actor: AuthenticatedUser, @Body() payload: BatchWaitlistInviteDto) { return this.invitations.batchCreate(actor.sub, payload); }
  @Post("waitlist-invites/:id/resend") resend(@CurrentUser() actor: AuthenticatedUser, @Param("id", ParseUUIDPipe) id: string) { return this.invitations.replaceAndResend(actor.sub, id); }
  @Delete("waitlist-invites/:id") revoke(@CurrentUser() actor: AuthenticatedUser, @Param("id", ParseUUIDPipe) id: string) { return this.invitations.revoke(actor.sub, id); }
}

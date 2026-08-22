import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query, UseGuards } from "@nestjs/common";
import { CurrentUser, Roles } from "../auth/auth.decorators";
import { AuthenticatedUser } from "../auth/auth.types";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { UserRole } from "../database/entities";
import { AdminService } from "./admin.service";
import { AdminListQueryDto, InviteAdminDto, ReviewReportDto, ReviewVerificationDto, UpdateAdminPreferencesDto, UpdateRolePermissionsDto, UpdateSystemControlsDto, UpdateUserStatusDto } from "./dto/admin.dto";

@UseGuards(JwtAuthGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Controller("admin")
export class AdminController {
  constructor(private readonly admin: AdminService) {}
  @Get("dashboard") dashboard(@CurrentUser() actor: AuthenticatedUser) { return this.admin.dashboard(actor.sub); }
  @Get("users") users(@CurrentUser() actor: AuthenticatedUser, @Query() query: AdminListQueryDto) { return this.admin.listUsers(actor.sub, query); }
  @Get("users/:id") user(@CurrentUser() actor: AuthenticatedUser, @Param("id", ParseUUIDPipe) id: string) { return this.admin.user(id, actor.sub); }
  @Patch("users/:id/status") updateUser(@CurrentUser() actor: AuthenticatedUser, @Param("id", ParseUUIDPipe) id: string, @Body() payload: UpdateUserStatusDto) { return this.admin.updateUserStatus(actor.sub, id, payload); }
  @Get("matches") matches(@CurrentUser() actor: AuthenticatedUser) { return this.admin.listMatches(actor.sub); }
  @Get("activity") activity(@CurrentUser() actor: AuthenticatedUser) { return this.admin.listActivity(actor.sub); }
  @Get("verifications") verifications(@CurrentUser() actor: AuthenticatedUser) { return this.admin.listVerifications(actor.sub); }
  @Patch("verifications/:id") reviewVerification(@CurrentUser() actor: AuthenticatedUser, @Param("id", ParseUUIDPipe) id: string, @Body() payload: ReviewVerificationDto) { return this.admin.reviewVerification(actor.sub, id, payload); }
  @Get("reports") reports(@CurrentUser() actor: AuthenticatedUser) { return this.admin.listReports(actor.sub); }
  @Patch("reports/:id") reviewReport(@CurrentUser() actor: AuthenticatedUser, @Param("id", ParseUUIDPipe) id: string, @Body() payload: ReviewReportDto) { return this.admin.reviewReport(actor.sub, id, payload); }
  @Get("administrators") administrators(@CurrentUser() actor: AuthenticatedUser) { return this.admin.listAdmins(actor.sub); }
  @Post("administrators") inviteAdmin(@CurrentUser() actor: AuthenticatedUser, @Body() payload: InviteAdminDto) { return this.admin.inviteAdmin(actor.sub, payload); }
  @Delete("administrators/:id") removeAdmin(@CurrentUser() actor: AuthenticatedUser, @Param("id", ParseUUIDPipe) id: string) { return this.admin.removeAdmin(actor.sub, id); }
  @Get("role-permissions") rolePermissions() { return this.admin.rolePermissions(); }
  @Put("role-permissions") updateRolePermissions(@CurrentUser() actor: AuthenticatedUser, @Body() payload: UpdateRolePermissionsDto) { return this.admin.updateRolePermissions(actor.sub, payload); }
  @Get("preferences") preferences(@CurrentUser() actor: AuthenticatedUser) { return this.admin.adminPreferences(actor.sub); }
  @Put("preferences") updatePreferences(@CurrentUser() actor: AuthenticatedUser, @Body() payload: UpdateAdminPreferencesDto) { return this.admin.updateAdminPreferences(actor.sub, payload); }
  @Get("system-controls") systemControls(@CurrentUser() actor: AuthenticatedUser) { return this.admin.systemControls(actor.sub); }
  @Put("system-controls") updateSystemControls(@CurrentUser() actor: AuthenticatedUser, @Body() payload: UpdateSystemControlsDto) { return this.admin.updateSystemControls(actor.sub, payload); }
}

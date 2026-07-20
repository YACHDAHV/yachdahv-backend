import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query, UseGuards } from "@nestjs/common";
import { CurrentUser, Roles } from "../auth/auth.decorators";
import { AuthenticatedUser } from "../auth/auth.types";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { UserRole } from "../database/entities";
import { AdminService } from "./admin.service";
import { AdminListQueryDto, ReviewReportDto, ReviewVerificationDto, UpdateUserStatusDto } from "./dto/admin.dto";

@UseGuards(JwtAuthGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Controller("admin")
export class AdminController {
  constructor(private readonly admin: AdminService) {}
  @Get("dashboard") dashboard() { return this.admin.dashboard(); }
  @Get("users") users(@Query() query: AdminListQueryDto) { return this.admin.listUsers(query); }
  @Get("users/:id") user(@Param("id", ParseUUIDPipe) id: string) { return this.admin.user(id); }
  @Patch("users/:id/status") updateUser(@CurrentUser() actor: AuthenticatedUser, @Param("id", ParseUUIDPipe) id: string, @Body() payload: UpdateUserStatusDto) { return this.admin.updateUserStatus(actor.sub, id, payload); }
  @Get("matches") matches() { return this.admin.listMatches(); }
  @Get("activity") activity() { return this.admin.listActivity(); }
  @Get("verifications") verifications() { return this.admin.listVerifications(); }
  @Patch("verifications/:id") reviewVerification(@CurrentUser() actor: AuthenticatedUser, @Param("id", ParseUUIDPipe) id: string, @Body() payload: ReviewVerificationDto) { return this.admin.reviewVerification(actor.sub, id, payload); }
  @Get("reports") reports() { return this.admin.listReports(); }
  @Patch("reports/:id") reviewReport(@CurrentUser() actor: AuthenticatedUser, @Param("id", ParseUUIDPipe) id: string, @Body() payload: ReviewReportDto) { return this.admin.reviewReport(actor.sub, id, payload); }
}

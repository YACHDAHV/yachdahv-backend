import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/auth.decorators";
import { AuthenticatedUser } from "../auth/auth.types";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ReportUserDto } from "./dto/safety.dto";
import { SafetyService } from "./safety.service";

@UseGuards(JwtAuthGuard)
@Controller("safety")
export class SafetyController {
  constructor(private readonly safety: SafetyService) {}
  @Get("blocks") list(@CurrentUser() user: AuthenticatedUser) { return this.safety.listBlocks(user.sub); }
  @Post("blocks/:memberId") block(@CurrentUser() user: AuthenticatedUser, @Param("memberId", ParseUUIDPipe) memberId: string) { return this.safety.block(user.sub, memberId); }
  @Delete("blocks/:memberId") unblock(@CurrentUser() user: AuthenticatedUser, @Param("memberId", ParseUUIDPipe) memberId: string) { return this.safety.unblock(user.sub, memberId); }
  @Post("reports") report(@CurrentUser() user: AuthenticatedUser, @Body() payload: ReportUserDto) { return this.safety.report(user.sub, payload); }
}

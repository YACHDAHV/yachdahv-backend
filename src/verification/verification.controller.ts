import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/auth.decorators";
import { AuthenticatedUser } from "../auth/auth.types";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { SubmitVerificationDto } from "./dto/verification.dto";
import { VerificationService } from "./verification.service";

@UseGuards(JwtAuthGuard)
@Controller("verification")
export class VerificationController {
  constructor(private readonly verification: VerificationService) {}
  @Get() status(@CurrentUser() user: AuthenticatedUser) { return this.verification.status(user.sub); }
  @Post() submit(@CurrentUser() user: AuthenticatedUser, @Body() payload: SubmitVerificationDto) { return this.verification.submit(user.sub, payload); }
}

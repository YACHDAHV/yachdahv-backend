import { Body, Controller, Get, Headers, Post, Query, RawBodyRequest, Req, UnauthorizedException, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/auth.decorators";
import { AuthenticatedUser } from "../auth/auth.types";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { SubmitVerificationDto } from "./dto/verification.dto";
import { PremblyClient } from "./prembly.client";
import { VerificationService } from "./verification.service";
import type { Request } from "express";

@UseGuards(JwtAuthGuard)
@Controller("verification")
export class VerificationController {
  constructor(private readonly verification: VerificationService) {}

  @Get()
  status(@CurrentUser() user: AuthenticatedUser) {
    return this.verification.status(user.sub);
  }

  @Post()
  submit(@CurrentUser() user: AuthenticatedUser, @Body() payload: SubmitVerificationDto) {
    return this.verification.submit(user.sub, payload);
  }
}

@Controller("verification/webhooks")
export class VerificationWebhooksController {
  constructor(
    private readonly verification: VerificationService,
    private readonly prembly: PremblyClient,
  ) {}

  @Post("prembly")
  handlePrembly(
    @Req() request: RawBodyRequest<Request>,
    @Body() payload: Record<string, unknown>,
    @Headers("x-prembly-signature") signature?: string,
    @Query("submissionId") submissionId?: string,
  ) {
    const rawBody = request.rawBody?.toString("utf8") ?? JSON.stringify(payload ?? {});
    if (!this.prembly.verifyWebhookSignature(rawBody, signature)) {
      throw new UnauthorizedException("Invalid Prembly signature");
    }
    return this.verification.handlePremblyWebhook(payload ?? {}, submissionId);
  }
}

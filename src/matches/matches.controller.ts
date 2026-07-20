import { Controller, DefaultValuePipe, Get, Param, ParseIntPipe, ParseUUIDPipe, Post, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/auth.decorators";
import { AuthenticatedUser } from "../auth/auth.types";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { MatchesService } from "./matches.service";

@UseGuards(JwtAuthGuard)
@Controller("matches")
export class MatchesController {
  constructor(private readonly matches: MatchesService) {}

  @Get("suggestions")
  suggestions(@CurrentUser() user: AuthenticatedUser, @Query("limit", new DefaultValuePipe(20), ParseIntPipe) limit: number) {
    return this.matches.suggestions(user.sub, limit);
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) { return this.matches.list(user.sub); }

  @Post(":targetId/like")
  like(@CurrentUser() user: AuthenticatedUser, @Param("targetId", ParseUUIDPipe) targetId: string) {
    return this.matches.like(user.sub, targetId);
  }

  @Post(":targetId/pass")
  pass(@CurrentUser() user: AuthenticatedUser, @Param("targetId", ParseUUIDPipe) targetId: string) {
    return this.matches.pass(user.sub, targetId);
  }
}

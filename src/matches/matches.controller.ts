import { Controller, DefaultValuePipe, Delete, Get, HttpCode, Param, ParseIntPipe, ParseUUIDPipe, Post, Put, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/auth.decorators";
import { AuthenticatedUser } from "../auth/auth.types";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { FavoritesService } from "./favorites.service";
import { MatchesService } from "./matches.service";

@UseGuards(JwtAuthGuard)
@Controller("matches")
export class MatchesController {
  constructor(private readonly matches: MatchesService, private readonly favorites: FavoritesService) {}

  @Get("dashboard")
  dashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.matches.dashboard(user.sub);
  }

  @Get("suggestions")
  suggestions(@CurrentUser() user: AuthenticatedUser, @Query("limit", new DefaultValuePipe(20), ParseIntPipe) limit: number) {
    return this.matches.suggestions(user.sub, limit);
  }

  // Each match carries `favorite`: whether this member has starred the other person.
  @Get()
  async list(@CurrentUser() user: AuthenticatedUser) {
    const [matches, favorites] = await Promise.all([this.matches.list(user.sub), this.favorites.memberIds(user.sub)]);
    return matches.map((match) => ({ ...match, favorite: favorites.has(match.userAId === user.sub ? match.userBId : match.userAId) }));
  }

  @Put(":memberId/favorite")
  favorite(@CurrentUser() user: AuthenticatedUser, @Param("memberId", ParseUUIDPipe) memberId: string) {
    return this.favorites.set(user.sub, memberId, true);
  }

  @Delete(":memberId/favorite")
  @HttpCode(200)
  unfavorite(@CurrentUser() user: AuthenticatedUser, @Param("memberId", ParseUUIDPipe) memberId: string) {
    return this.favorites.set(user.sub, memberId, false);
  }

  @Post(":targetId/like")
  like(@CurrentUser() user: AuthenticatedUser, @Param("targetId", ParseUUIDPipe) targetId: string) {
    return this.matches.like(user.sub, targetId);
  }

  @Post(":targetId/pass")
  pass(@CurrentUser() user: AuthenticatedUser, @Param("targetId", ParseUUIDPipe) targetId: string) {
    return this.matches.pass(user.sub, targetId);
  }
}

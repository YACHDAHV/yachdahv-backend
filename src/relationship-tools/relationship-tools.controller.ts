import { Body, Controller, Get, Post, Put, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/auth.decorators";
import { AuthenticatedUser } from "../auth/auth.types";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { SaveReflectionDto, SetDevotionalDayDto, ToggleTopicDto } from "./dto/relationship-tools.dto";
import { RelationshipToolsService } from "./relationship-tools.service";

@UseGuards(JwtAuthGuard)
@Controller("relationship-tools")
export class RelationshipToolsController {
  constructor(private readonly tools: RelationshipToolsService) {}
  @Get("state") state(@CurrentUser() user: AuthenticatedUser, @Query("matchId") matchId?: string) { return this.tools.state(user.sub, matchId); }
  @Put("devotional/day") setDay(@CurrentUser() user: AuthenticatedUser, @Body() payload: SetDevotionalDayDto, @Query("matchId") matchId?: string) { return this.tools.setDay(user.sub, payload, matchId); }
  @Post("devotional/reflections") reflection(@CurrentUser() user: AuthenticatedUser, @Body() payload: SaveReflectionDto, @Query("matchId") matchId?: string) { return this.tools.saveReflection(user.sub, payload, matchId); }
  @Post("conversation-topics/toggle") topic(@CurrentUser() user: AuthenticatedUser, @Body() payload: ToggleTopicDto, @Query("matchId") matchId?: string) { return this.tools.toggleTopic(user.sub, payload, matchId); }
}

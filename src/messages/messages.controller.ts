import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/auth.decorators";
import { AuthenticatedUser } from "../auth/auth.types";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CreateConversationDto, SendMessageDto } from "./dto/message.dto";
import { MessagesGateway } from "./messages.gateway";
import { MessagesService } from "./messages.service";

@UseGuards(JwtAuthGuard)
@Controller("conversations")
export class MessagesController {
  constructor(
    private readonly messages: MessagesService,
    private readonly gateway: MessagesGateway,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) { return this.messages.listConversations(user.sub); }

  @Get("unread-count")
  unreadCount(@CurrentUser() user: AuthenticatedUser) { return this.messages.unreadMessageCount(user.sub); }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() payload: CreateConversationDto) {
    return this.messages.createConversation(user.sub, payload.memberId);
  }

  @Get(":id/messages")
  listMessages(@CurrentUser() user: AuthenticatedUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.messages.listMessages(user.sub, id);
  }

  @Post(":id/messages")
  async send(@CurrentUser() user: AuthenticatedUser, @Param("id", ParseUUIDPipe) id: string, @Body() payload: SendMessageDto) {
    const message = await this.messages.send(user.sub, id, payload.body);
    await this.gateway.publishMessage(message);
    return message;
  }

  @Post(":id/read")
  read(@CurrentUser() user: AuthenticatedUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.messages.markRead(user.sub, id);
  }
}

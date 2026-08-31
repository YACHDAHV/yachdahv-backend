import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "../auth/auth.module";
import { Block, Conversation, Match, Message, Notification, User } from "../database/entities";
import { EmailModule } from "../email/email.module";
import { MessagesController } from "./messages.controller";
import { MessagesGateway } from "./messages.gateway";
import { MessagesService } from "./messages.service";

@Module({ imports: [AuthModule, EmailModule, TypeOrmModule.forFeature([Conversation, Message, Match, Block, Notification, User])], controllers: [MessagesController], providers: [MessagesService, MessagesGateway] })
export class MessagesModule {}

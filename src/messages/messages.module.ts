import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "../auth/auth.module";
import { Block, Conversation, Match, Message, Notification } from "../database/entities";
import { MessagesController } from "./messages.controller";
import { MessagesService } from "./messages.service";

@Module({ imports: [AuthModule, TypeOrmModule.forFeature([Conversation, Message, Match, Block, Notification])], controllers: [MessagesController], providers: [MessagesService] })
export class MessagesModule {}

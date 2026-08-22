import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "../auth/auth.module";
import { Block, Match, Notification, User } from "../database/entities";
import { PlatformModule } from "../platform/platform.module";
import { MatchesController } from "./matches.controller";
import { MatchesService } from "./matches.service";

@Module({ imports: [AuthModule, PlatformModule, TypeOrmModule.forFeature([User, Match, Block, Notification])], controllers: [MatchesController], providers: [MatchesService] })
export class MatchesModule {}

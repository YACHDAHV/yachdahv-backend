import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "../auth/auth.module";
import { Block, FavoriteMatch, Match, Notification, User } from "../database/entities";
import { EmailModule } from "../email/email.module";
import { PlatformModule } from "../platform/platform.module";
import { MatchesController } from "./matches.controller";
import { FavoritesService } from "./favorites.service";
import { MatchesService } from "./matches.service";

@Module({ imports: [AuthModule, PlatformModule, EmailModule, TypeOrmModule.forFeature([User, Match, Block, Notification, FavoriteMatch])], controllers: [MatchesController], providers: [MatchesService, FavoritesService] })
export class MatchesModule {}

import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "../auth/auth.module";
import { Block, Match, User } from "../database/entities";
import { MatchesController } from "./matches.controller";
import { MatchesService } from "./matches.service";

@Module({ imports: [AuthModule, TypeOrmModule.forFeature([User, Match, Block])], controllers: [MatchesController], providers: [MatchesService] })
export class MatchesModule {}

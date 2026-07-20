import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "../auth/auth.module";
import { Block, Match, Report, User } from "../database/entities";
import { SafetyController } from "./safety.controller";
import { SafetyService } from "./safety.service";

@Module({ imports: [AuthModule, TypeOrmModule.forFeature([Block, Report, User, Match])], controllers: [SafetyController], providers: [SafetyService] })
export class SafetyModule {}

import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "../auth/auth.module";
import { Block, Match, Report, User } from "../database/entities";
import { EmailModule } from "../email/email.module";
import { SafetyController } from "./safety.controller";
import { SafetyService } from "./safety.service";

@Module({ imports: [AuthModule, EmailModule, TypeOrmModule.forFeature([Block, Report, User, Match])], controllers: [SafetyController], providers: [SafetyService] })
export class SafetyModule {}

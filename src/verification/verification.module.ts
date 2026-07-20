import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "../auth/auth.module";
import { User, VerificationSubmission } from "../database/entities";
import { VerificationController } from "./verification.controller";
import { VerificationService } from "./verification.service";

@Module({ imports: [AuthModule, TypeOrmModule.forFeature([VerificationSubmission, User])], controllers: [VerificationController], providers: [VerificationService] })
export class VerificationModule {}

import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuditLog } from "../database/entities";
import { SupportController } from "./support.controller";

@Module({ imports: [TypeOrmModule.forFeature([AuditLog])], controllers: [SupportController] })
export class SupportModule {}

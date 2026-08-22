import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "../auth/auth.module";
import { Match, Notification, RelationshipToolState } from "../database/entities";
import { RelationshipToolsController } from "./relationship-tools.controller";
import { RelationshipToolsService } from "./relationship-tools.service";

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([Match, RelationshipToolState, Notification])],
  controllers: [RelationshipToolsController],
  providers: [RelationshipToolsService],
})
export class RelationshipToolsModule {}

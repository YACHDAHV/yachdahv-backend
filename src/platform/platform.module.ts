import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { PlatformSetting } from "../database/entities";
import { MaintenanceGuard } from "./maintenance.guard";
import { PlatformService } from "./platform.service";

@Module({
  imports: [TypeOrmModule.forFeature([PlatformSetting])],
  providers: [PlatformService, MaintenanceGuard],
  exports: [PlatformService, MaintenanceGuard],
})
export class PlatformModule {}

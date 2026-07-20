import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { databaseEntities } from "./entities";

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: "postgres" as const,
        url: config.getOrThrow<string>("DATABASE_URL"),
        entities: databaseEntities,
        synchronize: config.get("DB_SYNCHRONIZE") === "true" && config.get("NODE_ENV") !== "production",
        ssl: config.get("DATABASE_SSL") === "true" ? { rejectUnauthorized: false } : false,
        logging: config.get("DB_LOGGING") === "true",
      }),
    }),
  ],
})
export class DatabaseModule {}

import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AdminModule } from "./admin/admin.module";
import { AppController } from "./app.controller";
import { AuthModule } from "./auth/auth.module";
import { DatabaseModule } from "./database/database.module";
import { MatchesModule } from "./matches/matches.module";
import { InvitationsModule } from "./invitations/invitations.module";
import { MessagesModule } from "./messages/messages.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { OnboardingModule } from "./onboarding/onboarding.module";
import { MaintenanceGuard } from "./platform/maintenance.guard";
import { PlatformModule } from "./platform/platform.module";
import { RelationshipToolsModule } from "./relationship-tools/relationship-tools.module";
import { SafetyModule } from "./safety/safety.module";
import { StorageModule } from "./storage/storage.module";
import { SupportModule } from "./support/support.module";
import { UsersModule } from "./users/users.module";
import { VerificationModule } from "./verification/verification.module";

function validateEnvironment(config: Record<string, unknown>) {
  const required = ["DATABASE_URL", "JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET", "JWT_RESET_SECRET"];
  if (config.NODE_ENV === "production") required.push("RESEND_API_KEY", "RESEND_FROM_EMAIL", "FRONTEND_ORIGIN");
  const missing = required.filter((key) => typeof config[key] !== "string" || String(config[key]).length < 12);
  if (missing.length) throw new Error(`Missing or insecure environment variables: ${missing.join(", ")}`);
  return config;
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    DatabaseModule,
    PlatformModule,
    AuthModule,
    InvitationsModule,
    OnboardingModule,
    UsersModule,
    MatchesModule,
    MessagesModule,
    NotificationsModule,
    RelationshipToolsModule,
    SafetyModule,
    VerificationModule,
    StorageModule,
    AdminModule,
    SupportModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: MaintenanceGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}

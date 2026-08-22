import { CanActivate, ExecutionContext, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { PlatformService } from "./platform.service";

@Injectable()
export class MaintenanceGuard implements CanActivate {
  constructor(private readonly platform: PlatformService) {}

  async canActivate(context: ExecutionContext) {
    if (context.getType() !== "http") return true;
    const request = context.switchToHttp().getRequest<{ originalUrl?: string; url?: string }>();
    const path = request.originalUrl ?? request.url ?? "";
    if (/\/api\/(health|auth(?:\/|$)|admin(?:\/|$)|support\/contact)/.test(path)) return true;
    if ((await this.platform.controls()).maintenance) {
      throw new ServiceUnavailableException("Yachdahv is temporarily under maintenance");
    }
    return true;
  }
}

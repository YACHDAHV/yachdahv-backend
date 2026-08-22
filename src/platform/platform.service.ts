import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { PlatformSetting } from "../database/entities";

export interface SystemControls {
  matching: boolean;
  maintenance: boolean;
  weeklyLimit: number;
}

@Injectable()
export class PlatformService {
  constructor(@InjectRepository(PlatformSetting) private readonly settings: Repository<PlatformSetting>) {}

  async controls(): Promise<SystemControls> {
    const setting = await this.settings.findOneBy({ key: "system_controls" });
    return {
      matching: setting?.value.matching !== false,
      maintenance: setting?.value.maintenance === true,
      weeklyLimit: Math.min(50, Math.max(1, Number(setting?.value.weeklyLimit) || 5)),
    };
  }

  async get<T extends Record<string, unknown>>(key: string, fallback: T): Promise<T> {
    const setting = await this.settings.findOneBy({ key });
    return (setting?.value as T | undefined) ?? fallback;
  }

  async set(key: string, value: Record<string, unknown>) {
    return this.settings.save(this.settings.create({ key, value }));
  }
}

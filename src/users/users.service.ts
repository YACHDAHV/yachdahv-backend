import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { compare, hash } from "bcryptjs";
import { Repository } from "typeorm";
import { Preference, Profile, User, UserStatus } from "../database/entities";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { UpdatePreferencesDto, UpdateProfileDto } from "./dto/update-user.dto";

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Profile) private readonly profiles: Repository<Profile>,
    @InjectRepository(Preference) private readonly preferences: Repository<Preference>,
  ) {}

  async getMe(userId: string) {
    const user = await this.users.findOne({ where: { id: userId }, relations: { profile: true, preference: true } });
    if (!user) throw new NotFoundException("User was not found");
    return user;
  }

  async updateProfile(userId: string, payload: UpdateProfileDto) {
    if (payload.interests && payload.interests.length > 5) throw new BadRequestException("Choose no more than five interests");
    const user = await this.users.findOneBy({ id: userId });
    if (!user) throw new NotFoundException("User was not found");
    if (payload.name) {
      user.name = payload.name.trim();
      await this.users.save(user);
    }
    const profile = await this.profiles.findOneBy({ userId }) ?? this.profiles.create({ userId, interests: [], photos: [] });
    const { name: _name, ...profileFields } = payload;
    Object.assign(profile, profileFields);
    await this.profiles.save(profile);
    return this.getMe(userId);
  }

  async updatePreferences(userId: string, payload: UpdatePreferencesDto) {
    if (payload.minAge && payload.maxAge && payload.minAge > payload.maxAge) throw new BadRequestException("Minimum age cannot exceed maximum age");
    const preference = await this.preferences.findOneBy({ userId }) ?? this.preferences.create({ userId });
    Object.assign(preference, payload);
    await this.preferences.save(preference);
    return preference;
  }

  async changePassword(userId: string, payload: ChangePasswordDto) {
    const user = await this.users.createQueryBuilder("user")
      .addSelect("user.passwordHash")
      .where("user.id = :userId", { userId })
      .getOne();
    if (!user) throw new NotFoundException("User was not found");
    if (!user.passwordHash || !(await compare(payload.currentPassword, user.passwordHash))) {
      throw new UnauthorizedException("Current password is incorrect");
    }
    await this.users.update(userId, { passwordHash: await hash(payload.newPassword, 12) });
    return { success: true };
  }

  async deactivate(userId: string) {
    await this.users.update(userId, { status: UserStatus.DEACTIVATED });
    return { success: true };
  }

  async reactivate(userId: string) {
    await this.users.update(userId, { status: UserStatus.ACTIVE });
    return this.getMe(userId);
  }
}

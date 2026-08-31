import { BadRequestException, Injectable, NotFoundException, Optional } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Preference, Profile, User } from "../database/entities";
import { AdminEmailAlertsService } from "../email/admin-email-alerts.service";
import { InvitationsService } from "../invitations/invitations.service";
import { CreateOnboardingDto } from "./dto/create-onboarding.dto";

@Injectable()
export class OnboardingService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Profile) private readonly profiles: Repository<Profile>,
    @InjectRepository(Preference) private readonly preferences: Repository<Preference>,
    @Optional() private readonly adminAlerts?: AdminEmailAlertsService,
    @Optional() private readonly invitations?: InvitationsService,
  ) {}

  async completeForUser(userId: string, payload: CreateOnboardingDto) {
    const user = await this.users.findOneBy({ id: userId });
    if (!user) throw new NotFoundException("User was not found");
    const wasCompleted = user.onboardingCompleted;
    const completed = await this.persist(user, payload);
    if (!wasCompleted) await this.adminAlerts?.notify("newUsers", {
      subject: "A new member completed Yachdahv onboarding",
      heading: "New member onboarding",
      content: `${completed.name} completed their profile and joined the matching community.`,
      targetUrl: `/admin/users/${completed.id}`,
      eventId: `onboarding/${completed.id}`,
    });
    return completed;
  }

  async findForUser(userId: string) {
    const user = await this.users.findOne({
      where: { id: userId },
      relations: { profile: true, preference: true },
    });
    if (!user) throw new NotFoundException("User was not found");
    return user;
  }

  private async persist(user: User, payload: CreateOnboardingDto) {
    const bio = payload.bio?.trim();
    const inviteCode = payload.inviteCode?.trim();
    if (!payload.age) throw new BadRequestException("Age is required");
    if (!bio) throw new BadRequestException("Short bio is required");
    if (!payload.churchId) throw new BadRequestException("Church selection is required");
    if (!inviteCode) throw new BadRequestException("Invitation code is required");
    if (!this.invitations) throw new BadRequestException("Invitation validation is unavailable");

    return this.users.manager.transaction(async (manager) => {
      const invitation = await this.invitations!.consumeForUser(user, payload.churchId!, inviteCode, manager);
      const church = invitation.church!;
      if (payload.name) user.name = payload.name.trim();
      if (payload.phone) user.phone = payload.phone;
      user.onboardingCompleted = true;
      await manager.save(User, user);

      const profile = await manager.findOne(Profile, { where: { userId: user.id } }) ?? manager.create(Profile, { userId: user.id, interests: [], photos: [] });
      Object.assign(profile, {
        age: payload.age ?? profile.age,
        gender: payload.gender ?? profile.gender,
        occupation: payload.occupation ?? profile.occupation,
        country: payload.country ?? profile.country,
        city: payload.city ?? profile.city,
        bio,
        church: church.name,
        churchId: church.id,
        inviteCode: null,
        intention: payload.intent ?? profile.intention,
        interests: payload.interests?.slice(0, 5) ?? profile.interests,
        education: payload.education ?? profile.education,
      });
      await manager.save(Profile, profile);

      const preference = await manager.findOne(Preference, { where: { userId: user.id } }) ?? manager.create(Preference, { userId: user.id });
      Object.assign(preference, {
        minAge: payload.minAge ?? preference.minAge,
        maxAge: payload.maxAge ?? preference.maxAge,
        location: preference.location,
        maxDistanceKm: payload.maxDistanceKm ?? preference.maxDistanceKm,
        education: payload.education ?? preference.education,
      });
      await manager.save(Preference, preference);
      return manager.findOneOrFail(User, { where: { id: user.id }, relations: { profile: true, preference: true } });
    });
  }
}

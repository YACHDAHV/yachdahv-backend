import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Brackets, IsNull, Repository } from "typeorm";
import { Block, Conversation, Match, MatchStatus, Notification, User, UserRole, UserStatus, VerificationStatus } from "../database/entities";
import { PlatformService } from "../platform/platform.service";

@Injectable()
export class MatchesService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Match) private readonly matches: Repository<Match>,
    @InjectRepository(Block) private readonly blocks: Repository<Block>,
    @InjectRepository(Notification) private readonly notifications: Repository<Notification>,
    @Optional() private readonly config?: ConfigService,
    @Optional() private readonly platform?: PlatformService,
  ) {}

  async dashboard(userId: string) {
    const user = await this.users.findOne({ where: { id: userId }, relations: { profile: true, preference: true } });
    if (!user) throw new NotFoundException("User was not found");

    const verificationRequired = this.verificationRequired();
    const verified = !verificationRequired || user.identityStatus === VerificationStatus.VERIFIED;
    const controls = await this.controls();
    const weekStartedAt = this.startOfWeek(new Date());
    const resetAt = new Date(weekStartedAt);
    resetAt.setUTCDate(resetAt.getUTCDate() + 7);
    const [suggestions, usedThisWeek, unreadNotifications] = await Promise.all([
      verified && controls.matching ? this.suggestions(userId, controls.weeklyLimit) : Promise.resolve([]),
      this.matches.createQueryBuilder("match")
        .where("(match.userAId = :userId OR match.userBId = :userId)", { userId })
        .andWhere("match.updatedAt >= :weekStartedAt", { weekStartedAt })
        .getCount(),
      this.notifications.count({ where: { userId, readAt: IsNull() } }),
    ]);

    const weeklyLimit = controls.weeklyLimit;
    return {
      user,
      verified,
      verificationRequired,
      matchingEnabled: controls.matching,
      profileCompletion: this.profileCompletion(user),
      weekly: {
        limit: weeklyLimit,
        used: Math.min(usedThisWeek, weeklyLimit),
        remaining: Math.max(0, weeklyLimit - usedThisWeek),
        resetAt,
      },
      unreadNotifications,
      suggestions: suggestions.map((candidate) => ({
        ...candidate,
        dashboard: this.candidateContext(user, candidate),
      })),
    };
  }

  async suggestions(userId: string, limit = 20) {
    const me = await this.users.findOne({ where: { id: userId }, relations: { profile: true, preference: true } });
    if (!me) throw new NotFoundException("User was not found");
    this.requireVerified(me);
    if (!(await this.controls()).matching) throw new ForbiddenException("Matching is temporarily paused");

    const blockedRows = await this.blocks.createQueryBuilder("block")
      .where("block.blockerId = :userId OR block.blockedId = :userId", { userId })
      .getMany();
    const excluded = new Set([userId]);
    blockedRows.forEach((row) => excluded.add(row.blockerId === userId ? row.blockedId : row.blockerId));
    const existing = await this.matches.createQueryBuilder("match")
      .where("match.userAId = :userId OR match.userBId = :userId", { userId })
      .getMany();
    existing.forEach((row) => {
      if (this.shouldExcludeExistingMatch(row, userId)) {
        excluded.add(row.userAId === userId ? row.userBId : row.userAId);
      }
    });

    const query = this.users.createQueryBuilder("user")
      .leftJoinAndSelect("user.profile", "profile")
      .where("user.status = :status", { status: UserStatus.ACTIVE })
      .andWhere("user.role = :role", { role: UserRole.MEMBER })
      .andWhere("user.id NOT IN (:...excluded)", { excluded: [...excluded] })
      .take(Math.min(Math.max(limit, 1), 50));
    if (this.verificationRequired()) query.andWhere("user.identityStatus = :verification", { verification: VerificationStatus.VERIFIED });
    if (me.preference?.minAge) query.andWhere("profile.age >= :minAge", { minAge: me.preference.minAge });
    if (me.preference?.maxAge) query.andWhere("profile.age <= :maxAge", { maxAge: me.preference.maxAge });
    if (me.preference?.location) query.andWhere("LOWER(profile.city) = LOWER(:location)", { location: me.preference.location });
    return query.getMany();
  }

  async list(userId: string) {
    return this.matches.createQueryBuilder("match")
      .leftJoinAndSelect("match.userA", "userA")
      .leftJoinAndSelect("userA.profile", "profileA")
      .leftJoinAndSelect("match.userB", "userB")
      .leftJoinAndSelect("userB.profile", "profileB")
      .where(new Brackets((query) => query.where("match.userAId = :userId", { userId }).orWhere("match.userBId = :userId", { userId })))
      .andWhere("match.status = :status", { status: MatchStatus.MATCHED })
      .orderBy("match.updatedAt", "DESC")
      .getMany();
  }

  async like(userId: string, targetId: string) {
    if (userId === targetId) throw new BadRequestException("You cannot match with yourself");
    const [member, targetExists] = await Promise.all([
      this.users.findOneBy({ id: userId }),
      this.users.findOneBy({ id: targetId, role: UserRole.MEMBER, status: UserStatus.ACTIVE }),
    ]);
    if (!member) throw new NotFoundException("User was not found");
    this.requireVerified(member);
    if (!(await this.controls()).matching) throw new ForbiddenException("Matching is temporarily paused");
    if (!targetExists || (this.verificationRequired() && targetExists.identityStatus !== VerificationStatus.VERIFIED)) throw new NotFoundException("Member was not found");
    if (await this.blocks.exists({ where: [{ blockerId: userId, blockedId: targetId }, { blockerId: targetId, blockedId: userId }] })) {
      throw new BadRequestException("This member is unavailable");
    }
    const [userAId, userBId] = [userId, targetId].sort();
    return this.matches.manager.transaction(async (manager) => {
      let match = await manager.findOne(Match, { where: { userAId, userBId } });
      match ??= manager.create(Match, { userAId, userBId, likedByA: false, likedByB: false });
      if (userId === userAId) match.likedByA = true;
      else match.likedByB = true;
      if (match.likedByA && match.likedByB) {
        match.status = MatchStatus.MATCHED;
        const existingConversation = await manager.findOne(Conversation, { where: { userAId, userBId } });
        if (!existingConversation) await manager.save(Conversation, manager.create(Conversation, { userAId, userBId }));
        await manager.save(Notification, [
          manager.create(Notification, { userId: userAId, type: "match", title: "It’s a match", body: "You have a new mutual match.", data: { memberId: userBId } }),
          manager.create(Notification, { userId: userBId, type: "match", title: "It’s a match", body: "You have a new mutual match.", data: { memberId: userAId } }),
        ]);
      }
      return manager.save(Match, match);
    });
  }

  async pass(userId: string, targetId: string) {
    if (userId === targetId) throw new BadRequestException("You cannot pass on yourself");
    const member = await this.users.findOneBy({ id: userId });
    if (!member) throw new NotFoundException("User was not found");
    this.requireVerified(member);
    if (!(await this.controls()).matching) throw new ForbiddenException("Matching is temporarily paused");
    const [userAId, userBId] = [userId, targetId].sort();
    let match = await this.matches.findOneBy({ userAId, userBId });
    match ??= this.matches.create({ userAId, userBId });
    match.status = MatchStatus.PASSED;
    return this.matches.save(match);
  }

  private requireVerified(user: User) {
    if (this.verificationRequired() && user.identityStatus !== VerificationStatus.VERIFIED) {
      throw new ForbiddenException("Complete identity verification to access Discover");
    }
  }

  private verificationRequired() {
    return this.config?.get<string>("IDENTITY_VERIFICATION_REQUIRED") === "true";
  }

  private controls() {
    return this.platform?.controls() ?? Promise.resolve({ matching: true, maintenance: false, weeklyLimit: 5 });
  }

  private shouldExcludeExistingMatch(match: Match, userId: string) {
    if (match.status !== MatchStatus.SUGGESTED) return true;
    return match.userAId === userId ? match.likedByA : match.likedByB;
  }

  private profileCompletion(user: User) {
    const profile = user.profile;
    const preference = user.preference;
    const checks = [
      user.name,
      profile?.age,
      profile?.bio,
      profile?.city,
      profile?.church,
      profile?.intention,
      profile?.denomination,
      profile?.photos?.length,
      profile?.interests?.length,
      preference?.minAge && preference?.maxAge,
      preference?.location,
    ];
    const completed = checks.filter(Boolean).length;
    return Math.round((completed / checks.length) * 100);
  }

  private candidateContext(user: User, candidate: User) {
    const mine = user.profile;
    const theirs = candidate.profile;
    const sharedInterests = (mine?.interests ?? []).filter((interest) => theirs?.interests?.includes(interest));
    const sameDenomination = Boolean(mine?.denomination && mine.denomination === theirs?.denomination);
    const sameChurch = Boolean(mine?.church && mine.church === theirs?.church);
    const sameCity = Boolean(mine?.city && mine.city === theirs?.city);
    const compatibility = Math.min(99, 60 + sharedInterests.length * 5 + (sameDenomination ? 12 : 0) + (sameChurch ? 12 : 0) + (sameCity ? 8 : 0));
    const sharedValues = [
      ...(sameDenomination ? ["Faith"] : []),
      ...(sameChurch ? ["Church community"] : []),
      ...sharedInterests,
    ].slice(0, 3);
    return {
      compatibility,
      sharedValues,
      badges: [sameDenomination ? "Same denomination" : null, sameChurch ? "Attends same church" : null, sameCity ? "Same city" : null].filter(Boolean),
    };
  }

  private startOfWeek(date: Date) {
    const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const day = start.getUTCDay() || 7;
    start.setUTCDate(start.getUTCDate() - day + 1);
    return start;
  }
}

import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Brackets, Repository } from "typeorm";
import { Block, Conversation, Match, MatchStatus, Notification, User, UserStatus, VerificationStatus } from "../database/entities";

@Injectable()
export class MatchesService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Match) private readonly matches: Repository<Match>,
    @InjectRepository(Block) private readonly blocks: Repository<Block>,
  ) {}

  async suggestions(userId: string, limit = 20) {
    const me = await this.users.findOne({ where: { id: userId }, relations: { profile: true, preference: true } });
    if (!me) throw new NotFoundException("User was not found");
    this.requireVerified(me);

    const blockedRows = await this.blocks.createQueryBuilder("block")
      .where("block.blockerId = :userId OR block.blockedId = :userId", { userId })
      .getMany();
    const excluded = new Set([userId]);
    blockedRows.forEach((row) => excluded.add(row.blockerId === userId ? row.blockedId : row.blockerId));
    const existing = await this.matches.createQueryBuilder("match")
      .where("match.userAId = :userId OR match.userBId = :userId", { userId })
      .getMany();
    existing.forEach((row) => excluded.add(row.userAId === userId ? row.userBId : row.userAId));

    const query = this.users.createQueryBuilder("user")
      .leftJoinAndSelect("user.profile", "profile")
      .where("user.status = :status", { status: UserStatus.ACTIVE })
      .andWhere("user.identityStatus = :verification", { verification: VerificationStatus.VERIFIED })
      .andWhere("user.id NOT IN (:...excluded)", { excluded: [...excluded] })
      .take(Math.min(Math.max(limit, 1), 50));
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
      this.users.exists({ where: { id: targetId, status: UserStatus.ACTIVE } }),
    ]);
    if (!member) throw new NotFoundException("User was not found");
    this.requireVerified(member);
    if (!targetExists) throw new NotFoundException("Member was not found");
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
    const [userAId, userBId] = [userId, targetId].sort();
    let match = await this.matches.findOneBy({ userAId, userBId });
    match ??= this.matches.create({ userAId, userBId });
    match.status = MatchStatus.PASSED;
    return this.matches.save(match);
  }

  private requireVerified(user: User) {
    if (user.identityStatus !== VerificationStatus.VERIFIED) {
      throw new ForbiddenException("Complete identity verification to access Discover");
    }
  }
}

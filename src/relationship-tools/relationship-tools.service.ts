import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Brackets, Repository } from "typeorm";
import { Match, MatchStatus, Notification, RelationshipToolState } from "../database/entities";
import { SaveReflectionDto, SetDevotionalDayDto, ToggleTopicDto } from "./dto/relationship-tools.dto";

@Injectable()
export class RelationshipToolsService {
  constructor(
    @InjectRepository(Match) private readonly matches: Repository<Match>,
    @InjectRepository(RelationshipToolState) private readonly states: Repository<RelationshipToolState>,
    @InjectRepository(Notification) private readonly notifications: Repository<Notification>,
  ) {}

  async state(userId: string, matchId?: string) {
    const match = await this.resolveMatch(userId, matchId);
    const state = await this.getOrCreateState(match.id);
    return this.view(userId, match, state);
  }

  async saveReflection(userId: string, payload: SaveReflectionDto, matchId?: string) {
    const match = await this.resolveMatch(userId, matchId);
    const state = await this.getOrCreateState(match.id);
    const reflection = { day: payload.day, userId, body: payload.body.trim(), updatedAt: new Date().toISOString() };
    state.reflections = [...state.reflections.filter((item) => item.day !== payload.day || item.userId !== userId), reflection];
    state.devotionalDay = Math.max(state.devotionalDay, payload.day);
    await this.states.save(state);
    const recipientId = match.userAId === userId ? match.userBId : match.userAId;
    await this.notifications.save(this.notifications.create({
      userId: recipientId,
      type: "relationship_tool",
      title: "A reflection was shared",
      body: "Your match shared a devotional reflection with you.",
      data: { matchId: match.id, tool: "devotional", day: payload.day },
    }));
    return this.view(userId, match, state);
  }

  async setDay(userId: string, payload: SetDevotionalDayDto, matchId?: string) {
    const match = await this.resolveMatch(userId, matchId);
    const state = await this.getOrCreateState(match.id);
    state.devotionalDay = payload.day;
    await this.states.save(state);
    return this.view(userId, match, state);
  }

  async toggleTopic(userId: string, payload: ToggleTopicDto, matchId?: string) {
    const match = await this.resolveMatch(userId, matchId);
    const state = await this.getOrCreateState(match.id);
    const topicKey = payload.topicKey.trim();
    const discussed = state.discussedTopics.includes(topicKey);
    state.discussedTopics = discussed ? state.discussedTopics.filter((item) => item !== topicKey) : [...state.discussedTopics, topicKey];
    await this.states.save(state);
    if (!discussed) {
      const recipientId = match.userAId === userId ? match.userBId : match.userAId;
      await this.notifications.save(this.notifications.create({
        userId: recipientId,
        type: "relationship_tool",
        title: "Conversation topic completed",
        body: "Your match marked a guided conversation topic as discussed.",
        data: { matchId: match.id, tool: "conversation-guide", topicKey },
      }));
    }
    return this.view(userId, match, state);
  }

  private async resolveMatch(userId: string, matchId?: string) {
    const query = this.matches.createQueryBuilder("match")
      .leftJoinAndSelect("match.userA", "userA")
      .leftJoinAndSelect("userA.profile", "profileA")
      .leftJoinAndSelect("match.userB", "userB")
      .leftJoinAndSelect("userB.profile", "profileB")
      .where("match.status = :status", { status: MatchStatus.MATCHED })
      .andWhere(new Brackets((builder) => builder.where("match.userAId = :userId", { userId }).orWhere("match.userBId = :userId", { userId })))
      .orderBy("match.updatedAt", "DESC");
    if (matchId) query.andWhere("match.id = :matchId", { matchId });
    const match = await query.getOne();
    if (!match) throw new ForbiddenException("Relationship tools are available after a mutual match");
    return match;
  }

  private async getOrCreateState(matchId: string) {
    let state = await this.states.findOneBy({ matchId });
    state ??= await this.states.save(this.states.create({ matchId, devotionalDay: 0, reflections: [], discussedTopics: [] }));
    return state;
  }

  private view(userId: string, match: Match, state: RelationshipToolState) {
    const member = match.userAId === userId ? match.userB : match.userA;
    if (!member) throw new NotFoundException("Your match could not be loaded");
    return {
      id: state.id,
      matchId: match.id,
      member: { id: member.id, name: member.name, profile: member.profile },
      devotionalDay: state.devotionalDay,
      reflections: state.reflections,
      discussedTopics: state.discussedTopics,
      updatedAt: state.updatedAt,
    };
  }
}

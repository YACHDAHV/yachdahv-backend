import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Brackets, Repository } from "typeorm";
import { Match, MatchStatus, Notification, RelationshipToolState } from "../database/entities";
import { SaveReflectionDto, SaveTopicResponseDto, SetDevotionalDayDto, StartPlanDto, ToggleTopicDto } from "./dto/relationship-tools.dto";
import { DEFAULT_DEVOTIONAL_PLAN } from "./devotional-plans";
import { revealAnswers } from "./reveal";

type MatchSelector = { matchId?: string; memberId?: string };

@Injectable()
export class RelationshipToolsService {
  constructor(
    @InjectRepository(Match) private readonly matches: Repository<Match>,
    @InjectRepository(RelationshipToolState) private readonly states: Repository<RelationshipToolState>,
    @InjectRepository(Notification) private readonly notifications: Repository<Notification>,
  ) {}

  async state(userId: string, selector: MatchSelector = {}) {
    const match = await this.resolveMatch(userId, selector);
    const state = await this.getOrCreateState(match.id);
    return this.view(userId, match, state);
  }

  async saveReflection(userId: string, payload: SaveReflectionDto, selector: MatchSelector = {}) {
    const match = await this.resolveMatch(userId, selector);
    const state = await this.getOrCreateState(match.id);
    const planId = payload.planId ?? DEFAULT_DEVOTIONAL_PLAN;
    const reflection = { planId, day: payload.day, userId, body: payload.body.trim(), updatedAt: new Date().toISOString() };
    state.reflections = [...state.reflections.filter((item) => (item.planId ?? DEFAULT_DEVOTIONAL_PLAN) !== planId || item.day !== payload.day || item.userId !== userId), reflection];
    state.devotionalDay = Math.max(state.devotionalDay, payload.day);
    if (!(state.devotionalPlans ?? []).some((plan) => plan.planId === planId)) state.devotionalPlans = [...(state.devotionalPlans ?? []), { planId, startedBy: userId, startedAt: reflection.updatedAt }];
    await this.states.save(state);
    const recipientId = match.userAId === userId ? match.userBId : match.userAId;
    await this.notifications.save(this.notifications.create({
      userId: recipientId,
      type: "relationship_tool",
      title: "A reflection was shared",
      body: "Your match shared a devotional reflection with you.",
      data: { matchId: match.id, tool: "devotional", planId, day: payload.day },
    }));
    return this.view(userId, match, state);
  }

  async setDay(userId: string, payload: SetDevotionalDayDto, selector: MatchSelector = {}) {
    const match = await this.resolveMatch(userId, selector);
    const state = await this.getOrCreateState(match.id);
    state.devotionalDay = payload.day;
    await this.states.save(state);
    return this.view(userId, match, state);
  }

  async toggleTopic(userId: string, payload: ToggleTopicDto, selector: MatchSelector = {}) {
    const match = await this.resolveMatch(userId, selector);
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

  async startPlan(userId: string, payload: StartPlanDto, selector: MatchSelector = {}) {
    const match = await this.resolveMatch(userId, selector);
    const state = await this.getOrCreateState(match.id);
    if (!(state.devotionalPlans ?? []).some((plan) => plan.planId === payload.planId)) {
      state.devotionalPlans = [...(state.devotionalPlans ?? []), { planId: payload.planId, startedBy: userId, startedAt: new Date().toISOString() }];
      await this.states.save(state);
      const recipientId = match.userAId === userId ? match.userBId : match.userAId;
      await this.notifications.save(this.notifications.create({
        userId: recipientId,
        type: "relationship_tool",
        title: "You're invited to a devotional",
        body: "Your match started a 7-day shared devotional. Join them and reflect together.",
        data: { matchId: match.id, tool: "devotional", planId: payload.planId },
      }));
    }
    return this.view(userId, match, state);
  }

  async saveTopicResponse(userId: string, payload: SaveTopicResponseDto, selector: MatchSelector = {}) {
    const match = await this.resolveMatch(userId, selector);
    const state = await this.getOrCreateState(match.id);
    const topicKey = payload.topicKey.trim();
    const response = { topicKey, userId, body: payload.body.trim(), updatedAt: new Date().toISOString() };
    const isFirstAnswer = !(state.topicResponses ?? []).some((item) => item.topicKey === topicKey && item.userId === userId);
    state.topicResponses = [...(state.topicResponses ?? []).filter((item) => item.topicKey !== topicKey || item.userId !== userId), response];
    await this.states.save(state);
    if (isFirstAnswer) {
      const recipientId = match.userAId === userId ? match.userBId : match.userAId;
      await this.notifications.save(this.notifications.create({
        userId: recipientId,
        type: "relationship_tool",
        title: "New guided conversation answer",
        body: "Your match answered a guided conversation question. Add yours to see what they said.",
        data: { matchId: match.id, tool: "conversation-guide", topicKey },
      }));
    }
    return this.view(userId, match, state);
  }

  private async resolveMatch(userId: string, { matchId, memberId }: MatchSelector) {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if ((matchId && !uuid.test(matchId)) || (memberId && !uuid.test(memberId))) throw new BadRequestException("Invalid match reference");
    const query = this.matches.createQueryBuilder("match")
      .leftJoinAndSelect("match.userA", "userA")
      .leftJoinAndSelect("userA.profile", "profileA")
      .leftJoinAndSelect("match.userB", "userB")
      .leftJoinAndSelect("userB.profile", "profileB")
      .where("match.status = :status", { status: MatchStatus.MATCHED })
      .andWhere(new Brackets((builder) => builder.where("match.userAId = :userId", { userId }).orWhere("match.userBId = :userId", { userId })))
      .orderBy("match.updatedAt", "DESC");
    if (matchId) query.andWhere("match.id = :matchId", { matchId });
    if (memberId) query.andWhere("(match.userAId = :memberId OR match.userBId = :memberId)", { memberId });
    const match = await query.getOne();
    if (!match) throw new ForbiddenException("Relationship tools are available after a mutual match");
    const me = match.userAId === userId ? match.userA : match.userB;
    if (!me?.sensitiveDataConsentAt) throw new ForbiddenException("Give consent to process your faith and relationship data to use relationship tools");
    return match;
  }

  private async getOrCreateState(matchId: string) {
    let state = await this.states.findOneBy({ matchId });
    state ??= await this.states.save(this.states.create({ matchId, devotionalDay: 0, reflections: [], devotionalPlans: [], discussedTopics: [], topicResponses: [] }));
    return state;
  }

  private view(userId: string, match: Match, state: RelationshipToolState) {
    const member = match.userAId === userId ? match.userB : match.userA;
    if (!member) throw new NotFoundException("Your match could not be loaded");
    return {
      id: state.id,
      matchId: match.id,
      member: { id: member.id, name: member.name, profile: member.profile },
      matchedAt: match.updatedAt,
      devotionalDay: state.devotionalDay,
      devotionalPlans: state.devotionalPlans ?? [],
      reflections: revealAnswers((state.reflections ?? []).map((item) => ({ ...item, planId: item.planId ?? DEFAULT_DEVOTIONAL_PLAN })), userId, (item) => `${item.planId}:${item.day}`),
      discussedTopics: state.discussedTopics,
      topicResponses: revealAnswers(state.topicResponses ?? [], userId, (item) => item.topicKey),
      updatedAt: state.updatedAt,
    };
  }
}

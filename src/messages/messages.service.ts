import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Brackets, Repository } from "typeorm";
import { Block, Conversation, Match, MatchStatus, Message, Notification } from "../database/entities";

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Conversation) private readonly conversations: Repository<Conversation>,
    @InjectRepository(Message) private readonly messages: Repository<Message>,
    @InjectRepository(Match) private readonly matches: Repository<Match>,
    @InjectRepository(Block) private readonly blocks: Repository<Block>,
    @InjectRepository(Notification) private readonly notifications: Repository<Notification>,
  ) {}

  async listConversations(userId: string) {
    return this.conversations.createQueryBuilder("conversation")
      .leftJoinAndSelect("conversation.userA", "userA")
      .leftJoinAndSelect("userA.profile", "profileA")
      .leftJoinAndSelect("conversation.userB", "userB")
      .leftJoinAndSelect("userB.profile", "profileB")
      .leftJoinAndMapOne("conversation.latestMessage", "messages", "latest", "latest.id = (SELECT id FROM messages WHERE conversation_id = conversation.id ORDER BY created_at DESC LIMIT 1)")
      .where("conversation.userAId = :userId OR conversation.userBId = :userId", { userId })
      .orderBy("conversation.updatedAt", "DESC")
      .getMany();
  }

  async createConversation(userId: string, memberId: string) {
    const [userAId, userBId] = [userId, memberId].sort();
    const match = await this.matches.findOneBy({ userAId, userBId, status: MatchStatus.MATCHED });
    if (!match) throw new ForbiddenException("Messaging is available after a mutual match");
    let conversation = await this.conversations.findOneBy({ userAId, userBId });
    conversation ??= await this.conversations.save(this.conversations.create({ userAId, userBId }));
    return conversation;
  }

  async listMessages(userId: string, conversationId: string) {
    await this.assertMember(userId, conversationId);
    return this.messages.find({ where: { conversationId }, order: { createdAt: "ASC" }, relations: { sender: true } });
  }

  async send(userId: string, conversationId: string, body: string) {
    const conversation = await this.assertMember(userId, conversationId);
    const recipientId = conversation.userAId === userId ? conversation.userBId : conversation.userAId;
    if (await this.blocks.exists({ where: [{ blockerId: userId, blockedId: recipientId }, { blockerId: recipientId, blockedId: userId }] })) {
      throw new ForbiddenException("Messaging is unavailable");
    }
    const message = await this.messages.save(this.messages.create({ conversationId, senderId: userId, body: body.trim(), readAt: null }));
    await this.conversations.update(conversationId, { updatedAt: new Date() });
    await this.notifications.save(this.notifications.create({
      userId: recipientId,
      type: "message",
      title: "New message",
      body: body.trim().slice(0, 120),
      data: { conversationId, senderId: userId },
    }));
    return message;
  }

  async markRead(userId: string, conversationId: string) {
    await this.assertMember(userId, conversationId);
    const readAt = new Date();
    await this.messages.createQueryBuilder().update(Message).set({ readAt })
      .where("conversation_id = :conversationId", { conversationId })
      .andWhere("sender_id != :userId", { userId })
      .andWhere("read_at IS NULL")
      .execute();
    return { success: true, readAt };
  }

  async participantIds(conversationId: string) {
    const conversation = await this.conversations.findOneBy({ id: conversationId });
    if (!conversation) throw new NotFoundException("Conversation was not found");
    return [conversation.userAId, conversation.userBId];
  }

  async assertConversationMember(userId: string, conversationId: string) {
    return this.assertMember(userId, conversationId);
  }

  private async assertMember(userId: string, conversationId: string) {
    const conversation = await this.conversations.createQueryBuilder("conversation")
      .where("conversation.id = :conversationId", { conversationId })
      .andWhere(new Brackets((query) => query.where("conversation.userAId = :userId", { userId }).orWhere("conversation.userBId = :userId", { userId })))
      .getOne();
    if (!conversation) throw new NotFoundException("Conversation was not found");
    return conversation;
  }
}

import { MessagesService } from "./messages.service";

describe("message notifications", () => {
  it("creates one in-app notification for the recipient, replacing any unread one for the chat", async () => {
    const conversation = { id: "conv-1", userAId: "alice", userBId: "bola" };
    const queryBuilder = { where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(), getOne: jest.fn().mockResolvedValue(conversation) };
    const conversations = { createQueryBuilder: jest.fn().mockReturnValue(queryBuilder), update: jest.fn() };
    const messages = { create: jest.fn((value) => value), save: jest.fn(async (value) => ({ id: "msg-1", ...value })) };
    const blocks = { exists: jest.fn().mockResolvedValue(false) };
    const users = { findOneBy: jest.fn(async ({ id }) => ({ id, name: id === "alice" ? "Alice" : "Bola", email: null })) };
    const deleteBuilder = { delete: jest.fn().mockReturnThis(), from: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(), execute: jest.fn() };
    const notifications = { createQueryBuilder: jest.fn().mockReturnValue(deleteBuilder), create: jest.fn((value) => value), save: jest.fn() };
    const service = new MessagesService(conversations as never, messages as never, {} as never, blocks as never, users as never, notifications as never, {} as never);

    await service.send("alice", "conv-1", "Hello there!");
    await new Promise((resolve) => setImmediate(resolve));

    expect(deleteBuilder.execute).toHaveBeenCalled();
    expect(notifications.save).toHaveBeenCalledWith(expect.objectContaining({
      userId: "bola",
      type: "message",
      title: "New message from Alice",
      body: "Hello there!",
      data: { conversationId: "conv-1", memberId: "alice" },
    }));
  });

  it("keeps a valid guided-conversation tag and drops anything else", async () => {
    const conversation = { id: "conv-1", userAId: "alice", userBId: "bola" };
    const queryBuilder = { where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(), getOne: jest.fn().mockResolvedValue(conversation) };
    const messages = { create: jest.fn((value) => value), save: jest.fn(async (value) => ({ id: "msg", ...value })) };
    const service = new MessagesService(
      { createQueryBuilder: jest.fn().mockReturnValue(queryBuilder), update: jest.fn() } as never,
      messages as never, {} as never, { exists: jest.fn().mockResolvedValue(false) } as never,
      { findOneBy: jest.fn().mockResolvedValue(null) } as never,
      { createQueryBuilder: jest.fn().mockReturnValue({ delete: jest.fn().mockReturnThis(), from: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(), execute: jest.fn() }), create: jest.fn(), save: jest.fn() } as never,
      {} as never,
    );
    const tagged = await service.send("alice", "conv-1", "Q?", { kind: "guided-question", topicKey: "fun:q1" });
    const junk = await service.send("alice", "conv-1", "Hi", { kind: "<script>", topicKey: "x" });
    expect(tagged.meta).toEqual({ kind: "guided-question", topicKey: "fun:q1" });
    expect(junk.meta).toBeNull();
  });

  it("keeps a reply only when it points at a message in the same conversation", async () => {
    const conversation = { id: "conv-1", userAId: "alice", userBId: "bola" };
    const queryBuilder = { where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(), getOne: jest.fn().mockResolvedValue(conversation) };
    const existing = "6f1c2b8e-1d7a-4a63-9a3e-2f0d5b7c9e11";
    const messages = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ id: "msg", ...value })),
      exists: jest.fn(async ({ where }) => where.id === existing && where.conversationId === "conv-1"),
    };
    const service = new MessagesService(
      { createQueryBuilder: jest.fn().mockReturnValue(queryBuilder), update: jest.fn() } as never,
      messages as never, {} as never, { exists: jest.fn().mockResolvedValue(false) } as never,
      { findOneBy: jest.fn().mockResolvedValue(null) } as never,
      { createQueryBuilder: jest.fn().mockReturnValue({ delete: jest.fn().mockReturnThis(), from: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(), execute: jest.fn() }), create: jest.fn(), save: jest.fn() } as never,
      {} as never,
    );
    const reply = await service.send("alice", "conv-1", "Agreed", { kind: "reply", replyToId: existing });
    const elsewhere = await service.send("alice", "conv-1", "Hm", { kind: "reply", replyToId: "0b6a3c55-7f62-4c1e-8d2f-91a4e6b3c7d0" });
    const malformed = await service.send("alice", "conv-1", "Hm", { kind: "reply", replyToId: "not-a-uuid" });
    expect(reply.meta).toEqual({ kind: "reply", replyToId: existing });
    expect(elsewhere.meta).toBeNull();
    expect(malformed.meta).toBeNull();
  });
});

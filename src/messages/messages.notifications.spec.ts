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
});

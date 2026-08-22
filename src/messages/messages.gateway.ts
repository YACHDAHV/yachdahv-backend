import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import {
  Ack,
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { isUUID } from "class-validator";
import { Server, Socket } from "socket.io";
import { AuthenticatedUser } from "../auth/auth.types";
import { Message } from "../database/entities";
import { MessagesService } from "./messages.service";

type ChatSocket = Socket & { data: { user?: AuthenticatedUser } };
type Acknowledge = (result: { ok: true; message?: Message } | { ok: false; error: string }) => void;

@WebSocketGateway({
  namespace: "/chat",
  cors: {
    origin: process.env.FRONTEND_ORIGIN?.split(",") ?? ["http://localhost:3000"],
    credentials: true,
  },
})
export class MessagesGateway implements OnGatewayConnection {
  @WebSocketServer()
  private server!: Server;

  private readonly logger = new Logger(MessagesGateway.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly messages: MessagesService,
  ) {}

  async handleConnection(client: ChatSocket) {
    const authorization = client.handshake.headers.authorization;
    const bearerToken = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
    const token = typeof client.handshake.auth?.token === "string" ? client.handshake.auth.token : bearerToken;

    try {
      if (!token) throw new Error("Missing access token");
      const payload = await this.jwt.verifyAsync<AuthenticatedUser & { exp?: number }>(token, {
        secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
      });
      if (payload.type !== "access") throw new Error("Invalid access token");

      client.data.user = payload;
      await client.join(this.userRoom(payload.sub));

      if (payload.exp) {
        const expiresIn = payload.exp * 1000 - Date.now();
        const expiryTimer = setTimeout(() => {
          client.emit("auth:expired");
          client.disconnect(true);
        }, Math.max(expiresIn, 0));
        client.once("disconnect", () => clearTimeout(expiryTimer));
      }
    } catch {
      client.emit("chat:error", { message: "Invalid or expired access token" });
      client.disconnect(true);
    }
  }

  @SubscribeMessage("conversation:join")
  async joinConversation(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody() payload: { conversationId?: string },
    @Ack() acknowledge?: Acknowledge,
  ) {
    try {
      const userId = this.userId(client);
      const conversationId = this.conversationId(payload);
      await this.messages.assertConversationMember(userId, conversationId);
      await client.join(this.conversationRoom(conversationId));
      acknowledge?.({ ok: true });
    } catch (error) {
      acknowledge?.({ ok: false, error: this.errorMessage(error) });
    }
  }

  @SubscribeMessage("message:send")
  async sendMessage(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody() payload: { conversationId?: string; body?: string },
    @Ack() acknowledge?: Acknowledge,
  ) {
    try {
      const userId = this.userId(client);
      const conversationId = this.conversationId(payload);
      const body = typeof payload?.body === "string" ? payload.body.trim() : "";
      if (!body || body.length > 2000) throw new Error("Message must be between 1 and 2000 characters");

      const message = await this.messages.send(userId, conversationId, body);
      await this.publishMessage(message);
      acknowledge?.({ ok: true, message });
    } catch (error) {
      acknowledge?.({ ok: false, error: this.errorMessage(error) });
    }
  }

  @SubscribeMessage("conversation:read")
  async readConversation(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody() payload: { conversationId?: string },
    @Ack() acknowledge?: Acknowledge,
  ) {
    try {
      const userId = this.userId(client);
      const conversationId = this.conversationId(payload);
      const result = await this.messages.markRead(userId, conversationId);
      client.to(this.conversationRoom(conversationId)).emit("conversation:read", {
        conversationId,
        readBy: userId,
        readAt: result.readAt,
      });
      acknowledge?.({ ok: true });
    } catch (error) {
      acknowledge?.({ ok: false, error: this.errorMessage(error) });
    }
  }

  async publishMessage(message: Message) {
    const [userAId, userBId] = await this.messages.participantIds(message.conversationId);
    this.server.to(this.userRoom(userAId)).to(this.userRoom(userBId)).emit("message:new", message);
  }

  private userId(client: ChatSocket) {
    if (!client.data.user?.sub) throw new Error("Authentication is required");
    return client.data.user.sub;
  }

  private conversationId(payload: { conversationId?: string }) {
    if (!payload?.conversationId || !isUUID(payload.conversationId)) throw new Error("A valid conversation is required");
    return payload.conversationId;
  }

  private errorMessage(error: unknown) {
    const response = typeof error === "object" && error && "getResponse" in error
      ? (error as { getResponse(): unknown }).getResponse()
      : null;
    if (typeof response === "object" && response && "message" in response) {
      const message = (response as { message: unknown }).message;
      if (typeof message === "string") return message;
    }
    if (error instanceof Error) return error.message;
    this.logger.warn("An unknown chat socket error occurred");
    return "Chat request failed";
  }

  private userRoom(userId: string) { return `user:${userId}`; }
  private conversationRoom(conversationId: string) { return `conversation:${conversationId}`; }
}

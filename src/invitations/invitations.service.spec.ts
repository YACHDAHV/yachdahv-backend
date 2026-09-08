import { ConfigService } from "@nestjs/config";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { Church, WaitlistInvite, WaitlistInviteStatus } from "../database/entities";
import { normalizeInviteCode, ValidateWaitlistInviteDto } from "./dto/invitation.dto";
import { InvitationsService } from "./invitations.service";

describe("waitlist invitations", () => {
  const config = {
    get: jest.fn().mockReturnValue("dedicated-invitation-secret-at-least-32-characters"),
    getOrThrow: jest.fn().mockReturnValue("fallback-secret"),
  } as unknown as ConfigService;
  const service = new InvitationsService({} as never, {} as never, {} as never, config, {} as never);
  const internals = service as unknown as {
    generateCode(): string;
    hashCode(code: string): string;
    view(invite: Record<string, unknown>): Record<string, unknown>;
  };

  it("generates high-entropy user-friendly codes without ambiguous characters", () => {
    const codes = new Set(Array.from({ length: 200 }, () => internals.generateCode()));
    expect(codes.size).toBe(200);
    for (const code of codes) expect(code).toMatch(/^YDV-[23456789A-HJ-NP-Z]{4}-[23456789A-HJ-NP-Z]{4}-[23456789A-HJ-NP-Z]{4}$/);
  });

  it("normalizes formatting before producing a non-reversible stored value", () => {
    const code = internals.generateCode();
    expect(internals.hashCode(code)).toHaveLength(64);
    expect(internals.hashCode(code)).not.toContain(code);
    expect(internals.hashCode(code)).toBe(internals.hashCode(code.toLowerCase().replaceAll("-", " ")));
    expect(internals.hashCode(code)).toBe(internals.hashCode(code.split("").join(" ")));
  });

  it("extracts a pasted invitation code from spaced or wrapped email text", () => {
    expect(normalizeInviteCode("Y D V - 2 3 4 5 - 6 7 8 9 - A B C D")).toBe("YDV-2345-6789-ABCD");
    expect(normalizeInviteCode("Your code is YDV-2345-6789-ABCD, thanks")).toBe("YDV-2345-6789-ABCD");
  });

  it("accepts a letter-spaced paste after DTO transformation", async () => {
    const payload = plainToInstance(ValidateWaitlistInviteDto, {
      churchId: "632b3952-5664-4d93-b6fd-ddd87cfdb196",
      code: "Y D V - 2 3 4 5 - 6 7 8 9 - A B C D extra",
    });
    expect(payload.code).toBe("YDV-2345-6789-ABCD");
    expect(await validate(payload)).toHaveLength(0);
  });

  it("never exposes the code hash in an administrator response", () => {
    const response = internals.view({
      id: "invite", email: "member@example.com", churchId: null, church: null,
      codeHash: "secret-hash", codeHint: "YDV-••••-••••-ABCD", status: WaitlistInviteStatus.PENDING,
      expiresAt: new Date(Date.now() + 60_000), sentAt: new Date(), redeemedById: null,
      redeemedAt: null, createdAt: new Date(),
    });
    expect(response).not.toHaveProperty("codeHash");
    expect(response).not.toHaveProperty("code");
    expect(response).toHaveProperty("codeHint", "YDV-••••-••••-ABCD");
  });

  it("binds validation to the verified account email and selected church", async () => {
    const church = { id: "632b3952-5664-4d93-b6fd-ddd87cfdb196", name: "Test Church", active: true };
    const invite = { id: "invite", email: "member@example.com", churchId: church.id, church, status: WaitlistInviteStatus.PENDING, expiresAt: new Date(Date.now() + 60_000) };
    const query = {
      leftJoinAndSelect: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(), setLock: jest.fn().mockReturnThis(), getOne: jest.fn().mockResolvedValue(invite),
    };
    const manager = {
      getRepository: jest.fn((entity) => entity === WaitlistInvite ? { createQueryBuilder: () => query } : { findOneBy: jest.fn().mockResolvedValue(church) }),
    };
    const users = { findOneBy: jest.fn().mockResolvedValue({ id: "user", email: "member@example.com", emailVerified: true }) };
    const validated = new InvitationsService({} as never, { manager } as never, users as never, config, {} as never);

    await expect(validated.validateForUser("user", { churchId: church.id, code: "YDV-2345-6789-ABCD" })).resolves.toMatchObject({ valid: true, church });
    expect(query.andWhere).toHaveBeenCalledWith("LOWER(invite.email) = LOWER(:email)", { email: "member@example.com" });
    expect(manager.getRepository).toHaveBeenCalledWith(Church);
  });
});

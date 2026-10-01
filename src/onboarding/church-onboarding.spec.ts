import { BadRequestException } from "@nestjs/common";
import { OnboardingService } from "./onboarding.service";

describe("onboarding without an invitation code", () => {
  function setup(required: boolean) {
    const saved: Record<string, unknown>[] = [];
    const manager = {
      save: jest.fn(async (_entity: unknown, value: Record<string, unknown>) => { saved.push(value); return value; }),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((_entity: unknown, value: Record<string, unknown>) => ({ ...value })),
      findOneOrFail: jest.fn().mockResolvedValue({ id: "member", name: "Ada" }),
    };
    const user = { id: "member", name: "Ada", email: "ada@example.com", emailVerified: true, sensitiveDataConsentAt: new Date() };
    const users = { findOneBy: jest.fn().mockResolvedValue(user), manager: { transaction: jest.fn((work: (m: typeof manager) => unknown) => work(manager)) } };
    const invitations = {
      inviteCodeRequired: jest.fn().mockReturnValue(required),
      consumeForUser: jest.fn(),
      resolveChurchChoice: jest.fn().mockResolvedValue({ id: "church-1", name: "Grace Assembly", active: false }),
    };
    const service = new OnboardingService(users as never, {} as never, {} as never, undefined, invitations as never);
    const payload = { age: 27, gender: "Female", bio: "Faith first.", church: "Grace Assembly" };
    return { service, invitations, saved, payload };
  }

  it("joins with just a church while codes are paused", async () => {
    const { service, invitations, saved, payload } = setup(false);
    await service.completeForUser("member", payload);
    expect(invitations.resolveChurchChoice).toHaveBeenCalledWith({ churchName: "Grace Assembly" }, expect.anything(), true);
    expect(invitations.consumeForUser).not.toHaveBeenCalled();
    expect(saved).toContainEqual(expect.objectContaining({ church: "Grace Assembly", churchId: "church-1" }));
  });

  it("still requires a code when INVITE_CODE_REQUIRED is on", async () => {
    const { service, payload } = setup(true);
    await expect(service.completeForUser("member", payload)).rejects.toThrow(new BadRequestException("Invitation code is required"));
  });
});

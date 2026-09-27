import { ForbiddenException } from "@nestjs/common";
import { MatchesService } from "../matches/matches.service";
import { VerificationStatus } from "../database/entities";
import { PRIVACY_POLICY_VERSION } from "./consent";
import { UsersService } from "./users.service";

describe("NDPA consent", () => {
  function usersService(user: Record<string, unknown>) {
    const users = { findOneBy: jest.fn().mockResolvedValue(user), save: jest.fn(), findOne: jest.fn().mockResolvedValue(user) };
    const consents = { create: jest.fn((value) => value), save: jest.fn() };
    return { service: new UsersService(users as never, {} as never, {} as never, consents as never), users, consents };
  }

  it("records a grant with the policy version and sets the current state", async () => {
    const user: Record<string, unknown> = { id: "u1", sensitiveDataConsentAt: null };
    const { service, consents } = usersService(user);
    await service.recordConsent("u1", { type: "sensitive_data", granted: true }, { ipAddress: "1.2.3.4", userAgent: "jest" });
    expect(consents.save).toHaveBeenCalledWith(expect.objectContaining({ userId: "u1", type: "sensitive_data", granted: true, policyVersion: PRIVACY_POLICY_VERSION, ipAddress: "1.2.3.4" }));
    expect(user.sensitiveDataConsentAt).toBeInstanceOf(Date);
    expect(user.consentPolicyVersion).toBe(PRIVACY_POLICY_VERSION);
  });

  it("records a withdrawal and clears the current state", async () => {
    const user: Record<string, unknown> = { id: "u1", biometricConsentAt: new Date() };
    const { service, consents } = usersService(user);
    await service.recordConsent("u1", { type: "biometric", granted: false });
    expect(consents.save).toHaveBeenCalledWith(expect.objectContaining({ type: "biometric", granted: false }));
    expect(user.biometricConsentAt).toBeNull();
  });

  it("does not let a member who has not consented send match invites", async () => {
    const users = {
      findOne: jest.fn()
        .mockResolvedValueOnce({ id: "man", identityStatus: VerificationStatus.VERIFIED, sensitiveDataConsentAt: null, profile: { gender: "Male" } })
        .mockResolvedValueOnce({ id: "woman", identityStatus: VerificationStatus.VERIFIED, sensitiveDataConsentAt: new Date(), profile: { gender: "Female" } }),
    };
    const service = new MatchesService(users as never, {} as never, { exists: jest.fn() } as never, {} as never, {} as never, { get: jest.fn().mockReturnValue("false") } as never);
    await expect(service.like("man", "woman")).rejects.toBeInstanceOf(ForbiddenException);
  });
});

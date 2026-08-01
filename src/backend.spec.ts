import { BadRequestException, ForbiddenException, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { validate } from "class-validator";
import { RegisterDto, ResetPasswordDto } from "./auth/dto/auth.dto";
import { MatchStatus, VerificationStatus } from "./database/entities";
import { MatchesService } from "./matches/matches.service";
import { EmailService } from "./email/email.service";
import { OnboardingService } from "./onboarding/onboarding.service";
import { StorageService } from "./storage/storage.service";
import { UsersService } from "./users/users.service";

describe("backend domain rules", () => {
  it("does not allow a member to match with themselves", async () => {
    const service = new MatchesService({} as never, {} as never, {} as never);
    await expect(service.like("same-user", "same-user")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("does not expose Discover suggestions to unverified members", async () => {
    const users = {
      findOne: jest.fn().mockResolvedValue({
        id: "member",
        identityStatus: VerificationStatus.NOT_STARTED,
      }),
    };
    const service = new MatchesService(users as never, {} as never, {} as never);
    await expect(service.suggestions("member")).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("keeps an inbound like discoverable so the second member can match back", () => {
    const service = new MatchesService({} as never, {} as never, {} as never);
    const inboundLike = {
      userAId: "first-member",
      userBId: "second-member",
      likedByA: true,
      likedByB: false,
      status: MatchStatus.SUGGESTED,
    };

    expect((service as unknown as { shouldExcludeExistingMatch(match: typeof inboundLike, userId: string): boolean })
      .shouldExcludeExistingMatch(inboundLike, "second-member")).toBe(false);
    expect((service as unknown as { shouldExcludeExistingMatch(match: typeof inboundLike, userId: string): boolean })
      .shouldExcludeExistingMatch(inboundLike, "first-member")).toBe(true);
  });

  it.each([
    ["registration", RegisterDto, { name: "Member", email: "member@example.com", password: "alphabetonly" }],
    ["password reset", ResetPasswordDto, { token: "reset-token", password: "alphabetonly" }],
  ])("requires a number and special character during %s", async (_label, Dto, values) => {
    const errors = await validate(Object.assign(new Dto(), values));
    expect(errors.some((error) => error.property === "password")).toBe(true);
  });

  it("enforces the five-interest onboarding rule", async () => {
    const service = new UsersService({} as never, {} as never, {} as never);
    await expect(service.updateProfile("user", { interests: ["1", "2", "3", "4", "5", "6"] }))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it("requires the compulsory onboarding details before completion", async () => {
    const users = { findOneBy: jest.fn().mockResolvedValue({ id: "member" }) };
    const service = new OnboardingService(users as never, {} as never, {} as never);
    await expect(service.completeForUser("member", {
      age: 25,
      bio: "Faith and family matter to me.",
      church: "Harvesters International Christian Center",
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("refuses upload signing until private storage credentials exist", async () => {
    const config = { get: jest.fn().mockReturnValue(undefined) } as unknown as ConfigService;
    const service = new StorageService(config);
    await expect(service.createUpload("user", {
      purpose: "identity-document",
      contentType: "image/jpeg",
      fileName: "document.jpg",
    })).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("refuses transactional email until Resend is configured", async () => {
    const config = { get: jest.fn().mockReturnValue(undefined) } as unknown as ConfigService;
    const service = new EmailService(config);
    await expect(service.sendVerificationCode({
      email: "member@example.com",
      name: "Member",
      code: "123456",
      codeId: "test-code",
    })).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});

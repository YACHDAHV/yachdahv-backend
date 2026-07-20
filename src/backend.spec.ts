import { BadRequestException, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { MatchesService } from "./matches/matches.service";
import { EmailService } from "./email/email.service";
import { StorageService } from "./storage/storage.service";
import { UsersService } from "./users/users.service";

describe("backend domain rules", () => {
  it("does not allow a member to match with themselves", async () => {
    const service = new MatchesService({} as never, {} as never, {} as never);
    await expect(service.like("same-user", "same-user")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("enforces the five-interest onboarding rule", async () => {
    const service = new UsersService({} as never, {} as never, {} as never);
    await expect(service.updateProfile("user", { interests: ["1", "2", "3", "4", "5", "6"] }))
      .rejects.toBeInstanceOf(BadRequestException);
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

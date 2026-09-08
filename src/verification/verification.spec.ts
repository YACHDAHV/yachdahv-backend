import { BadRequestException, ConflictException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { validate } from "class-validator";
import { VerificationStatus } from "../database/entities";
import { SubmitVerificationDto } from "./dto/verification.dto";
import { PremblyClient, sanitizePremblyPayload } from "./prembly.client";
import { VerificationService } from "./verification.service";
import { StorageService } from "../storage/storage.service";

describe("Prembly identity verification", () => {
  it("requires an 11-digit NIN for Nigerian verification", async () => {
    const errors = await validate(Object.assign(new SubmitVerificationDto(), {
      documentType: "nin",
      nin: "12345",
      selfieKey: "identity-selfie/user/photo.jpg",
    }));
    expect(errors.some((error) => error.property === "nin")).toBe(true);
  });

  it("requires a country and document image for global IDs", async () => {
    const errors = await validate(Object.assign(new SubmitVerificationDto(), {
      documentType: "passport",
      selfieKey: "identity-selfie/user/photo.jpg",
    }));
    expect(errors.some((error) => error.property === "documentCountry")).toBe(true);
    expect(errors.some((error) => error.property === "documentKey")).toBe(true);
  });

  it("strips NIN photos and full numbers from stored Prembly payloads", () => {
    const sanitized = sanitizePremblyPayload({
      status: true,
      nin_data: { nin: "12345678901", firstname: "Ada", photo: "a".repeat(200) },
      face_data: { status: true, confidence: 0.99 },
    });
    const ninData = sanitized.nin_data as Record<string, unknown>;
    expect(ninData.nin).toBe("12****01");
    expect(ninData.photo).toBe("[omitted]");
    expect(ninData.firstname).toBe("Ada");
  });

  it("rejects private files that do not belong to the member", () => {
    const service = new StorageService({ get: jest.fn() } as unknown as ConfigService);
    expect(() => service.assertOwnedPrivateKey("user-1", "identity-selfie/user-2/photo.jpg"))
      .toThrow(BadRequestException);
  });

  it("auto-verifies a Nigerian NIN after liveness and face match succeed", async () => {
    const user = { id: "user-1", name: "Ada", email: "ada@example.com", identityStatus: VerificationStatus.NOT_STARTED };
    const submissions = {
      exists: jest.fn().mockResolvedValue(false),
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ id: "sub-1", createdAt: new Date("2026-01-01"), ...value })),
      findOne: jest.fn(),
    };
    const users = {
      findOneBy: jest.fn().mockResolvedValue(user),
      update: jest.fn(),
    };
    const prembly = {
      isConfigured: () => true,
      livelinessCheck: jest.fn().mockResolvedValue({ ok: true, reference: "live-1", message: "Liveliness Detected", payload: {} }),
      ninWithFace: jest.fn().mockResolvedValue({ ok: true, reference: "nin-1", message: "Face Match", payload: {} }),
    };
    const storage = {
      assertOwnedPrivateKey: jest.fn(),
      getPrivateObjectBase64: jest.fn().mockResolvedValue("abc123"),
    };
    const email = { sendIdentityDecision: jest.fn().mockResolvedValue(undefined) };
    const service = new VerificationService(
      submissions as never,
      users as never,
      { notify: jest.fn() } as never,
      email as never,
      prembly as never,
      storage as never,
    );

    await expect(service.submit("user-1", {
      documentType: "nin",
      nin: "12345678901",
      selfieKey: "identity-selfie/user-1/photo.jpg",
    })).resolves.toMatchObject({
      status: VerificationStatus.VERIFIED,
      documentCountry: "NG",
      documentNumberLast4: "8901",
      livenessPassed: true,
      faceMatchPassed: true,
    });
    expect(users.update).toHaveBeenCalledWith("user-1", { identityStatus: VerificationStatus.VERIFIED });
    expect(email.sendIdentityDecision).toHaveBeenCalled();
  });

  it("rejects a global document when liveness fails", async () => {
    const user = { id: "user-1", name: "Ada", email: "ada@example.com", identityStatus: VerificationStatus.NOT_STARTED };
    const submissions = {
      exists: jest.fn().mockResolvedValue(false),
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ id: "sub-1", createdAt: new Date("2026-01-01"), ...value })),
    };
    const users = { findOneBy: jest.fn().mockResolvedValue(user), update: jest.fn() };
    const prembly = {
      isConfigured: () => true,
      livelinessCheck: jest.fn().mockResolvedValue({
        ok: false,
        reference: "live-1",
        message: "Liveness not detected",
        payload: {},
      }),
    };
    const storage = {
      assertOwnedPrivateKey: jest.fn(),
      getPrivateObjectBase64: jest.fn().mockResolvedValue("abc123"),
    };
    const service = new VerificationService(
      submissions as never,
      users as never,
      { notify: jest.fn() } as never,
      { sendIdentityDecision: jest.fn() } as never,
      prembly as never,
      storage as never,
    );

    await expect(service.submit("user-1", {
      documentType: "passport",
      documentCountry: "GB",
      documentKey: "identity-document/user-1/passport.jpg",
      selfieKey: "identity-selfie/user-1/photo.jpg",
    })).resolves.toMatchObject({
      status: VerificationStatus.REJECTED,
      livenessPassed: false,
    });
  });

  it("does not let a second account reuse a verified NIN", async () => {
    const submissions = { exists: jest.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true) };
    const users = {
      findOneBy: jest.fn().mockResolvedValue({
        id: "user-2",
        identityStatus: VerificationStatus.NOT_STARTED,
      }),
    };
    const storage = { assertOwnedPrivateKey: jest.fn() };
    const service = new VerificationService(
      submissions as never,
      users as never,
      { notify: jest.fn() } as never,
      { sendIdentityDecision: jest.fn() } as never,
      { isConfigured: () => true } as never,
      storage as never,
    );

    await expect(service.submit("user-2", {
      documentType: "nin",
      nin: "12345678901",
      selfieKey: "identity-selfie/user-2/photo.jpg",
    })).rejects.toBeInstanceOf(ConflictException);
  });
});

describe("Prembly client", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("treats a high-confidence liveness response as a pass", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        status: true,
        response_code: "00",
        detail: "Liveliness Detected",
        data: { confidence: 0.99, confidence_in_percentage: 99 },
        verification: { status: "VERIFIED", reference: "661" },
      }),
    }) as typeof fetch;
    const client = new PremblyClient({
      get: jest.fn((key: string) => {
        if (key === "PREMBLY_API_KEY") return "test-key";
        if (key === "PREMBLY_LIVENESS_MIN_CONFIDENCE") return "0.7";
        return undefined;
      }),
    } as unknown as ConfigService);

    await expect(client.livelinessCheck("abc")).resolves.toMatchObject({
      ok: true,
      reference: "661",
    });
  });

  it("treats Prembly as configured when only the API key is set", () => {
    const client = new PremblyClient({
      get: jest.fn((key: string) => key === "PREMBLY_API_KEY" ? "test-key" : undefined),
    } as unknown as ConfigService);
    expect(client.isConfigured()).toBe(true);
  });

  it("fails document verification when the face does not match", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        status: true,
        response_code: "00",
        face_data: { status: false, message: "Face does not match", confidence: 0 },
        verification: { reference: "doc-1" },
      }),
    }) as typeof fetch;
    const client = new PremblyClient({
      get: jest.fn((key: string) => {
        if (key === "PREMBLY_API_KEY") return "test-key";
        if (key === "PREMBLY_APP_ID") return "test-app";
        return undefined;
      }),
    } as unknown as ConfigService);

    await expect(client.documentWithFace({
      documentType: "passport",
      country: "GB",
      documentBase64: "doc",
      selfieBase64: "face",
    })).resolves.toMatchObject({ ok: false });
  });
});

import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, timingSafeEqual } from "crypto";

export type PremblyJson = Record<string, unknown>;

export interface PremblyCheckResult {
  ok: boolean;
  reference: string | null;
  message: string;
  confidence: number | null;
  payload: PremblyJson;
}

const DOCUMENT_TYPE_CODES: Record<string, string> = {
  passport: "PP",
  drivers_license: "DL",
  national_id: "ID",
  residence_permit: "RP",
  voters_card: "ID",
};

@Injectable()
export class PremblyClient {
  private readonly logger = new Logger(PremblyClient.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured() {
    return Boolean(this.apiKey());
  }

  documentTypeCode(documentType: string) {
    return DOCUMENT_TYPE_CODES[documentType] ?? null;
  }

  verifyWebhookSignature(rawBody: string, signature?: string) {
    const publicKey = this.config.get<string>("PREMBLY_PUBLIC_KEY")?.trim();
    if (!publicKey || !signature) return false;
    const expected = createHmac("sha256", publicKey).update(rawBody).digest("base64");
    const provided = Buffer.from(signature);
    const computed = Buffer.from(expected);
    return provided.length === computed.length && timingSafeEqual(provided, computed);
  }

  async livelinessCheck(imageBase64: string) {
    return this.request("/verification/biometrics/face/liveliness_check", { image: imageBase64 }, "liveness");
  }

  async ninWithFace(nin: string, imageBase64: string) {
    return this.request("/verification/nin_w_face", { number: nin, number_nin: nin, image: imageBase64 }, "nin");
  }

  async documentWithFace(input: { documentType: string; country: string; documentBase64: string; selfieBase64: string }) {
    const docType = this.documentTypeCode(input.documentType);
    if (!docType) {
      return {
        ok: false,
        reference: null,
        message: "That document type is not supported",
        confidence: null,
        payload: {},
      } satisfies PremblyCheckResult;
    }
    return this.request("/verification/document_w_face", {
      doc_type: docType,
      doc_country: input.country,
      doc_image: input.documentBase64,
      selfie_image: input.selfieBase64,
    }, "document");
  }

  private async request(path: string, body: PremblyJson, kind: "liveness" | "nin" | "document"): Promise<PremblyCheckResult> {
    const apiKey = this.apiKey();
    if (!apiKey) {
      throw new ServiceUnavailableException("Identity verification is not configured");
    }

    const headers: Record<string, string> = {
      "content-type": "application/json",
      "x-api-key": apiKey,
    };
    const appId = this.appId();
    if (appId) headers["app-id"] = appId;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000);
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl()}${path}`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (error) {
      this.logger.error(`Prembly ${kind} request failed`, error instanceof Error ? error.stack : undefined);
      throw new ServiceUnavailableException("Identity verification is temporarily unavailable. Please try again shortly.");
    } finally {
      clearTimeout(timeout);
    }

    const payload = await this.readJson(response);
    if (!response.ok) {
      this.logger.warn(`Prembly ${kind} returned HTTP ${response.status}`);
      return {
        ok: false,
        reference: this.referenceFrom(payload),
        message: this.messageFrom(payload) || `Identity verification failed (${response.status})`,
        confidence: this.confidenceFrom(payload),
        payload: sanitizePremblyPayload(payload),
      };
    }

    return {
      ok: this.isSuccessful(payload, kind),
      reference: this.referenceFrom(payload),
      message: this.messageFrom(payload) || (kind === "liveness" ? "Liveness check completed" : "Identity check completed"),
      confidence: this.confidenceFrom(payload),
      payload: sanitizePremblyPayload(payload),
    };
  }

  private isSuccessful(payload: PremblyJson, kind: "liveness" | "nin" | "document") {
    const responseCode = String(payload.response_code ?? "");
    const statusFlag = payload.status === true || String(payload.status).toLowerCase() === "true";
    const verification = asRecord(payload.verification);
    const verificationStatus = String(verification.status ?? payload.verification_status ?? "").toUpperCase();
    const requestOk = statusFlag || responseCode === "00" || verificationStatus === "VERIFIED";
    if (!requestOk) return false;
    if (kind === "liveness") {
      return (this.confidenceFrom(payload) ?? 0) >= this.minLivenessConfidence();
    }
    return this.faceMatched(payload);
  }

  private faceMatched(payload: PremblyJson) {
    const face = asRecord(payload.face_data);
    if (!Object.keys(face).length) return true;
    if (face.status === false || String(face.status).toLowerCase() === "false") return false;
    const confidence = this.confidenceFrom(face) ?? this.confidenceFrom(payload);
    if (confidence == null) return face.status === true || String(face.status).toLowerCase() === "true";
    return confidence >= 0.5;
  }

  private confidenceFrom(payload: PremblyJson) {
    const data = asRecord(payload.data);
    const face = asRecord(payload.face_data);
    const raw = face.confidence ?? data.confidence_in_percentage ?? data.confidence ?? payload.confidence;
    const value = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(value)) return null;
    return value > 1 ? value / 100 : value;
  }

  private referenceFrom(payload: PremblyJson) {
    const verification = asRecord(payload.verification);
    const value = verification.reference ?? verification.verification_id ?? payload.reference_id ?? payload.transaction_id;
    return value == null ? null : String(value).trim() || null;
  }

  private messageFrom(payload: PremblyJson) {
    const face = asRecord(payload.face_data);
    const value = payload.detail ?? payload.message ?? face.message;
    return value == null ? "" : String(value);
  }

  private async readJson(response: Response): Promise<PremblyJson> {
    const text = await response.text();
    if (!text) return {};
    try {
      const parsed = JSON.parse(text) as unknown;
      return asRecord(parsed);
    } catch {
      return { message: text.slice(0, 300) };
    }
  }

  private apiKey() {
    return this.config.get<string>("PREMBLY_API_KEY")?.trim() || "";
  }

  private appId() {
    return this.config.get<string>("PREMBLY_APP_ID")?.trim() || "";
  }

  private baseUrl() {
    return (this.config.get<string>("PREMBLY_BASE_URL")?.trim() || "https://api.prembly.com").replace(/\/$/, "");
  }

  private minLivenessConfidence() {
    const configured = Number(this.config.get<string>("PREMBLY_LIVENESS_MIN_CONFIDENCE") ?? "0.7");
    return Number.isFinite(configured) ? configured : 0.7;
  }
}

export function sanitizePremblyPayload(value: unknown): PremblyJson {
  return asRecord(stripSensitive(value));
}

function stripSensitive(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripSensitive);
  if (!value || typeof value !== "object") return value;
  const output: PremblyJson = {};
  for (const [key, nested] of Object.entries(value as PremblyJson)) {
    if (/photo|image|signature|selfie|doc_image/i.test(key) && typeof nested === "string" && nested.length > 120) {
      output[key] = "[omitted]";
      continue;
    }
    if (/^nin$|^number_nin$|^number$/i.test(key) && typeof nested === "string" && nested.length >= 8) {
      output[key] = `${nested.slice(0, 2)}****${nested.slice(-2)}`;
      continue;
    }
    output[key] = stripSensitive(nested) as PremblyJson[string];
  }
  return output;
}

function asRecord(value: unknown): PremblyJson {
  return value && typeof value === "object" && !Array.isArray(value) ? value as PremblyJson : {};
}

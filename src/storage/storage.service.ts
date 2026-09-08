import { BadRequestException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import { extname } from "path";
import { CreateUploadDto } from "./dto/upload.dto";

const PRIVATE_OBJECT_PREFIXES = ["identity-selfie/", "identity-document/"];
const MAX_PRIVATE_OBJECT_BYTES = 6 * 1024 * 1024;

@Injectable()
export class StorageService {
  constructor(private readonly config: ConfigService) {}

  async createUpload(userId: string, payload: CreateUploadDto) {
    if (payload.contentType === "application/pdf") {
      throw new BadRequestException(payload.purpose === "profile-photo" ? "Profile photos must be images" : "Identity files must be JPEG, PNG, or WebP images");
    }
    const bucket = payload.purpose === "profile-photo"
      ? this.config.get<string>("R2_PUBLIC_BUCKET")
      : this.config.get<string>("R2_PRIVATE_BUCKET");
    const client = this.client();
    if (!bucket) throw new ServiceUnavailableException("Object storage has not been configured");

    const extension = extname(payload.fileName).toLowerCase().replace(/[^.a-z0-9]/g, "").slice(0, 8);
    const key = `${payload.purpose}/${userId}/${randomUUID()}${extension}`;
    const uploadUrl = await getSignedUrl(client, new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: payload.contentType,
      Metadata: { userId, purpose: payload.purpose },
    }), { expiresIn: 300 });
    const publicBaseUrl = this.config.get<string>("R2_PUBLIC_BASE_URL")?.replace(/\/$/, "");
    return {
      key,
      uploadUrl,
      expiresInSeconds: 300,
      publicUrl: payload.purpose === "profile-photo" && publicBaseUrl ? `${publicBaseUrl}/${key}` : null,
    };
  }

  async getPrivateObjectBase64(userId: string, key: string) {
    this.assertOwnedPrivateKey(userId, key);
    const bucket = this.config.get<string>("R2_PRIVATE_BUCKET");
    const client = this.client();
    if (!bucket) throw new ServiceUnavailableException("Object storage has not been configured");
    const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const bytes = await streamToBuffer(response.Body);
    if (!bytes.length) throw new BadRequestException("The uploaded file could not be read");
    if (bytes.length > MAX_PRIVATE_OBJECT_BYTES) throw new BadRequestException("The uploaded file is too large to verify");
    return bytes.toString("base64");
  }

  assertOwnedPrivateKey(userId: string, key: string) {
    const allowed = PRIVATE_OBJECT_PREFIXES.some((prefix) => key.startsWith(`${prefix}${userId}/`));
    if (!allowed) throw new BadRequestException("The uploaded file is not available for this verification");
  }

  private client() {
    const accountId = this.config.get<string>("R2_ACCOUNT_ID");
    const accessKeyId = this.config.get<string>("R2_ACCESS_KEY_ID");
    const secretAccessKey = this.config.get<string>("R2_SECRET_ACCESS_KEY");
    if (!accountId || !accessKeyId || !secretAccessKey) {
      throw new ServiceUnavailableException("Object storage has not been configured");
    }
    return new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
  }
}

async function streamToBuffer(body: unknown) {
  if (!body) return Buffer.alloc(0);
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array) return Buffer.from(body);
  const chunks: Buffer[] = [];
  for await (const chunk of body as AsyncIterable<Uint8Array>) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

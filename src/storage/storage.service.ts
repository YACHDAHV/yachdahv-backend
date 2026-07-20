import { BadRequestException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import { extname } from "path";
import { CreateUploadDto } from "./dto/upload.dto";

@Injectable()
export class StorageService {
  constructor(private readonly config: ConfigService) {}

  async createUpload(userId: string, payload: CreateUploadDto) {
    if (payload.contentType === "application/pdf" && payload.purpose === "profile-photo") {
      throw new BadRequestException("Profile photos must be images");
    }
    const accountId = this.config.get<string>("R2_ACCOUNT_ID");
    const accessKeyId = this.config.get<string>("R2_ACCESS_KEY_ID");
    const secretAccessKey = this.config.get<string>("R2_SECRET_ACCESS_KEY");
    const bucket = payload.purpose === "profile-photo"
      ? this.config.get<string>("R2_PUBLIC_BUCKET")
      : this.config.get<string>("R2_PRIVATE_BUCKET");
    if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
      throw new ServiceUnavailableException("Object storage has not been configured");
    }

    const extension = extname(payload.fileName).toLowerCase().replace(/[^.a-z0-9]/g, "").slice(0, 8);
    const key = `${payload.purpose}/${userId}/${randomUUID()}${extension}`;
    const client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
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
}

import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Environment } from "../config/environment";

export interface PresignedUploadInput {
  objectKey: string;
  contentType: string;
  contentLength?: number;
  expiresInSeconds?: number;
}

@Injectable()
export class R2StorageService {
  private readonly client: S3Client | null;
  private readonly bucket: string | undefined;

  constructor(config: ConfigService<Environment, true>) {
    const accountId = config.get("R2_ACCOUNT_ID", { infer: true });
    const accessKeyId = config.get("R2_ACCESS_KEY_ID", { infer: true });
    const secretAccessKey = config.get("R2_SECRET_ACCESS_KEY", { infer: true });
    this.bucket = config.get("R2_BUCKET", { infer: true });

    this.client =
      accountId && accessKeyId && secretAccessKey && this.bucket
        ? new S3Client({
            region: "auto",
            endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
            credentials: { accessKeyId, secretAccessKey },
          })
        : null;
  }

  isConfigured() {
    return this.client !== null && Boolean(this.bucket);
  }

  async createUploadUrl(input: PresignedUploadInput) {
    const { client, bucket } = this.requireClient();
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: input.objectKey,
      ContentType: input.contentType,
    });
    return getSignedUrl(client, command, {
      expiresIn: input.expiresInSeconds ?? 300,
    });
  }

  async createDownloadUrl(objectKey: string, expiresInSeconds = 300) {
    const { client, bucket } = this.requireClient();
    return getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: bucket, Key: objectKey }),
      {
        expiresIn: expiresInSeconds,
      },
    );
  }

  async inspectObject(objectKey: string) {
    const { client, bucket } = this.requireClient();
    return client.send(
      new HeadObjectCommand({ Bucket: bucket, Key: objectKey }),
    );
  }

  async deleteObject(objectKey: string) {
    const { client, bucket } = this.requireClient();
    await client.send(
      new DeleteObjectCommand({ Bucket: bucket, Key: objectKey }),
    );
  }

  private requireClient() {
    if (!this.client || !this.bucket) {
      throw new ServiceUnavailableException("R2 storage is not configured");
    }
    return { client: this.client, bucket: this.bucket };
  }
}

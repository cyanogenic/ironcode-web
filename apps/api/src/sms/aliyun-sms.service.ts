import {
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SendSmsRequest } from "@alicloud/dysmsapi20170525";
import type { Environment } from "../config/environment";
import {
  ALIYUN_SMS_CLIENT,
  type AliyunSmsClient,
} from "./sms.constants";

@Injectable()
export class AliyunSmsService {
  private readonly logger = new Logger(AliyunSmsService.name);

  constructor(
    @Inject(ALIYUN_SMS_CLIENT)
    private readonly client: AliyunSmsClient | null,
    private readonly config: ConfigService<Environment, true>,
  ) {}

  async sendVerificationCode(phone: string, code: string): Promise<void> {
    if (!this.client) {
      throw new ServiceUnavailableException("SMS provider is not configured");
    }

    const request = new SendSmsRequest({
      phoneNumbers: phone,
      signName: this.config.get("ALIYUN_SMS_SIGN_NAME", { infer: true }),
      templateCode: this.config.get("ALIYUN_SMS_TEMPLATE_CODE", {
        infer: true,
      }),
      templateParam: JSON.stringify({ code }),
    });

    try {
      const response = await this.client.sendSms(request);
      const result = response.body;
      if (result?.code !== "OK") {
        this.logger.error(
          `Aliyun SMS rejected request for ${maskPhone(phone)}: code=${result?.code ?? "UNKNOWN"}, requestId=${result?.requestId ?? "UNKNOWN"}`,
        );
        throw new ServiceUnavailableException(
          "Verification code could not be sent",
        );
      }

      this.logger.log(
        `Aliyun SMS accepted request for ${maskPhone(phone)}: requestId=${result.requestId ?? "UNKNOWN"}`,
      );
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;

      const detail = error instanceof Error ? error.message : "Unknown error";
      this.logger.error(
        `Aliyun SMS request failed for ${maskPhone(phone)}: ${detail}`,
      );
      throw new ServiceUnavailableException(
        "Verification code could not be sent",
      );
    }
  }
}

function maskPhone(phone: string): string {
  if (phone.length < 8) return "***";
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
}

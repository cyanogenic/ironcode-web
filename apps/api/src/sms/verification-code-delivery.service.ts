import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Environment } from "../config/environment";
import { AliyunSmsService } from "./aliyun-sms.service";

@Injectable()
export class VerificationCodeDeliveryService {
  private readonly logger = new Logger(VerificationCodeDeliveryService.name);

  constructor(
    private readonly config: ConfigService<Environment, true>,
    private readonly aliyunSms: AliyunSmsService,
  ) {}

  async send(phone: string, code: string): Promise<void> {
    if (this.config.get("OTP_PROVIDER", { infer: true }) === "console") {
      this.logger.warn(`[development OTP] ${phone}: ${code}`);
      return;
    }

    await this.aliyunSms.sendVerificationCode(phone, code);
  }
}

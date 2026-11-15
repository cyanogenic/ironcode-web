import Dysmsapi20170525 from "@alicloud/dysmsapi20170525";
import * as OpenApi from "@alicloud/openapi-client";
import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Environment } from "../config/environment";
import { AliyunSmsService } from "./aliyun-sms.service";
import { ALIYUN_SMS_CLIENT, type AliyunSmsClient } from "./sms.constants";
import { VerificationCodeDeliveryService } from "./verification-code-delivery.service";

@Module({
  providers: [
    {
      provide: ALIYUN_SMS_CLIENT,
      inject: [ConfigService],
      useFactory: (
        config: ConfigService<Environment, true>,
      ): AliyunSmsClient | null => {
        if (config.get("OTP_PROVIDER", { infer: true }) !== "aliyun") {
          return null;
        }

        const clientConfig = new OpenApi.Config({
          accessKeyId: config.get("ALIYUN_SMS_ACCESS_KEY_ID", { infer: true }),
          accessKeySecret: config.get("ALIYUN_SMS_ACCESS_KEY_SECRET", {
            infer: true,
          }),
          endpoint: config.get("ALIYUN_SMS_ENDPOINT", { infer: true }),
        });
        return new Dysmsapi20170525(clientConfig);
      },
    },
    AliyunSmsService,
    VerificationCodeDeliveryService,
  ],
  exports: [VerificationCodeDeliveryService],
})
export class SmsModule {}

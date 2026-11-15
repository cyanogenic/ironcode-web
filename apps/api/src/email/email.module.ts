import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import nodemailer from "nodemailer";
import type { Environment } from "../config/environment";
import { EMAIL_TRANSPORTER, type EmailTransporter } from "./email.constants";
import { EmailVerificationDeliveryService } from "./email-verification-delivery.service";

@Module({
  providers: [
    {
      provide: EMAIL_TRANSPORTER,
      inject: [ConfigService],
      useFactory: (
        config: ConfigService<Environment, true>,
      ): EmailTransporter | null => {
        if (config.get("EMAIL_PROVIDER", { infer: true }) !== "smtp") {
          return null;
        }

        const username = config.get("SMTP_USERNAME", { infer: true });
        const password = config.get("SMTP_PASSWORD", { infer: true });
        return nodemailer.createTransport({
          host: config.get("SMTP_HOST", { infer: true }),
          port: config.get("SMTP_PORT", { infer: true }),
          secure: config.get("SMTP_SECURE", { infer: true }),
          requireTLS: !config.get("SMTP_SECURE", { infer: true }),
          ...(username && password
            ? { auth: { user: username, pass: password } }
            : {}),
          connectionTimeout: 10_000,
          greetingTimeout: 10_000,
          socketTimeout: 20_000,
          tls: { minVersion: "TLSv1.2" },
        });
      },
    },
    EmailVerificationDeliveryService,
  ],
  exports: [EmailVerificationDeliveryService],
})
export class EmailModule {}

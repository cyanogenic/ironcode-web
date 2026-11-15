import {
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Environment } from "../config/environment";
import { EMAIL_TRANSPORTER, type EmailTransporter } from "./email.constants";

@Injectable()
export class EmailVerificationDeliveryService {
  private readonly logger = new Logger(EmailVerificationDeliveryService.name);

  constructor(
    private readonly config: ConfigService<Environment, true>,
    @Inject(EMAIL_TRANSPORTER)
    private readonly transporter: EmailTransporter | null,
  ) {}

  async send(email: string, code: string): Promise<void> {
    if (this.config.get("EMAIL_PROVIDER", { infer: true }) === "console") {
      this.logger.warn(`[development email OTP] ${maskEmail(email)}: ${code}`);
      return;
    }

    if (!this.transporter) {
      throw new ServiceUnavailableException("Email delivery is unavailable");
    }

    const fromName = this.config.get("SMTP_FROM_NAME", { infer: true });
    const fromAddress = this.config.get("SMTP_FROM_ADDRESS", { infer: true });
    try {
      await this.transporter.sendMail({
        from: { name: fromName, address: fromAddress! },
        to: email,
        subject: "铁码维修登录验证码",
        text: `你的铁码维修验证码是 ${code}。验证码 5 分钟内有效，请勿转发给他人。`,
        html: `<!doctype html><html lang="zh-CN"><body style="font-family:system-ui,-apple-system,sans-serif;color:#202020"><h2>铁码维修登录验证</h2><p>你的验证码是：</p><p style="font-size:30px;font-weight:700;letter-spacing:8px">${code}</p><p>验证码 5 分钟内有效，请勿转发给他人。</p><p style="color:#666">如果这不是你的操作，可以忽略这封邮件。</p></body></html>`,
      });
      this.logger.log(`Verification email accepted for ${maskEmail(email)}`);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "unknown error";
      this.logger.error(
        `Verification email failed for ${maskEmail(email)}: ${detail}`,
      );
      throw new ServiceUnavailableException(
        "Verification email could not be sent",
      );
    }
  }
}

function maskEmail(email: string): string {
  const [local = "", domain = ""] = email.split("@");
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}

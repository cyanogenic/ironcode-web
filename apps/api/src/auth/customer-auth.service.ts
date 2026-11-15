import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import {
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { UserRole } from "@prisma/client";
import type { Environment } from "../config/environment";
import { PrismaService } from "../prisma/prisma.service";
import { VerificationCodeDeliveryService } from "../sms/verification-code-delivery.service";

const OTP_PURPOSE = "customer-login";
const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_COOLDOWN_MS = 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_HOURLY_LIMIT = 10;

@Injectable()
export class CustomerAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Environment, true>,
    private readonly delivery: VerificationCodeDeliveryService,
  ) {}

  async requestCode(phone: string) {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const recent = await this.prisma.otpChallenge.findMany({
      where: { phone, purpose: OTP_PURPOSE, createdAt: { gte: oneHourAgo } },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });

    if (
      recent[0] &&
      now.getTime() - recent[0].createdAt.getTime() < OTP_COOLDOWN_MS
    ) {
      throw new HttpException(
        "Please wait before requesting another code",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (recent.length >= OTP_HOURLY_LIMIT) {
      throw new HttpException(
        "Too many verification code requests",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const code = randomInt(100_000, 1_000_000).toString();
    const challenge = await this.prisma.otpChallenge.create({
      data: {
        phone,
        purpose: OTP_PURPOSE,
        codeHash: this.hashCode(phone, code),
        expiresAt: new Date(now.getTime() + OTP_TTL_MS),
      },
    });

    try {
      await this.delivery.send(phone, code);
    } catch (error) {
      await this.prisma.otpChallenge.deleteMany({
        where: { id: challenge.id, consumedAt: null },
      });
      throw error;
    }
  }

  async verifyCode(phone: string, code: string) {
    const challenge = await this.prisma.otpChallenge.findFirst({
      where: {
        phone,
        purpose: OTP_PURPOSE,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!challenge || challenge.attempts >= OTP_MAX_ATTEMPTS) {
      throw new UnauthorizedException(
        "Verification code is invalid or expired",
      );
    }

    const actual = Buffer.from(this.hashCode(phone, code), "hex");
    const expected = Buffer.from(challenge.codeHash, "hex");
    if (
      actual.length !== expected.length ||
      !timingSafeEqual(actual, expected)
    ) {
      await this.prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException(
        "Verification code is invalid or expired",
      );
    }

    return this.prisma.$transaction(async (transaction) => {
      const consumed = await transaction.otpChallenge.updateMany({
        where: { id: challenge.id, consumedAt: null },
        data: { consumedAt: new Date() },
      });
      if (consumed.count !== 1) {
        throw new UnauthorizedException(
          "Verification code has already been used",
        );
      }

      const existing = await transaction.user.findUnique({ where: { phone } });
      if (existing && existing.role !== UserRole.CUSTOMER) {
        throw new UnauthorizedException(
          "This phone number is reserved for a staff account",
        );
      }

      return transaction.user.upsert({
        where: { phone },
        create: { phone, role: UserRole.CUSTOMER, lastLoginAt: new Date() },
        update: { lastLoginAt: new Date() },
      });
    });
  }

  private hashCode(phone: string, code: string) {
    return createHmac("sha256", this.config.get("OTP_PEPPER", { infer: true }))
      .update(`${OTP_PURPOSE}:${phone}:${code}`)
      .digest("hex");
  }

}

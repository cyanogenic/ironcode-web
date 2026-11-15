import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  Prisma,
  UserRole,
  VerificationChannel,
  type User,
} from "@prisma/client";
import type { Environment } from "../config/environment";
import { EmailVerificationDeliveryService } from "../email/email-verification-delivery.service";
import { PrismaService } from "../prisma/prisma.service";
import { VerificationCodeDeliveryService } from "../sms/verification-code-delivery.service";

const LOGIN_PURPOSE = "customer-login";
const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_COOLDOWN_MS = 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_HOURLY_LIMIT = 10;

@Injectable()
export class CustomerAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Environment, true>,
    private readonly smsDelivery: VerificationCodeDeliveryService,
    private readonly emailDelivery: EmailVerificationDeliveryService,
  ) {}

  getLoginMethods() {
    return {
      phone: this.config.get("CUSTOMER_PHONE_LOGIN_ENABLED", { infer: true }),
      email: this.config.get("CUSTOMER_EMAIL_LOGIN_ENABLED", { infer: true }),
    };
  }

  requestPhoneCode(phone: string) {
    return this.requestCode(VerificationChannel.SMS, phone, LOGIN_PURPOSE);
  }

  requestEmailCode(email: string) {
    return this.requestCode(
      VerificationChannel.EMAIL,
      normalizeEmail(email),
      LOGIN_PURPOSE,
    );
  }

  async verifyPhoneCode(phone: string, code: string) {
    const challenge = await this.validateChallenge(
      VerificationChannel.SMS,
      phone,
      LOGIN_PURPOSE,
      code,
    );
    return this.prisma.$transaction(async (transaction) => {
      await this.consumeChallenge(transaction, challenge.id);
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

  async verifyEmailCode(emailInput: string, code: string) {
    const email = normalizeEmail(emailInput);
    const challenge = await this.validateChallenge(
      VerificationChannel.EMAIL,
      email,
      LOGIN_PURPOSE,
      code,
    );
    return this.prisma.$transaction(async (transaction) => {
      await this.consumeChallenge(transaction, challenge.id);
      const existing = await transaction.user.findUnique({ where: { email } });
      if (existing && existing.role !== UserRole.CUSTOMER) {
        throw new UnauthorizedException(
          "This email address is reserved for a staff account",
        );
      }
      const now = new Date();
      return transaction.user.upsert({
        where: { email },
        create: {
          email,
          emailVerifiedAt: now,
          role: UserRole.CUSTOMER,
          lastLoginAt: now,
        },
        update: { emailVerifiedAt: now, lastLoginAt: now },
      });
    });
  }

  async requestIdentityCode(
    userId: string,
    channel: VerificationChannel,
    destinationInput: string,
  ) {
    const destination = normalizeDestination(channel, destinationInput);
    const user = await this.requireCustomer(userId);
    const current =
      channel === VerificationChannel.SMS ? user.phone : user.email;
    if (current === destination) {
      throw new BadRequestException("This identity is already bound");
    }
    await this.assertIdentityAvailable(channel, destination, userId);
    return this.requestCode(channel, destination, bindingPurpose(userId));
  }

  async verifyIdentityCode(
    userId: string,
    channel: VerificationChannel,
    destinationInput: string,
    code: string,
  ) {
    const destination = normalizeDestination(channel, destinationInput);
    await this.requireCustomer(userId);
    const challenge = await this.validateChallenge(
      channel,
      destination,
      bindingPurpose(userId),
      code,
    );

    return this.prisma.$transaction(async (transaction) => {
      await this.consumeChallenge(transaction, challenge.id);
      const existing = await transaction.user.findFirst({
        where:
          channel === VerificationChannel.SMS
            ? { phone: destination }
            : { email: destination },
        select: { id: true },
      });
      if (existing && existing.id !== userId) {
        throw new ConflictException("This identity belongs to another account");
      }
      return transaction.user.update({
        where: { id: userId },
        data:
          channel === VerificationChannel.SMS
            ? { phone: destination }
            : { email: destination, emailVerifiedAt: new Date() },
      });
    });
  }

  async removeIdentity(userId: string, channel: VerificationChannel) {
    const user = await this.requireCustomer(userId);
    if (channel === VerificationChannel.SMS) {
      if (!user.phone) throw new NotFoundException("Phone is not bound");
      if (!user.email || !user.emailVerifiedAt) {
        throw new BadRequestException(
          "Bind and verify an email address before removing the phone number",
        );
      }
      return this.prisma.user.update({
        where: { id: userId },
        data: { phone: null },
      });
    }

    if (!user.email) throw new NotFoundException("Email is not bound");
    if (!user.phone) {
      throw new BadRequestException(
        "Bind a phone number before removing the email address",
      );
    }
    return this.prisma.user.update({
      where: { id: userId },
      data: { email: null, emailVerifiedAt: null },
    });
  }

  private async requestCode(
    channel: VerificationChannel,
    destination: string,
    purpose: string,
  ) {
    this.assertChannelEnabled(channel);
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const recent = await this.prisma.otpChallenge.findMany({
      where: {
        channel,
        destination,
        purpose,
        createdAt: { gte: oneHourAgo },
      },
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
        channel,
        destination,
        purpose,
        codeHash: this.hashCode(channel, destination, purpose, code),
        expiresAt: new Date(now.getTime() + OTP_TTL_MS),
      },
    });

    try {
      if (channel === VerificationChannel.SMS) {
        await this.smsDelivery.send(destination, code);
      } else {
        await this.emailDelivery.send(destination, code);
      }
    } catch (error) {
      await this.prisma.otpChallenge.deleteMany({
        where: { id: challenge.id, consumedAt: null },
      });
      throw error;
    }
  }

  private async validateChallenge(
    channel: VerificationChannel,
    destination: string,
    purpose: string,
    code: string,
  ) {
    this.assertChannelEnabled(channel);
    const challenge = await this.prisma.otpChallenge.findFirst({
      where: {
        channel,
        destination,
        purpose,
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

    const actual = Buffer.from(
      this.hashCode(channel, destination, purpose, code),
      "hex",
    );
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

    return challenge;
  }

  private async consumeChallenge(
    transaction: Prisma.TransactionClient,
    challengeId: string,
  ) {
    const consumed = await transaction.otpChallenge.updateMany({
      where: { id: challengeId, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (consumed.count !== 1) {
      throw new UnauthorizedException(
        "Verification code has already been used",
      );
    }
  }

  private assertChannelEnabled(channel: VerificationChannel) {
    const enabled =
      channel === VerificationChannel.SMS
        ? this.config.get("CUSTOMER_PHONE_LOGIN_ENABLED", { infer: true })
        : this.config.get("CUSTOMER_EMAIL_LOGIN_ENABLED", { infer: true });
    if (!enabled) {
      throw new NotFoundException("This login method is not enabled");
    }
  }

  private requireCustomer(userId: string): Promise<User> {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId, role: UserRole.CUSTOMER },
    });
  }

  private async assertIdentityAvailable(
    channel: VerificationChannel,
    destination: string,
    userId: string,
  ) {
    const existing = await this.prisma.user.findFirst({
      where:
        channel === VerificationChannel.SMS
          ? { phone: destination }
          : { email: destination },
      select: { id: true },
    });
    if (existing && existing.id !== userId) {
      throw new ConflictException("This identity belongs to another account");
    }
  }

  private hashCode(
    channel: VerificationChannel,
    destination: string,
    purpose: string,
    code: string,
  ) {
    return createHmac("sha256", this.config.get("OTP_PEPPER", { infer: true }))
      .update(`${purpose}:${channel}:${destination}:${code}`)
      .digest("hex");
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeDestination(
  channel: VerificationChannel,
  destination: string,
) {
  return channel === VerificationChannel.EMAIL
    ? normalizeEmail(destination)
    : destination;
}

function bindingPurpose(userId: string) {
  return `customer-bind:${userId}`;
}

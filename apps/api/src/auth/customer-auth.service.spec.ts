import { createHmac } from "node:crypto";
import { UserRole, VerificationChannel } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { CustomerAuthService } from "./customer-auth.service";

describe("CustomerAuthService", () => {
  it("removes a new challenge when code delivery fails", async () => {
    const prisma = {
      otpChallenge: {
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({ id: "challenge-1" }),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const config = {
      get: vi.fn((key: string) =>
        key === "CUSTOMER_PHONE_LOGIN_ENABLED"
          ? true
          : "otp-pepper-with-more-than-32-characters",
      ),
    };
    const smsDelivery = {
      send: vi.fn().mockRejectedValue(new Error("provider unavailable")),
    };
    const emailDelivery = { send: vi.fn() };
    const service = new CustomerAuthService(
      prisma as never,
      config as never,
      smsDelivery as never,
      emailDelivery as never,
    );

    await expect(service.requestPhoneCode("13800138000")).rejects.toThrow(
      "provider unavailable",
    );
    expect(prisma.otpChallenge.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        channel: VerificationChannel.SMS,
        destination: "13800138000",
      }),
    });
    expect(prisma.otpChallenge.deleteMany).toHaveBeenCalledWith({
      where: { id: "challenge-1", consumedAt: null },
    });
  });

  it("normalizes an email address before creating and delivering a code", async () => {
    const prisma = {
      otpChallenge: {
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({ id: "challenge-2" }),
      },
    };
    const config = {
      get: vi.fn((key: string) =>
        key === "CUSTOMER_EMAIL_LOGIN_ENABLED"
          ? true
          : "otp-pepper-with-more-than-32-characters",
      ),
    };
    const smsDelivery = { send: vi.fn() };
    const emailDelivery = { send: vi.fn().mockResolvedValue(undefined) };
    const service = new CustomerAuthService(
      prisma as never,
      config as never,
      smsDelivery as never,
      emailDelivery as never,
    );

    await service.requestEmailCode("  Customer@Example.COM ");

    expect(prisma.otpChallenge.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        channel: VerificationChannel.EMAIL,
        destination: "customer@example.com",
      }),
    });
    expect(emailDelivery.send).toHaveBeenCalledWith(
      "customer@example.com",
      expect.stringMatching(/^\d{6}$/),
    );
  });

  it("consumes a valid email code and creates a verified customer", async () => {
    const pepper = "otp-pepper-with-more-than-32-characters";
    const codeHash = createHmac("sha256", pepper)
      .update("customer-login:EMAIL:customer@example.com:123456")
      .digest("hex");
    const transaction = {
      otpChallenge: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      user: {
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: vi.fn().mockResolvedValue({
          id: "customer-1",
          role: UserRole.CUSTOMER,
          email: "customer@example.com",
        }),
      },
    };
    const prisma = {
      otpChallenge: {
        findFirst: vi.fn().mockResolvedValue({
          id: "challenge-3",
          attempts: 0,
          codeHash,
        }),
      },
      $transaction: vi.fn((callback) => callback(transaction)),
    };
    const config = {
      get: vi.fn((key: string) =>
        key === "CUSTOMER_EMAIL_LOGIN_ENABLED" ? true : pepper,
      ),
    };
    const service = new CustomerAuthService(
      prisma as never,
      config as never,
      { send: vi.fn() } as never,
      { send: vi.fn() } as never,
    );

    const user = await service.verifyEmailCode(
      "Customer@Example.com",
      "123456",
    );

    expect(transaction.otpChallenge.updateMany).toHaveBeenCalledWith({
      where: { id: "challenge-3", consumedAt: null },
      data: { consumedAt: expect.any(Date) },
    });
    expect(transaction.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: "customer@example.com" },
        create: expect.objectContaining({ emailVerifiedAt: expect.any(Date) }),
      }),
    );
    expect(user.email).toBe("customer@example.com");
  });

  it("does not allow binding an identity owned by another account", async () => {
    const prisma = {
      user: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: "customer-1",
          role: UserRole.CUSTOMER,
          phone: "13800138000",
          email: null,
        }),
        findFirst: vi.fn().mockResolvedValue({ id: "customer-2" }),
      },
    };
    const service = new CustomerAuthService(
      prisma as never,
      { get: vi.fn() } as never,
      { send: vi.fn() } as never,
      { send: vi.fn() } as never,
    );

    await expect(
      service.requestIdentityCode(
        "customer-1",
        VerificationChannel.EMAIL,
        "taken@example.com",
      ),
    ).rejects.toThrow("belongs to another account");
  });
});

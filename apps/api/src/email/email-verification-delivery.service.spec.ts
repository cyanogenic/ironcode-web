import { ServiceUnavailableException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { EmailVerificationDeliveryService } from "./email-verification-delivery.service";

describe("EmailVerificationDeliveryService", () => {
  it("sends the code through the configured SMTP transport", async () => {
    const config = {
      get: vi.fn((key: string) => {
        const values: Record<string, string> = {
          EMAIL_PROVIDER: "smtp",
          SMTP_FROM_NAME: "铁码维修",
          SMTP_FROM_ADDRESS: "noreply@example.com",
        };
        return values[key];
      }),
    };
    const transporter = { sendMail: vi.fn().mockResolvedValue({}) };
    const service = new EmailVerificationDeliveryService(
      config as never,
      transporter,
    );

    await service.send("customer@example.com", "123456");

    expect(transporter.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "customer@example.com",
        subject: "铁码维修登录验证码",
        text: expect.stringContaining("123456"),
      }),
    );
  });

  it("returns a service-unavailable error without exposing transport details", async () => {
    const config = {
      get: vi.fn((key: string) =>
        key === "EMAIL_PROVIDER" ? "smtp" : "noreply@example.com",
      ),
    };
    const transporter = {
      sendMail: vi.fn().mockRejectedValue(new Error("secret server detail")),
    };
    const service = new EmailVerificationDeliveryService(
      config as never,
      transporter,
    );

    await expect(
      service.send("customer@example.com", "123456"),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});

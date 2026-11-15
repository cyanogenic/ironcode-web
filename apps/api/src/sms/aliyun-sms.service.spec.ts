import { ServiceUnavailableException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { AliyunSmsService } from "./aliyun-sms.service";
import type { AliyunSmsClient } from "./sms.constants";

const settings = {
  ALIYUN_SMS_SIGN_NAME: "铁码维修",
  ALIYUN_SMS_TEMPLATE_CODE: "SMS_123456789",
};

function createService(sendSms: ReturnType<typeof vi.fn>) {
  const client = { sendSms } as unknown as AliyunSmsClient;
  const config = {
    get: vi.fn((key: keyof typeof settings) => settings[key]),
  };
  return new AliyunSmsService(client, config as never);
}

describe("AliyunSmsService", () => {
  it("sends the verification code using the approved sign and template", async () => {
    const sendSms = vi.fn().mockResolvedValue({
      body: { code: "OK", requestId: "request-1", bizId: "biz-1" },
    });
    const service = createService(sendSms);

    await service.sendVerificationCode("13800138000", "123456");

    expect(sendSms).toHaveBeenCalledOnce();
    expect(sendSms).toHaveBeenCalledWith(
      expect.objectContaining({
        phoneNumbers: "13800138000",
        signName: "铁码维修",
        templateCode: "SMS_123456789",
        templateParam: JSON.stringify({ code: "123456" }),
      }),
    );
  });

  it("hides provider details when Aliyun rejects a request", async () => {
    const service = createService(
      vi.fn().mockResolvedValue({
        body: { code: "isv.SMS_SIGNATURE_ILLEGAL", requestId: "request-2" },
      }),
    );

    await expect(
      service.sendVerificationCode("13800138000", "123456"),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it("maps SDK failures to a service unavailable response", async () => {
    const service = createService(
      vi.fn().mockRejectedValue(new Error("network unavailable")),
    );

    await expect(
      service.sendVerificationCode("13800138000", "123456"),
    ).rejects.toThrow("Verification code could not be sent");
  });
});

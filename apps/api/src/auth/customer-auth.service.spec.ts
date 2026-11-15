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
      get: vi.fn().mockReturnValue("otp-pepper-with-more-than-32-characters"),
    };
    const delivery = {
      send: vi.fn().mockRejectedValue(new Error("provider unavailable")),
    };
    const service = new CustomerAuthService(
      prisma as never,
      config as never,
      delivery as never,
    );

    await expect(service.requestCode("13800138000")).rejects.toThrow(
      "provider unavailable",
    );
    expect(prisma.otpChallenge.deleteMany).toHaveBeenCalledWith({
      where: { id: "challenge-1", consumedAt: null },
    });
  });
});

import { UserRole, UserStatus, type User } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Environment } from "../config/environment";
import type { PrismaService } from "../prisma/prisma.service";
import { AuthSessionService } from "./auth-session.service";

const customer = {
  id: "customer-1",
  role: UserRole.CUSTOMER,
  status: UserStatus.ACTIVE,
  phone: "13800138000",
  username: null,
  passwordHash: null,
  displayName: null,
  lastLoginAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
} satisfies User;

describe("AuthSessionService", () => {
  const session = {
    create: vi.fn(),
    findUnique: vi.fn(),
    updateMany: vi.fn(),
  };
  const prisma = { session } as unknown as PrismaService;
  const jwt = { signAsync: vi.fn().mockResolvedValue("access-token") };
  const config = {
    get: vi.fn((key: keyof Environment) =>
      key === "REFRESH_TOKEN_DAYS" ? 30 : undefined,
    ),
  };
  const service = new AuthSessionService(prisma, jwt as never, config as never);

  beforeEach(() => vi.clearAllMocks());

  it("creates a hashed refresh-token session without returning the hash", async () => {
    session.create.mockResolvedValue({});
    const result = await service.create(customer, { ipAddress: "127.0.0.1" });
    expect(result.accessToken).toBe("access-token");
    expect(result.refreshToken).toBeTruthy();
    expect(session.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: customer.id,
          refreshTokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        }),
      }),
    );
  });

  it("does not let a customer refresh through the staff session endpoint", async () => {
    session.findUnique.mockResolvedValue({
      id: "session-1",
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      user: customer,
    });
    await expect(service.refresh("token", {}, "staff")).rejects.toThrow(
      "Refresh token is invalid or expired",
    );
    expect(session.updateMany).not.toHaveBeenCalled();
  });

  it("rejects a refresh token that lost a concurrent rotation race", async () => {
    session.findUnique.mockResolvedValue({
      id: "session-1",
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      user: customer,
    });
    session.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.refresh("token", {}, "customer")).rejects.toThrow(
      "already been rotated",
    );
  });
});

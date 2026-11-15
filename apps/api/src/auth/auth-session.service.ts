import { createHash, randomBytes } from "node:crypto";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { UserRole, UserStatus, type User } from "@prisma/client";
import type { Environment } from "../config/environment";
import { PrismaService } from "../prisma/prisma.service";
import type { AccessTokenPayload, RequestContext } from "./auth.types";
import type { AuthAudience } from "./auth-cookie";

const ACCESS_TOKEN_SECONDS = 15 * 60;

@Injectable()
export class AuthSessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Environment, true>,
  ) {}

  async create(user: User, context: RequestContext) {
    const refreshToken = randomBytes(48).toString("base64url");
    const refreshTokenHash = this.hashRefreshToken(refreshToken);
    const refreshDays = this.config.get("REFRESH_TOKEN_DAYS", { infer: true });
    const expiresAt = new Date(Date.now() + refreshDays * 24 * 60 * 60 * 1000);

    await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash,
        expiresAt,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      },
    });

    return this.buildResult(user, refreshToken);
  }

  async refresh(
    refreshToken: string | undefined,
    context: RequestContext,
    audience: AuthAudience,
  ) {
    if (!refreshToken)
      throw new UnauthorizedException("Refresh token is missing");

    const now = new Date();
    const tokenHash = this.hashRefreshToken(refreshToken);
    const session = await this.prisma.session.findUnique({
      where: { refreshTokenHash: tokenHash },
      include: { user: true },
    });

    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= now ||
      session.user.status !== UserStatus.ACTIVE ||
      (audience === "customer" && session.user.role !== UserRole.CUSTOMER) ||
      (audience === "staff" && session.user.role === UserRole.CUSTOMER)
    ) {
      throw new UnauthorizedException("Refresh token is invalid or expired");
    }

    const rotatedToken = randomBytes(48).toString("base64url");
    const rotated = await this.prisma.session.updateMany({
      where: { id: session.id, refreshTokenHash: tokenHash, revokedAt: null },
      data: {
        refreshTokenHash: this.hashRefreshToken(rotatedToken),
        lastUsedAt: now,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      },
    });
    if (rotated.count !== 1) {
      throw new UnauthorizedException("Refresh token has already been rotated");
    }

    return this.buildResult(session.user, rotatedToken);
  }

  async revoke(refreshToken: string | undefined) {
    if (!refreshToken) return;
    await this.prisma.session.updateMany({
      where: {
        refreshTokenHash: this.hashRefreshToken(refreshToken),
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  }

  private async buildResult(user: User, refreshToken: string) {
    const payload: AccessTokenPayload = { sub: user.id, role: user.role };
    const accessToken = await this.jwt.signAsync(payload);
    return {
      accessToken,
      expiresIn: ACCESS_TOKEN_SECONDS,
      refreshToken,
      user: {
        id: user.id,
        role: user.role,
        phone: user.phone,
        username: user.username,
        displayName: user.displayName,
      },
    };
  }

  private hashRefreshToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }
}

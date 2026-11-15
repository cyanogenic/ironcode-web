import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { UserStatus } from "@prisma/client";
import { ExtractJwt, Strategy } from "passport-jwt";
import type { Environment } from "../config/environment";
import { PrismaService } from "../prisma/prisma.service";
import type { AccessTokenPayload, AuthenticatedUser } from "./auth.types";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService<Environment, true>,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get("JWT_ACCESS_SECRET", { infer: true }),
    });
  }

  async validate(payload: AccessTokenPayload): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        role: true,
        status: true,
        phone: true,
        email: true,
        username: true,
        displayName: true,
      },
    });
    if (
      !user ||
      user.status !== UserStatus.ACTIVE ||
      user.role !== payload.role
    ) {
      throw new UnauthorizedException();
    }
    return {
      id: user.id,
      role: user.role,
      phone: user.phone,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
    };
  }
}

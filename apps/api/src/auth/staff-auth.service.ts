import { Injectable, UnauthorizedException } from "@nestjs/common";
import { UserRole, UserStatus } from "@prisma/client";
import { verify } from "argon2";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class StaffAuthService {
  constructor(private readonly prisma: PrismaService) {}

  async verifyCredentials(username: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { username } });
    const valid = user?.passwordHash
      ? await verify(user.passwordHash, password)
      : false;

    if (
      !user ||
      !valid ||
      user.status !== UserStatus.ACTIVE ||
      user.role === UserRole.CUSTOMER
    ) {
      throw new UnauthorizedException("Username or password is incorrect");
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    return user;
  }
}

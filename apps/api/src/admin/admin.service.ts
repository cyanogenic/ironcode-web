import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, UserRole, UserStatus } from "@prisma/client";
import { hash } from "argon2";
import { PrismaService } from "../prisma/prisma.service";
import type {
  CreateEngineerDto,
  ResetStaffPasswordDto,
  UpdateStaffDto,
  UpdateStoreDto,
} from "./admin.dto";

const staffSelect = {
  id: true,
  username: true,
  displayName: true,
  role: true,
  status: true,
  lastLoginAt: true,
  createdAt: true,
  storeMemberships: {
    select: {
      id: true,
      title: true,
      active: true,
      store: { select: { id: true, code: true, name: true } },
    },
  },
} satisfies Prisma.UserSelect;

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  listStaff() {
    return this.prisma.user.findMany({
      where: { role: { in: [UserRole.ENGINEER, UserRole.ADMIN] } },
      select: staffSelect,
      orderBy: [{ role: "desc" }, { createdAt: "asc" }],
    });
  }

  async createEngineer(input: CreateEngineerDto, adminId: string) {
    const store = await this.prisma.store.findFirst({
      where: { id: input.storeId, active: true },
    });
    if (!store) throw new NotFoundException("Store not found");

    try {
      const engineer = await this.prisma.$transaction(async (transaction) => {
        const user = await transaction.user.create({
          data: {
            username: input.username,
            passwordHash: await hash(input.password),
            displayName: input.displayName,
            role: UserRole.ENGINEER,
          },
        });
        await transaction.storeMember.create({
          data: {
            storeId: store.id,
            userId: user.id,
            title: input.title,
          },
        });
        await transaction.auditLog.create({
          data: {
            actorId: adminId,
            action: "staff.create",
            resource: "User",
            resourceId: user.id,
            metadata: { role: UserRole.ENGINEER, storeId: store.id },
          },
        });
        return user;
      });
      return this.prisma.user.findUniqueOrThrow({
        where: { id: engineer.id },
        select: staffSelect,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException("Username already exists");
      }
      throw error;
    }
  }

  async updateStaff(staffId: string, input: UpdateStaffDto, adminId: string) {
    const staff = await this.prisma.user.findFirst({
      where: { id: staffId, role: { in: [UserRole.ENGINEER, UserRole.ADMIN] } },
    });
    if (!staff) throw new NotFoundException("Staff account not found");
    if (staffId === adminId && input.status === UserStatus.DISABLED) {
      throw new ConflictException("You cannot disable your own account");
    }

    await this.prisma.$transaction(async (transaction) => {
      await transaction.user.update({
        where: { id: staffId },
        data: input,
      });
      if (input.status === UserStatus.DISABLED) {
        await transaction.session.updateMany({
          where: { userId: staffId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      await transaction.auditLog.create({
        data: {
          actorId: adminId,
          action: "staff.update",
          resource: "User",
          resourceId: staffId,
          metadata: { ...input },
        },
      });
    });
    return this.prisma.user.findUniqueOrThrow({
      where: { id: staffId },
      select: staffSelect,
    });
  }

  async resetPassword(
    staffId: string,
    input: ResetStaffPasswordDto,
    adminId: string,
  ) {
    const staff = await this.prisma.user.findFirst({
      where: { id: staffId, role: { in: [UserRole.ENGINEER, UserRole.ADMIN] } },
    });
    if (!staff) throw new NotFoundException("Staff account not found");

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: staffId },
        data: { passwordHash: await hash(input.password) },
      }),
      this.prisma.session.updateMany({
        where: { userId: staffId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      this.prisma.auditLog.create({
        data: {
          actorId: adminId,
          action: "staff.reset-password",
          resource: "User",
          resourceId: staffId,
        },
      }),
    ]);
    return { reset: true };
  }

  listStores() {
    return this.prisma.store.findMany({ orderBy: { code: "asc" } });
  }

  async updateStore(storeId: string, input: UpdateStoreDto, adminId: string) {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
    });
    if (!store) throw new NotFoundException("Store not found");
    const updated = await this.prisma.store.update({
      where: { id: storeId },
      data: input,
    });
    await this.prisma.auditLog.create({
      data: {
        actorId: adminId,
        action: "store.update",
        resource: "Store",
        resourceId: storeId,
        metadata: { ...input },
      },
    });
    return updated;
  }
}

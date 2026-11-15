import { randomInt } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  ConsentType,
  Prisma,
  RepairOrderStatus,
  ServiceMode,
  UserRole,
  UserStatus,
} from "@prisma/client";
import type { AuthenticatedUser } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateOrderDto } from "./dto/create-order.dto";
import type {
  AssignEngineerDto,
  StaffOrderQueryDto,
  TransitionOrderDto,
} from "./dto/staff-order.dto";
import { OrderStateService } from "./order-state.service";

const orderInclude = {
  device: true,
  address: true,
  store: {
    select: { id: true, code: true, name: true, address: true, phone: true },
  },
  assignedEngineer: { select: { id: true, displayName: true } },
  statusHistory: {
    orderBy: { createdAt: "asc" as const },
    select: { fromStatus: true, toStatus: true, reason: true, createdAt: true },
  },
  inspections: {
    orderBy: { revision: "desc" as const },
    take: 1,
    select: {
      id: true,
      revision: true,
      cause: true,
      solution: true,
      notes: true,
      createdAt: true,
    },
  },
  quotes: {
    where: { status: { not: "DRAFT" as const } },
    orderBy: { revision: "desc" as const },
    include: { items: true },
  },
  attachments: {
    where: { uploadStatus: "VERIFIED" as const, deletedAt: null },
    select: {
      id: true,
      kind: true,
      originalName: true,
      contentType: true,
      verifiedAt: true,
    },
  },
  payments: {
    orderBy: { createdAt: "desc" as const },
    select: {
      id: true,
      provider: true,
      status: true,
      amount: true,
      merchantPaymentNo: true,
      paidAt: true,
      refundedAt: true,
      createdAt: true,
    },
  },
} satisfies Prisma.RepairOrderInclude;

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly states: OrderStateService,
  ) {}

  async create(customerId: string, input: CreateOrderDto, ipAddress?: string) {
    this.validateAppointment(input);
    const store = await this.prisma.store.findFirst({
      where: { code: "main", active: true },
    });
    if (!store)
      throw new BadRequestException("The service store is not configured");

    return this.prisma.$transaction(async (transaction) => {
      const device = await transaction.device.create({
        data: { userId: customerId, ...input.device },
      });
      const address = input.address
        ? await transaction.address.create({
            data: { userId: customerId, ...input.address },
          })
        : null;

      return transaction.repairOrder.create({
        data: {
          orderNo: this.createOrderNumber(),
          customerId,
          storeId: store.id,
          deviceId: device.id,
          addressId: address?.id,
          serviceMode: input.serviceMode,
          problemDescription: input.problemDescription,
          scheduledStart: new Date(input.scheduledStart),
          scheduledEnd: new Date(input.scheduledEnd),
          statusHistory: {
            create: {
              toStatus: RepairOrderStatus.APPOINTMENT_PENDING,
              actorId: customerId,
              reason: "Customer created appointment",
            },
          },
          consents: {
            create: [ConsentType.SERVICE_TERMS, ConsentType.PRIVACY_POLICY].map(
              (type) => ({
                type,
                granted: true,
                policyVersion: input.policyVersion,
                ipAddress,
                grantedBy: { connect: { id: customerId } },
              }),
            ),
          },
        },
        include: orderInclude,
      });
    });
  }

  listForCustomer(customerId: string) {
    return this.prisma.repairOrder.findMany({
      where: { customerId },
      include: orderInclude,
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  async getForCustomer(customerId: string, orderId: string) {
    const order = await this.prisma.repairOrder.findFirst({
      where: { id: orderId, customerId },
      include: orderInclude,
    });
    if (!order) throw new NotFoundException("Order not found");
    return order;
  }

  async cancelForCustomer(
    customerId: string,
    orderId: string,
    reason?: string,
  ) {
    const order = await this.getForCustomer(customerId, orderId);
    this.states.assertCustomerCanCancel(order.status);

    await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.repairOrder.updateMany({
        where: { id: order.id, customerId, version: order.version },
        data: {
          status: RepairOrderStatus.CANCELED,
          canceledAt: new Date(),
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1)
        throw new ConflictException("Order was updated; please retry");
      await transaction.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: RepairOrderStatus.CANCELED,
          actorId: customerId,
          reason: reason || "Customer canceled appointment",
        },
      });
    });
    return this.getForCustomer(customerId, orderId);
  }

  listForStaff(user: AuthenticatedUser, query: StaffOrderQueryDto) {
    return this.prisma.repairOrder.findMany({
      where: {
        status: query.status,
        ...(user.role === UserRole.ENGINEER
          ? { assignedEngineerId: user.id }
          : {}),
      },
      include: orderInclude,
      orderBy: [{ scheduledStart: "asc" }, { createdAt: "desc" }],
      take: Math.min(query.limit, 100),
    });
  }

  async getForStaff(user: AuthenticatedUser, orderId: string) {
    const order = await this.prisma.repairOrder.findUnique({
      where: { id: orderId },
      include: orderInclude,
    });
    if (!order) throw new NotFoundException("Order not found");
    if (
      user.role === UserRole.ENGINEER &&
      order.assignedEngineerId !== user.id
    ) {
      throw new ForbiddenException("Order is not assigned to this engineer");
    }
    return order;
  }

  async assignEngineer(
    orderId: string,
    input: AssignEngineerDto,
    adminId: string,
  ) {
    const order = await this.prisma.repairOrder.findUnique({
      where: { id: orderId },
    });
    if (!order) throw new NotFoundException("Order not found");
    const engineer = await this.prisma.user.findFirst({
      where: {
        id: input.engineerId,
        role: UserRole.ENGINEER,
        status: UserStatus.ACTIVE,
        storeMemberships: { some: { storeId: order.storeId, active: true } },
      },
    });
    if (!engineer)
      throw new BadRequestException("Engineer is not active at this store");

    const updated = await this.prisma.repairOrder.updateMany({
      where: { id: orderId, version: input.expectedVersion },
      data: { assignedEngineerId: engineer.id, version: { increment: 1 } },
    });
    if (updated.count !== 1)
      throw new ConflictException("Order was updated; please retry");
    await this.prisma.auditLog.create({
      data: {
        actorId: adminId,
        action: "order.assign-engineer",
        resource: "RepairOrder",
        resourceId: orderId,
        metadata: { engineerId: engineer.id },
      },
    });
    return this.getForStaff(
      { id: adminId, role: UserRole.ADMIN } as AuthenticatedUser,
      orderId,
    );
  }

  async transitionForStaff(
    user: AuthenticatedUser,
    orderId: string,
    input: TransitionOrderDto,
  ) {
    const order = await this.getForStaff(user, orderId);
    this.states.assertStaffTransition(order.status, input.toStatus);
    if (
      order.status === RepairOrderStatus.WAITING_REPAIR &&
      input.toStatus === RepairOrderStatus.REPAIRING
    ) {
      const acceptedQuote = order.quotes.find(
        (quote) => quote.status === "ACCEPTED",
      );
      const paid = order.payments.some(
        (payment) => payment.status === "SUCCEEDED",
      );
      if (acceptedQuote && acceptedQuote.total.greaterThan(0) && !paid) {
        throw new BadRequestException(
          "Payment must be recorded before repair begins",
        );
      }
    }

    await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.repairOrder.updateMany({
        where: { id: order.id, version: input.expectedVersion },
        data: {
          status: input.toStatus,
          version: { increment: 1 },
          ...(input.toStatus === RepairOrderStatus.COMPLETED
            ? { completedAt: new Date() }
            : {}),
        },
      });
      if (updated.count !== 1)
        throw new ConflictException("Order was updated; please retry");
      await transaction.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: input.toStatus,
          actorId: user.id,
          reason: input.reason,
        },
      });
    });
    return this.getForStaff(user, orderId);
  }

  private validateAppointment(input: CreateOrderDto) {
    if (!input.acceptedServiceTerms || !input.acceptedPrivacyPolicy) {
      throw new BadRequestException(
        "Service terms and privacy policy must be accepted",
      );
    }
    if (input.serviceMode === ServiceMode.ONSITE && !input.address) {
      throw new BadRequestException(
        "An address is required for onsite service",
      );
    }
    const start = new Date(input.scheduledStart);
    const end = new Date(input.scheduledEnd);
    if (
      start <= new Date() ||
      end <= start ||
      end.getTime() - start.getTime() > 8 * 60 * 60 * 1000
    ) {
      throw new BadRequestException("Appointment time range is invalid");
    }
  }

  private createOrderNumber() {
    const parts = new Intl.DateTimeFormat("zh-CN", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date());
    const value = Object.fromEntries(
      parts.map((part) => [part.type, part.value]),
    );
    return `WX${value.year}${value.month}${value.day}${value.hour}${value.minute}${value.second}${randomInt(1000, 10000)}`;
  }
}

import { randomInt } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  Injectable,
} from "@nestjs/common";
import { PaymentProvider, PaymentStatus, QuoteStatus } from "@prisma/client";
import type { AuthenticatedUser } from "../auth/auth.types";
import { OrdersService } from "../orders/orders.service";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
  ) {}

  async recordInStorePayment(user: AuthenticatedUser, orderId: string) {
    await this.orders.getForStaff(user, orderId);
    const quote = await this.prisma.quote.findFirst({
      where: { orderId, status: QuoteStatus.ACCEPTED },
      orderBy: { revision: "desc" },
    });
    if (!quote)
      throw new BadRequestException("Order does not have an accepted quote");

    const duplicate = await this.prisma.payment.findFirst({
      where: {
        orderId,
        status: { in: [PaymentStatus.PENDING, PaymentStatus.SUCCEEDED] },
      },
    });
    if (duplicate)
      throw new ConflictException("Order already has an active payment");

    const payment = await this.prisma.$transaction(async (transaction) => {
      const created = await transaction.payment.create({
        data: {
          orderId,
          provider: PaymentProvider.IN_STORE,
          status: PaymentStatus.SUCCEEDED,
          amount: quote.total,
          merchantPaymentNo: this.createPaymentNumber(),
          paidAt: new Date(),
        },
      });
      await transaction.auditLog.create({
        data: {
          actorId: user.id,
          action: "payment.in-store.record",
          resource: "Payment",
          resourceId: created.id,
          metadata: { orderId, amount: quote.total.toString() },
        },
      });
      return created;
    });
    return payment;
  }

  private createPaymentNumber() {
    return `PAY${Date.now()}${randomInt(1000, 10000)}`;
  }
}

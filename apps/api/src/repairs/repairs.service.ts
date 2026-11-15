import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, QuoteStatus, RepairOrderStatus } from "@prisma/client";
import type { AuthenticatedUser } from "../auth/auth.types";
import { OrdersService } from "../orders/orders.service";
import { PrismaService } from "../prisma/prisma.service";
import type { QuoteDecisionDto, SubmitInspectionDto } from "./repair.dto";

@Injectable()
export class RepairsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
  ) {}

  async submitInspection(
    user: AuthenticatedUser,
    orderId: string,
    input: SubmitInspectionDto,
  ) {
    const order = await this.orders.getForStaff(user, orderId);
    if (order.status !== RepairOrderStatus.DIAGNOSING) {
      throw new BadRequestException(
        "Inspection can only be submitted while diagnosing",
      );
    }

    await this.prisma.$transaction(async (transaction) => {
      const [lastInspection, lastQuote] = await Promise.all([
        transaction.inspectionReport.aggregate({
          where: { orderId },
          _max: { revision: true },
        }),
        transaction.quote.aggregate({
          where: { orderId },
          _max: { revision: true },
        }),
      ]);
      const itemData = input.items.map((item) => {
        const unitPrice = new Prisma.Decimal(item.unitPriceFen).div(100);
        return { ...item, unitPrice, total: unitPrice.mul(item.quantity) };
      });
      const total = itemData.reduce(
        (sum, item) => sum.add(item.total),
        new Prisma.Decimal(0),
      );

      await transaction.inspectionReport.create({
        data: {
          orderId,
          engineerId: user.id,
          revision: (lastInspection._max.revision ?? 0) + 1,
          cause: input.cause,
          solution: input.solution,
          notes: input.notes,
        },
      });
      await transaction.quote.create({
        data: {
          orderId,
          createdById: user.id,
          revision: (lastQuote._max.revision ?? 0) + 1,
          status: QuoteStatus.PENDING_CUSTOMER,
          subtotal: total,
          total,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          items: {
            create: itemData.map(
              ({ unitPriceFen: _unitPriceFen, ...item }) => item,
            ),
          },
        },
      });
      const updated = await transaction.repairOrder.updateMany({
        where: {
          id: orderId,
          version: input.expectedVersion,
          status: RepairOrderStatus.DIAGNOSING,
        },
        data: {
          status: RepairOrderStatus.QUOTE_PENDING_CUSTOMER,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1)
        throw new ConflictException("Order was updated; please retry");
      await transaction.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: RepairOrderStatus.DIAGNOSING,
          toStatus: RepairOrderStatus.QUOTE_PENDING_CUSTOMER,
          actorId: user.id,
          reason: "Inspection report and quote submitted",
        },
      });
    });
    return this.orders.getForStaff(user, orderId);
  }

  async decideQuote(
    customerId: string,
    orderId: string,
    quoteId: string,
    decision: "accept" | "reject",
    input: QuoteDecisionDto,
  ) {
    const order = await this.orders.getForCustomer(customerId, orderId);
    if (order.status !== RepairOrderStatus.QUOTE_PENDING_CUSTOMER) {
      throw new BadRequestException(
        "Order is not waiting for a quote decision",
      );
    }
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, orderId, status: QuoteStatus.PENDING_CUSTOMER },
    });
    if (!quote) throw new NotFoundException("Pending quote not found");
    if (quote.expiresAt && quote.expiresAt <= new Date()) {
      throw new BadRequestException("Quote has expired");
    }

    const quoteStatus =
      decision === "accept" ? QuoteStatus.ACCEPTED : QuoteStatus.REJECTED;
    const orderStatus =
      decision === "accept"
        ? RepairOrderStatus.WAITING_REPAIR
        : RepairOrderStatus.QUOTE_REJECTED;
    await this.prisma.$transaction(async (transaction) => {
      const quoteUpdate = await transaction.quote.updateMany({
        where: { id: quoteId, status: QuoteStatus.PENDING_CUSTOMER },
        data: { status: quoteStatus, respondedAt: new Date() },
      });
      const orderUpdate = await transaction.repairOrder.updateMany({
        where: {
          id: orderId,
          customerId,
          version: input.expectedVersion,
          status: RepairOrderStatus.QUOTE_PENDING_CUSTOMER,
        },
        data: { status: orderStatus, version: { increment: 1 } },
      });
      if (quoteUpdate.count !== 1 || orderUpdate.count !== 1) {
        throw new ConflictException("Quote or order was updated; please retry");
      }
      await transaction.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: RepairOrderStatus.QUOTE_PENDING_CUSTOMER,
          toStatus: orderStatus,
          actorId: customerId,
          reason:
            decision === "accept"
              ? "Customer accepted quote"
              : "Customer rejected quote",
        },
      });
    });
    return this.orders.getForCustomer(customerId, orderId);
  }
}

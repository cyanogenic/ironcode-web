import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { TicketStatus, UserRole } from "@prisma/client";
import type { AuthenticatedUser } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateTicketDto } from "./ticket.dto";

const ticketInclude = {
  order: { select: { id: true, orderNo: true, status: true } },
  createdBy: { select: { id: true, displayName: true, phone: true } },
  messages: {
    orderBy: { createdAt: "asc" as const },
    include: {
      author: {
        select: { id: true, role: true, displayName: true, username: true },
      },
    },
  },
};

@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(customerId: string, input: CreateTicketDto) {
    if (input.orderId) {
      const order = await this.prisma.repairOrder.findFirst({
        where: { id: input.orderId, customerId },
      });
      if (!order) throw new NotFoundException("Order not found");
    }
    return this.prisma.supportTicket.create({
      data: {
        createdById: customerId,
        orderId: input.orderId,
        subject: input.subject,
        status: TicketStatus.WAITING_STAFF,
        messages: { create: { authorId: customerId, body: input.body } },
      },
      include: ticketInclude,
    });
  }

  listForCustomer(customerId: string) {
    return this.prisma.supportTicket.findMany({
      where: { createdById: customerId },
      include: ticketInclude,
      orderBy: { updatedAt: "desc" },
    });
  }

  listForStaff() {
    return this.prisma.supportTicket.findMany({
      include: ticketInclude,
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      take: 100,
    });
  }

  async get(user: AuthenticatedUser, ticketId: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: ticketInclude,
    });
    if (
      !ticket ||
      (user.role === UserRole.CUSTOMER && ticket.createdById !== user.id)
    ) {
      throw new NotFoundException("Ticket not found");
    }
    return ticket;
  }

  async reply(user: AuthenticatedUser, ticketId: string, body: string) {
    const ticket = await this.get(user, ticketId);
    if (
      ticket.status === TicketStatus.RESOLVED ||
      ticket.status === TicketStatus.CLOSED
    ) {
      throw new BadRequestException(
        "Closed ticket cannot receive new messages",
      );
    }
    const status =
      user.role === UserRole.CUSTOMER
        ? TicketStatus.WAITING_STAFF
        : TicketStatus.WAITING_CUSTOMER;
    await this.prisma.$transaction([
      this.prisma.ticketMessage.create({
        data: { ticketId, authorId: user.id, body },
      }),
      this.prisma.supportTicket.update({
        where: { id: ticketId },
        data: { status },
      }),
      this.prisma.auditLog.create({
        data: {
          actorId: user.id,
          action: "ticket.reply",
          resource: "SupportTicket",
          resourceId: ticketId,
        },
      }),
    ]);
    return this.get(user, ticketId);
  }

  async close(user: AuthenticatedUser, ticketId: string) {
    await this.get(user, ticketId);
    await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status: TicketStatus.CLOSED },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: "ticket.close",
        resource: "SupportTicket",
        resourceId: ticketId,
      },
    });
    return this.get(user, ticketId);
  }
}

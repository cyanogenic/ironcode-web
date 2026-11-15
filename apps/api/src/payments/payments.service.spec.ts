import { Prisma, QuoteStatus, UserRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedUser } from "../auth/auth.types";
import type { OrdersService } from "../orders/orders.service";
import type { PrismaService } from "../prisma/prisma.service";
import { PaymentsService } from "./payments.service";

describe("PaymentsService", () => {
  const transaction = {
    payment: { create: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  const prisma = {
    quote: { findFirst: vi.fn() },
    payment: { findFirst: vi.fn() },
    $transaction: vi.fn((callback: (client: typeof transaction) => unknown) =>
      callback(transaction),
    ),
  } as unknown as PrismaService;
  const orders = { getForStaff: vi.fn() } as unknown as OrdersService;
  const service = new PaymentsService(prisma, orders);
  const admin: AuthenticatedUser = {
    id: "admin-1",
    role: UserRole.ADMIN,
    phone: null,
    username: "admin",
    displayName: "Admin",
  };

  beforeEach(() => vi.clearAllMocks());

  it("rejects payment before a quote is accepted", async () => {
    vi.mocked(orders.getForStaff).mockResolvedValue({} as never);
    vi.mocked(prisma.quote.findFirst).mockResolvedValue(null);
    await expect(
      service.recordInStorePayment(admin, "order-1"),
    ).rejects.toThrow("does not have an accepted quote");
  });

  it("records exactly the accepted quote total and audits it", async () => {
    const total = new Prisma.Decimal("680.00");
    vi.mocked(orders.getForStaff).mockResolvedValue({} as never);
    vi.mocked(prisma.quote.findFirst).mockResolvedValue({
      id: "quote-1",
      orderId: "order-1",
      status: QuoteStatus.ACCEPTED,
      total,
    } as never);
    vi.mocked(prisma.payment.findFirst).mockResolvedValue(null);
    transaction.payment.create.mockResolvedValue({
      id: "payment-1",
      amount: total,
    });
    transaction.auditLog.create.mockResolvedValue({});

    await service.recordInStorePayment(admin, "order-1");
    expect(transaction.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amount: total }),
      }),
    );
    expect(transaction.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "payment.in-store.record" }),
      }),
    );
  });
});

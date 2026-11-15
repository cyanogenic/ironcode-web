import { RepairOrderStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { OrderStateService } from "./order-state.service";

describe("OrderStateService", () => {
  const service = new OrderStateService();

  it("allows the normal intake progression", () => {
    expect(() =>
      service.assertStaffTransition(
        RepairOrderStatus.APPOINTMENT_CONFIRMED,
        RepairOrderStatus.RECEIVED,
      ),
    ).not.toThrow();
  });

  it("does not let staff skip customer quote approval", () => {
    expect(() =>
      service.assertStaffTransition(
        RepairOrderStatus.QUOTE_PENDING_CUSTOMER,
        RepairOrderStatus.WAITING_REPAIR,
      ),
    ).toThrow(/cannot transition/);
  });

  it("only lets customers cancel before service begins", () => {
    expect(() =>
      service.assertCustomerCanCancel(RepairOrderStatus.APPOINTMENT_PENDING),
    ).not.toThrow();
    expect(() =>
      service.assertCustomerCanCancel(RepairOrderStatus.DIAGNOSING),
    ).toThrow(/no longer be canceled/);
  });
});

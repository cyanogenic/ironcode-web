import { BadRequestException, Injectable } from "@nestjs/common";
import { RepairOrderStatus } from "@prisma/client";

const staffTransitions: Partial<
  Record<RepairOrderStatus, readonly RepairOrderStatus[]>
> = {
  APPOINTMENT_PENDING: [RepairOrderStatus.APPOINTMENT_CONFIRMED],
  APPOINTMENT_CONFIRMED: [RepairOrderStatus.RECEIVED],
  RECEIVED: [RepairOrderStatus.DIAGNOSING],
  DIAGNOSING: [RepairOrderStatus.QUOTE_PENDING_CUSTOMER],
  QUOTE_REJECTED: [RepairOrderStatus.DIAGNOSING],
  WAITING_REPAIR: [RepairOrderStatus.REPAIRING],
  REPAIRING: [RepairOrderStatus.TESTING],
  TESTING: [RepairOrderStatus.READY_FOR_DELIVERY],
  READY_FOR_DELIVERY: [RepairOrderStatus.COMPLETED],
  COMPLETED: [RepairOrderStatus.WARRANTY_RETURN],
  WARRANTY_RETURN: [RepairOrderStatus.DIAGNOSING],
};

const customerCancelable = new Set<RepairOrderStatus>([
  RepairOrderStatus.APPOINTMENT_PENDING,
  RepairOrderStatus.APPOINTMENT_CONFIRMED,
]);

@Injectable()
export class OrderStateService {
  assertStaffTransition(from: RepairOrderStatus, to: RepairOrderStatus) {
    if (!staffTransitions[from]?.includes(to)) {
      throw new BadRequestException(
        `Order cannot transition from ${from} to ${to}`,
      );
    }
  }

  assertCustomerCanCancel(status: RepairOrderStatus) {
    if (!customerCancelable.has(status)) {
      throw new BadRequestException(
        "This order can no longer be canceled online",
      );
    }
  }
}

export type UserRole = "CUSTOMER" | "ENGINEER" | "ADMIN";

export interface AuthUser {
  id: string;
  role: UserRole;
  phone: string | null;
  username: string | null;
  displayName: string | null;
}

export interface AuthResponse {
  accessToken: string;
  expiresIn: number;
  user: AuthUser;
}

export interface ApiErrorBody {
  statusCode?: number;
  message?: string | string[];
  error?: string;
}

export type ServiceMode = "ONSITE" | "IN_STORE";

export type RepairOrderStatus =
  | "APPOINTMENT_PENDING"
  | "APPOINTMENT_CONFIRMED"
  | "RECEIVED"
  | "DIAGNOSING"
  | "QUOTE_PENDING_CUSTOMER"
  | "QUOTE_REJECTED"
  | "WAITING_REPAIR"
  | "REPAIRING"
  | "TESTING"
  | "READY_FOR_DELIVERY"
  | "COMPLETED"
  | "CANCELED"
  | "WARRANTY_RETURN";

export interface RepairOrder {
  id: string;
  orderNo: string;
  serviceMode: ServiceMode;
  status: RepairOrderStatus;
  problemDescription: string;
  scheduledStart: string;
  scheduledEnd: string;
  version: number;
  createdAt: string;
  device: {
    category: string;
    brand: string | null;
    model: string;
    serialNo: string | null;
  } | null;
  address: {
    recipient: string;
    phone: string;
    province: string;
    city: string;
    district: string;
    detail: string;
  } | null;
  store: {
    id: string;
    code: string;
    name: string;
    address: string | null;
    phone: string | null;
  };
  assignedEngineer: { id: string; displayName: string | null } | null;
  statusHistory: Array<{
    fromStatus: RepairOrderStatus | null;
    toStatus: RepairOrderStatus;
    reason: string | null;
    createdAt: string;
  }>;
  inspections: Array<{
    id: string;
    revision: number;
    cause: string;
    solution: string;
    notes: string | null;
    createdAt: string;
  }>;
  quotes: Array<{
    id: string;
    revision: number;
    status:
      | "PENDING_CUSTOMER"
      | "ACCEPTED"
      | "REJECTED"
      | "EXPIRED"
      | "SUPERSEDED";
    subtotal: string;
    total: string;
    expiresAt: string | null;
    items: Array<{
      id: string;
      name: string;
      description: string | null;
      quantity: number;
      unitPrice: string;
      total: string;
    }>;
  }>;
  attachments: Array<{
    id: string;
    kind: string;
    originalName: string;
    contentType: string;
    verifiedAt: string | null;
  }>;
  payments: Array<{
    id: string;
    provider: "IN_STORE" | "WECHAT_PAY" | "ALIPAY";
    status:
      | "PENDING"
      | "SUCCEEDED"
      | "FAILED"
      | "REFUND_PENDING"
      | "REFUNDED"
      | "CANCELED";
    amount: string;
    merchantPaymentNo: string;
    paidAt: string | null;
    refundedAt: string | null;
    createdAt: string;
  }>;
}

export interface CreateOrderInput {
  serviceMode: ServiceMode;
  problemDescription: string;
  scheduledStart: string;
  scheduledEnd: string;
  device: {
    category: string;
    brand?: string;
    model: string;
    serialNo?: string;
  };
  address?: {
    recipient: string;
    phone: string;
    province: string;
    city: string;
    district: string;
    detail: string;
  };
  acceptedServiceTerms: boolean;
  acceptedPrivacyPolicy: boolean;
  policyVersion: string;
}

export interface StoreRecord {
  id: string;
  code: string;
  name: string;
  timezone: string;
  address: string | null;
  phone: string | null;
  active: boolean;
}

export interface StaffAccount {
  id: string;
  username: string | null;
  displayName: string | null;
  role: "ENGINEER" | "ADMIN";
  status: "ACTIVE" | "DISABLED";
  lastLoginAt: string | null;
  createdAt: string;
  storeMemberships: Array<{
    id: string;
    title: string | null;
    active: boolean;
    store: Pick<StoreRecord, "id" | "code" | "name">;
  }>;
}

export type TicketStatus =
  | "OPEN"
  | "WAITING_CUSTOMER"
  | "WAITING_STAFF"
  | "RESOLVED"
  | "CLOSED";

export interface SupportTicket {
  id: string;
  subject: string;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
  order: { id: string; orderNo: string; status: RepairOrderStatus } | null;
  createdBy: { id: string; displayName: string | null; phone: string | null };
  messages: Array<{
    id: string;
    body: string;
    createdAt: string;
    author: {
      id: string;
      role: UserRole;
      displayName: string | null;
      username: string | null;
    };
  }>;
}

import type {
  ApiErrorBody,
  AuthResponse,
  RepairOrder,
  RepairOrderStatus,
  StaffAccount,
  StoreRecord,
  SupportTicket,
} from "@ironcode/contracts";

let accessToken: string | null = null;

async function parse<T>(response: Response): Promise<T> {
  if (response.ok)
    return response.status === 204 ? (undefined as T) : response.json();
  const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
  const message = Array.isArray(body.message)
    ? body.message.join("；")
    : body.message;
  throw new Error(message || "请求失败，请稍后重试");
}

export async function staffLogin(username: string, password: string) {
  const result = await parse<AuthResponse>(
    await fetch("/api/auth/staff/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username, password }),
    }),
  );
  accessToken = result.accessToken;
  return result;
}

export async function refreshSession() {
  const result = await parse<AuthResponse>(
    await fetch("/api/auth/session/staff/refresh", {
      method: "POST",
      credentials: "include",
    }),
  );
  accessToken = result.accessToken;
  return result;
}

export async function logout() {
  const result = await parse<void>(
    await fetch("/api/auth/session/staff/logout", {
      method: "POST",
      credentials: "include",
    }),
  );
  accessToken = null;
  return result;
}

async function authenticatedFetch<T>(path: string, init: RequestInit = {}) {
  if (!accessToken) await refreshSession();
  let response = await fetch(path, {
    ...init,
    headers: { ...init.headers, authorization: `Bearer ${accessToken}` },
  });
  if (response.status === 401) {
    await refreshSession();
    response = await fetch(path, {
      ...init,
      headers: { ...init.headers, authorization: `Bearer ${accessToken}` },
    });
  }
  return parse<T>(response);
}

export function listStaffOrders() {
  return authenticatedFetch<RepairOrder[]>("/api/staff/orders");
}

export function transitionOrder(
  orderId: string,
  toStatus: RepairOrderStatus,
  expectedVersion: number,
) {
  return authenticatedFetch<RepairOrder>(
    `/api/staff/orders/${orderId}/status`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ toStatus, expectedVersion }),
    },
  );
}

export function assignEngineer(
  orderId: string,
  engineerId: string,
  expectedVersion: number,
) {
  return authenticatedFetch<RepairOrder>(
    `/api/staff/orders/${orderId}/engineer`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ engineerId, expectedVersion }),
    },
  );
}

export function submitInspection(
  orderId: string,
  input: {
    cause: string;
    solution: string;
    notes?: string;
    expectedVersion: number;
    items: Array<{ name: string; quantity: number; unitPriceFen: number }>;
  },
) {
  return authenticatedFetch<RepairOrder>(
    `/api/staff/orders/${orderId}/inspection`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    },
  );
}

export async function uploadInspectionPhoto(orderId: string, file: File) {
  const upload = await authenticatedFetch<{
    attachmentId: string;
    uploadUrl: string;
    requiredHeaders: Record<string, string>;
  }>(`/api/orders/${orderId}/attachments/uploads`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      kind: "INSPECTION_PHOTO",
      originalName: file.name,
      contentType: file.type,
      size: file.size,
    }),
  });
  const response = await fetch(upload.uploadUrl, {
    method: "PUT",
    headers: upload.requiredHeaders,
    body: file,
  });
  if (!response.ok) throw new Error("照片上传到 R2 失败");
  await authenticatedFetch(
    `/api/orders/${orderId}/attachments/${upload.attachmentId}/complete`,
    {
      method: "POST",
    },
  );
}

export function recordInStorePayment(orderId: string) {
  return authenticatedFetch(`/api/staff/orders/${orderId}/payments/in-store`, {
    method: "POST",
  });
}

export function listStaffAccounts() {
  return authenticatedFetch<StaffAccount[]>("/api/admin/staff");
}

export function createEngineer(input: {
  username: string;
  password: string;
  displayName: string;
  storeId: string;
  title?: string;
}) {
  return authenticatedFetch<StaffAccount>("/api/admin/staff", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function updateStaffAccount(
  staffId: string,
  input: { status: "ACTIVE" | "DISABLED" },
) {
  return authenticatedFetch<StaffAccount>(`/api/admin/staff/${staffId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function listStores() {
  return authenticatedFetch<StoreRecord[]>("/api/admin/stores");
}

export function updateStore(
  storeId: string,
  input: { name: string; address?: string; phone?: string },
) {
  return authenticatedFetch<StoreRecord>(`/api/admin/stores/${storeId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function listStaffTickets() {
  return authenticatedFetch<SupportTicket[]>("/api/staff/tickets");
}

export function replyStaffTicket(ticketId: string, body: string) {
  return authenticatedFetch<SupportTicket>(
    `/api/staff/tickets/${ticketId}/messages`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body }),
    },
  );
}

export function closeStaffTicket(ticketId: string) {
  return authenticatedFetch<SupportTicket>(
    `/api/staff/tickets/${ticketId}/close`,
    {
      method: "POST",
    },
  );
}

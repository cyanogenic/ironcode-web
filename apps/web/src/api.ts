import type {
  ApiErrorBody,
  AuthResponse,
  AuthUser,
  CreateOrderInput,
  RepairOrder,
  SupportTicket,
} from "@ironcode/contracts";

let accessToken: string | null = null;

export type CustomerLoginMethod = "phone" | "email";

async function parse<T>(response: Response): Promise<T> {
  if (response.ok)
    return response.status === 204 ? (undefined as T) : response.json();
  const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
  const message = Array.isArray(body.message)
    ? body.message.join("；")
    : body.message;
  throw new Error(message || "请求失败，请稍后重试");
}

export async function getCustomerLoginMethods() {
  return parse<{ phone: boolean; email: boolean }>(
    await fetch("/api/auth/customer/methods"),
  );
}

export async function requestPhoneCode(phone: string) {
  return parse<{ accepted: boolean }>(
    await fetch("/api/auth/customer/request-code", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone }),
    }),
  );
}

export async function verifyPhoneCode(phone: string, code: string) {
  const result = await parse<AuthResponse>(
    await fetch("/api/auth/customer/verify-code", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ phone, code }),
    }),
  );
  accessToken = result.accessToken;
  return result;
}

export async function requestEmailCode(email: string) {
  return parse<{ accepted: boolean }>(
    await fetch("/api/auth/customer/email/request-code", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    }),
  );
}

export async function verifyEmailCode(email: string, code: string) {
  const result = await parse<AuthResponse>(
    await fetch("/api/auth/customer/email/verify-code", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, code }),
    }),
  );
  accessToken = result.accessToken;
  return result;
}

export async function refreshSession() {
  const result = await parse<AuthResponse>(
    await fetch("/api/auth/session/customer/refresh", {
      method: "POST",
      credentials: "include",
    }),
  );
  accessToken = result.accessToken;
  return result;
}

export async function logout() {
  await parse<void>(
    await fetch("/api/auth/session/customer/logout", {
      method: "POST",
      credentials: "include",
    }),
  );
  accessToken = null;
}

export function getAccessToken() {
  return accessToken;
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

export function requestIdentityCode(
  method: CustomerLoginMethod,
  identifier: string,
) {
  return authenticatedFetch<{ accepted: boolean }>(
    `/api/auth/customer/identity/${method}/request-code`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        method === "phone" ? { phone: identifier } : { email: identifier },
      ),
    },
  );
}

export function verifyIdentityCode(
  method: CustomerLoginMethod,
  identifier: string,
  code: string,
) {
  return authenticatedFetch<{ user: AuthUser }>(
    `/api/auth/customer/identity/${method}/verify-code`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        method === "phone"
          ? { phone: identifier, code }
          : { email: identifier, code },
      ),
    },
  );
}

export function removeIdentity(method: CustomerLoginMethod) {
  return authenticatedFetch<{ user: AuthUser }>(
    `/api/auth/customer/identity/${method}`,
    { method: "DELETE" },
  );
}

export function listOrders() {
  return authenticatedFetch<RepairOrder[]>("/api/orders");
}

export function createOrder(input: CreateOrderInput) {
  return authenticatedFetch<RepairOrder>("/api/orders", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function cancelOrder(orderId: string) {
  return authenticatedFetch<RepairOrder>(`/api/orders/${orderId}/cancel`, {
    method: "POST",
  });
}

export function decideQuote(
  orderId: string,
  quoteId: string,
  expectedVersion: number,
  decision: "accept" | "reject",
) {
  return authenticatedFetch<RepairOrder>(
    `/api/orders/${orderId}/quotes/${quoteId}/${decision}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ expectedVersion }),
    },
  );
}

export function listTickets() {
  return authenticatedFetch<SupportTicket[]>("/api/tickets");
}

export function createTicket(input: {
  subject: string;
  body: string;
  orderId?: string;
}) {
  return authenticatedFetch<SupportTicket>("/api/tickets", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function replyTicket(ticketId: string, body: string) {
  return authenticatedFetch<SupportTicket>(
    `/api/tickets/${ticketId}/messages`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body }),
    },
  );
}

export function closeTicket(ticketId: string) {
  return authenticatedFetch<SupportTicket>(`/api/tickets/${ticketId}/close`, {
    method: "POST",
  });
}

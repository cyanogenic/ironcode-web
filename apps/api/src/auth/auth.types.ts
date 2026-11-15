import type { UserRole } from "@prisma/client";

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
}

export interface AuthenticatedUser {
  id: string;
  role: UserRole;
  phone: string | null;
  email: string | null;
  username: string | null;
  displayName: string | null;
}

export interface RequestContext {
  ipAddress?: string;
  userAgent?: string;
}

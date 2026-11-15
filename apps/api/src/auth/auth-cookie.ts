import type { ConfigService } from "@nestjs/config";
import type { Response } from "express";
import type { Environment } from "../config/environment";

export type AuthAudience = "customer" | "staff";

export function refreshCookieName(audience: AuthAudience) {
  return audience === "customer"
    ? "ironcode_customer_refresh"
    : "ironcode_staff_refresh";
}

export function setRefreshCookie(
  response: Response,
  refreshToken: string,
  config: ConfigService<Environment, true>,
  audience: AuthAudience,
) {
  const days = config.get("REFRESH_TOKEN_DAYS", { infer: true });
  response.cookie(refreshCookieName(audience), refreshToken, {
    httpOnly: true,
    secure: config.get("COOKIE_SECURE", { infer: true }),
    sameSite: "lax",
    path: `/api/auth/session/${audience}`,
    maxAge: days * 24 * 60 * 60 * 1000,
  });
}

export function clearRefreshCookie(
  response: Response,
  config: ConfigService<Environment, true>,
  audience: AuthAudience,
) {
  response.clearCookie(refreshCookieName(audience), {
    httpOnly: true,
    secure: config.get("COOKIE_SECURE", { infer: true }),
    sameSite: "lax",
    path: `/api/auth/session/${audience}`,
  });
}

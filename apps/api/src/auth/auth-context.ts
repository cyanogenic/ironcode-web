import type { Request } from "express";
import type { RequestContext } from "./auth.types";

export function getRequestContext(request: Request): RequestContext {
  return {
    ipAddress: request.ip,
    userAgent: request.get("user-agent")?.slice(0, 500),
  };
}

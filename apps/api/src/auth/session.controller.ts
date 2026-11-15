import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import type { Environment } from "../config/environment";
import {
  clearRefreshCookie,
  refreshCookieName,
  setRefreshCookie,
  type AuthAudience,
} from "./auth-cookie";
import { getRequestContext } from "./auth-context";
import { AuthSessionService } from "./auth-session.service";
import type { AuthenticatedUser } from "./auth.types";
import { CurrentUser } from "./decorators/current-user.decorator";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";

type CookieRequest = Request & { cookies?: Record<string, string | undefined> };

@ApiTags("session")
@Controller("auth/session")
export class SessionController {
  constructor(
    private readonly sessions: AuthSessionService,
    private readonly config: ConfigService<Environment, true>,
  ) {}

  @Post("customer/refresh")
  @HttpCode(HttpStatus.OK)
  customerRefresh(
    @Req() request: CookieRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.refresh(request, response, "customer");
  }

  @Post("customer/logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  customerLogout(
    @Req() request: CookieRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.logout(request, response, "customer");
  }

  @Post("staff/refresh")
  @HttpCode(HttpStatus.OK)
  staffRefresh(
    @Req() request: CookieRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.refresh(request, response, "staff");
  }

  @Post("staff/logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  staffLogout(
    @Req() request: CookieRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.logout(request, response, "staff");
  }

  @Get("me")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthenticatedUser) {
    return { user };
  }

  private async refresh(
    request: CookieRequest,
    response: Response,
    audience: AuthAudience,
  ) {
    const result = await this.sessions.refresh(
      request.cookies?.[refreshCookieName(audience)],
      getRequestContext(request),
      audience,
    );
    setRefreshCookie(response, result.refreshToken, this.config, audience);
    const { refreshToken: _refreshToken, ...body } = result;
    return body;
  }

  private async logout(
    request: CookieRequest,
    response: Response,
    audience: AuthAudience,
  ) {
    await this.sessions.revoke(request.cookies?.[refreshCookieName(audience)]);
    clearRefreshCookie(response, this.config, audience);
  }
}

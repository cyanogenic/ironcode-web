import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import type { Environment } from "../config/environment";
import { setRefreshCookie } from "./auth-cookie";
import { getRequestContext } from "./auth-context";
import { AuthSessionService } from "./auth-session.service";
import { StaffLoginDto } from "./dto/staff-login.dto";
import { StaffAuthService } from "./staff-auth.service";

@ApiTags("staff-auth")
@Controller("auth/staff")
export class StaffAuthController {
  constructor(
    private readonly staffAuth: StaffAuthService,
    private readonly sessions: AuthSessionService,
    private readonly config: ConfigService<Environment, true>,
  ) {}

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async login(
    @Body() input: StaffLoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const user = await this.staffAuth.verifyCredentials(
      input.username,
      input.password,
    );
    const result = await this.sessions.create(user, getRequestContext(request));
    setRefreshCookie(response, result.refreshToken, this.config, "staff");
    const { refreshToken: _refreshToken, ...body } = result;
    return body;
  }
}

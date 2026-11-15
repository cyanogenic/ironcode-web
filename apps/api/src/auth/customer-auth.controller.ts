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
import { CustomerAuthService } from "./customer-auth.service";
import {
  RequestCustomerCodeDto,
  VerifyCustomerCodeDto,
} from "./dto/customer-auth.dto";

@ApiTags("customer-auth")
@Controller("auth/customer")
export class CustomerAuthController {
  constructor(
    private readonly customerAuth: CustomerAuthService,
    private readonly sessions: AuthSessionService,
    private readonly config: ConfigService<Environment, true>,
  ) {}

  @Post("request-code")
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async requestCode(@Body() input: RequestCustomerCodeDto) {
    await this.customerAuth.requestCode(input.phone);
    return { accepted: true };
  }

  @Post("verify-code")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async verifyCode(
    @Body() input: VerifyCustomerCodeDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const user = await this.customerAuth.verifyCode(input.phone, input.code);
    const result = await this.sessions.create(user, getRequestContext(request));
    setRefreshCookie(response, result.refreshToken, this.config, "customer");
    const { refreshToken: _refreshToken, ...body } = result;
    return body;
  }
}

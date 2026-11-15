import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { UserRole, VerificationChannel, type User } from "@prisma/client";
import type { Request, Response } from "express";
import type { Environment } from "../config/environment";
import { setRefreshCookie } from "./auth-cookie";
import { getRequestContext } from "./auth-context";
import { AuthSessionService } from "./auth-session.service";
import type { AuthenticatedUser } from "./auth.types";
import { CustomerAuthService } from "./customer-auth.service";
import { CurrentUser } from "./decorators/current-user.decorator";
import { Roles } from "./decorators/roles.decorator";
import {
  RequestCustomerCodeDto,
  RequestCustomerEmailCodeDto,
  VerifyCustomerCodeDto,
  VerifyCustomerEmailCodeDto,
} from "./dto/customer-auth.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { RolesGuard } from "./guards/roles.guard";

@ApiTags("customer-auth")
@Controller("auth/customer")
export class CustomerAuthController {
  constructor(
    private readonly customerAuth: CustomerAuthService,
    private readonly sessions: AuthSessionService,
    private readonly config: ConfigService<Environment, true>,
  ) {}

  @Get("methods")
  methods() {
    return this.customerAuth.getLoginMethods();
  }

  @Post("request-code")
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async requestCode(@Body() input: RequestCustomerCodeDto) {
    await this.customerAuth.requestPhoneCode(input.phone);
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
    const user = await this.customerAuth.verifyPhoneCode(
      input.phone,
      input.code,
    );
    return this.createSession(user, request, response);
  }

  @Post("email/request-code")
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async requestEmailCode(@Body() input: RequestCustomerEmailCodeDto) {
    await this.customerAuth.requestEmailCode(input.email);
    return { accepted: true };
  }

  @Post("email/verify-code")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async verifyEmailCode(
    @Body() input: VerifyCustomerEmailCodeDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const user = await this.customerAuth.verifyEmailCode(
      input.email,
      input.code,
    );
    return this.createSession(user, request, response);
  }

  @Post("identity/phone/request-code")
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async requestPhoneIdentityCode(
    @Body() input: RequestCustomerCodeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.customerAuth.requestIdentityCode(
      user.id,
      VerificationChannel.SMS,
      input.phone,
    );
    return { accepted: true };
  }

  @Post("identity/phone/verify-code")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER)
  async verifyPhoneIdentityCode(
    @Body() input: VerifyCustomerCodeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const updated = await this.customerAuth.verifyIdentityCode(
      user.id,
      VerificationChannel.SMS,
      input.phone,
      input.code,
    );
    return { user: toAuthUser(updated) };
  }

  @Post("identity/email/request-code")
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async requestEmailIdentityCode(
    @Body() input: RequestCustomerEmailCodeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.customerAuth.requestIdentityCode(
      user.id,
      VerificationChannel.EMAIL,
      input.email,
    );
    return { accepted: true };
  }

  @Post("identity/email/verify-code")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER)
  async verifyEmailIdentityCode(
    @Body() input: VerifyCustomerEmailCodeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const updated = await this.customerAuth.verifyIdentityCode(
      user.id,
      VerificationChannel.EMAIL,
      input.email,
      input.code,
    );
    return { user: toAuthUser(updated) };
  }

  @Delete("identity/:channel")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER)
  async removeIdentity(
    @Param("channel") channel: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (channel !== "phone" && channel !== "email") {
      throw new NotFoundException("Identity channel was not found");
    }
    const updated = await this.customerAuth.removeIdentity(
      user.id,
      channel === "phone" ? VerificationChannel.SMS : VerificationChannel.EMAIL,
    );
    return { user: toAuthUser(updated) };
  }

  private async createSession(
    user: User,
    request: Request,
    response: Response,
  ) {
    const result = await this.sessions.create(user, getRequestContext(request));
    setRefreshCookie(response, result.refreshToken, this.config, "customer");
    const { refreshToken: _refreshToken, ...body } = result;
    return body;
  }
}

function toAuthUser(user: User) {
  return {
    id: user.id,
    role: user.role,
    phone: user.phone,
    email: user.email,
    username: user.username,
    displayName: user.displayName,
  };
}

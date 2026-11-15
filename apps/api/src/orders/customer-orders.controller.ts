import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import type { Request } from "express";
import type { AuthenticatedUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { CreateOrderDto } from "./dto/create-order.dto";
import { OrdersService } from "./orders.service";

@ApiTags("customer-orders")
@ApiBearerAuth()
@Controller("orders")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CUSTOMER)
export class CustomerOrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: CreateOrderDto,
    @Req() request: Request,
  ) {
    return this.orders.create(user.id, input, request.ip);
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.orders.listForCustomer(user.id);
  }

  @Get(":orderId")
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param("orderId") orderId: string,
  ) {
    return this.orders.getForCustomer(user.id, orderId);
  }

  @Post(":orderId/cancel")
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param("orderId") orderId: string,
  ) {
    return this.orders.cancelForCustomer(user.id, orderId);
  }
}

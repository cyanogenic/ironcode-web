import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import type { AuthenticatedUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import {
  AssignEngineerDto,
  StaffOrderQueryDto,
  TransitionOrderDto,
} from "./dto/staff-order.dto";
import { OrdersService } from "./orders.service";

@ApiTags("staff-orders")
@ApiBearerAuth()
@Controller("staff/orders")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ENGINEER, UserRole.ADMIN)
export class StaffOrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: StaffOrderQueryDto,
  ) {
    return this.orders.listForStaff(user, query);
  }

  @Get(":orderId")
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param("orderId") orderId: string,
  ) {
    return this.orders.getForStaff(user, orderId);
  }

  @Patch(":orderId/engineer")
  @Roles(UserRole.ADMIN)
  assign(
    @CurrentUser() user: AuthenticatedUser,
    @Param("orderId") orderId: string,
    @Body() input: AssignEngineerDto,
  ) {
    return this.orders.assignEngineer(orderId, input, user.id);
  }

  @Patch(":orderId/status")
  transition(
    @CurrentUser() user: AuthenticatedUser,
    @Param("orderId") orderId: string,
    @Body() input: TransitionOrderDto,
  ) {
    return this.orders.transitionForStaff(user, orderId, input);
  }
}

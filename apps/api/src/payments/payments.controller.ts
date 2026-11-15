import { Controller, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import type { AuthenticatedUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { PaymentsService } from "./payments.service";

@ApiTags("payments")
@ApiBearerAuth()
@Controller("staff/orders/:orderId/payments")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post("in-store")
  recordInStore(
    @CurrentUser() user: AuthenticatedUser,
    @Param("orderId") orderId: string,
  ) {
    return this.payments.recordInStorePayment(user, orderId);
  }
}

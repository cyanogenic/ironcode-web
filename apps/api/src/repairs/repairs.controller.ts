import { Body, Controller, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import type { AuthenticatedUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { QuoteDecisionDto, SubmitInspectionDto } from "./repair.dto";
import { RepairsService } from "./repairs.service";

@ApiTags("repairs")
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class RepairsController {
  constructor(private readonly repairs: RepairsService) {}

  @Post("staff/orders/:orderId/inspection")
  @Roles(UserRole.ENGINEER, UserRole.ADMIN)
  submitInspection(
    @CurrentUser() user: AuthenticatedUser,
    @Param("orderId") orderId: string,
    @Body() input: SubmitInspectionDto,
  ) {
    return this.repairs.submitInspection(user, orderId, input);
  }

  @Post("orders/:orderId/quotes/:quoteId/accept")
  @Roles(UserRole.CUSTOMER)
  acceptQuote(
    @CurrentUser() user: AuthenticatedUser,
    @Param("orderId") orderId: string,
    @Param("quoteId") quoteId: string,
    @Body() input: QuoteDecisionDto,
  ) {
    return this.repairs.decideQuote(user.id, orderId, quoteId, "accept", input);
  }

  @Post("orders/:orderId/quotes/:quoteId/reject")
  @Roles(UserRole.CUSTOMER)
  rejectQuote(
    @CurrentUser() user: AuthenticatedUser,
    @Param("orderId") orderId: string,
    @Param("quoteId") quoteId: string,
    @Body() input: QuoteDecisionDto,
  ) {
    return this.repairs.decideQuote(user.id, orderId, quoteId, "reject", input);
  }
}

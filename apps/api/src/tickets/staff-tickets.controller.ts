import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import type { AuthenticatedUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { ReplyTicketDto } from "./ticket.dto";
import { TicketsService } from "./tickets.service";

@ApiTags("staff-tickets")
@ApiBearerAuth()
@Controller("staff/tickets")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ENGINEER, UserRole.ADMIN)
export class StaffTicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @Get()
  list() {
    return this.tickets.listForStaff();
  }

  @Get(":ticketId")
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param("ticketId") ticketId: string,
  ) {
    return this.tickets.get(user, ticketId);
  }

  @Post(":ticketId/messages")
  reply(
    @CurrentUser() user: AuthenticatedUser,
    @Param("ticketId") ticketId: string,
    @Body() input: ReplyTicketDto,
  ) {
    return this.tickets.reply(user, ticketId, input.body);
  }

  @Post(":ticketId/close")
  close(
    @CurrentUser() user: AuthenticatedUser,
    @Param("ticketId") ticketId: string,
  ) {
    return this.tickets.close(user, ticketId);
  }
}

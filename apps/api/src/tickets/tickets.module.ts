import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CustomerTicketsController } from "./customer-tickets.controller";
import { StaffTicketsController } from "./staff-tickets.controller";
import { TicketsService } from "./tickets.service";

@Module({
  imports: [AuthModule],
  controllers: [CustomerTicketsController, StaffTicketsController],
  providers: [TicketsService],
})
export class TicketsModule {}

import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CustomerOrdersController } from "./customer-orders.controller";
import { OrderStateService } from "./order-state.service";
import { OrdersService } from "./orders.service";
import { StaffOrdersController } from "./staff-orders.controller";

@Module({
  imports: [AuthModule],
  controllers: [CustomerOrdersController, StaffOrdersController],
  providers: [OrdersService, OrderStateService],
  exports: [OrdersService],
})
export class OrdersModule {}

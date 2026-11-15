import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OrdersModule } from "../orders/orders.module";
import { RepairsController } from "./repairs.controller";
import { RepairsService } from "./repairs.service";

@Module({
  imports: [AuthModule, OrdersModule],
  controllers: [RepairsController],
  providers: [RepairsService],
})
export class RepairsModule {}

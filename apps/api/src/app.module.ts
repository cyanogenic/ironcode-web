import { Module } from "@nestjs/common";
import { AdminModule } from "./admin/admin.module";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AuthModule } from "./auth/auth.module";
import { AttachmentsModule } from "./attachments/attachments.module";
import { validateEnvironment } from "./config/environment";
import { HealthModule } from "./health/health.module";
import { OrdersModule } from "./orders/orders.module";
import { PaymentsModule } from "./payments/payments.module";
import { PrismaModule } from "./prisma/prisma.module";
import { RepairsModule } from "./repairs/repairs.module";
import { StorageModule } from "./storage/storage.module";
import { TicketsModule } from "./tickets/tickets.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ["../../.env", ".env"],
      validate: validateEnvironment,
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    AuthModule,
    AdminModule,
    AttachmentsModule,
    OrdersModule,
    PaymentsModule,
    RepairsModule,
    StorageModule,
    TicketsModule,
    HealthModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}

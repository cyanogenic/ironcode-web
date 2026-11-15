import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import type { Environment } from "../config/environment";
import { SmsModule } from "../sms/sms.module";
import { AuthSessionService } from "./auth-session.service";
import { CustomerAuthController } from "./customer-auth.controller";
import { CustomerAuthService } from "./customer-auth.service";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { RolesGuard } from "./guards/roles.guard";
import { JwtStrategy } from "./jwt.strategy";
import { SessionController } from "./session.controller";
import { StaffAuthController } from "./staff-auth.controller";
import { StaffAuthService } from "./staff-auth.service";

@Module({
  imports: [
    PassportModule,
    SmsModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Environment, true>) => ({
        secret: config.get("JWT_ACCESS_SECRET", { infer: true }),
        signOptions: { expiresIn: "15m" },
      }),
    }),
  ],
  controllers: [CustomerAuthController, StaffAuthController, SessionController],
  providers: [
    AuthSessionService,
    CustomerAuthService,
    StaffAuthService,
    JwtStrategy,
    JwtAuthGuard,
    RolesGuard,
  ],
  exports: [JwtAuthGuard, RolesGuard],
})
export class AuthModule {}

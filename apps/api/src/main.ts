import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { AppModule } from "./app.module";
import type { Environment } from "./config/environment";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService<Environment, true>);
  const origins = config
    .get("APP_ORIGINS", { infer: true })
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.setGlobalPrefix("api");
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    credentials: true,
    origin(
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) {
      if (!origin || origins.includes(origin)) return callback(null, true);
      callback(new Error("Origin is not allowed"));
    },
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableShutdownHooks();

  if (config.get("NODE_ENV", { infer: true }) !== "production") {
    const swaggerConfig = new DocumentBuilder()
      .setTitle("IronCode Repair API")
      .setDescription("铁码维修客户、工程师与管理接口")
      .setVersion("0.1.0")
      .addBearerAuth()
      .build();
    SwaggerModule.setup(
      "api/docs",
      app,
      SwaggerModule.createDocument(app, swaggerConfig),
    );
  }

  await app.listen(config.get("API_PORT", { infer: true }), "0.0.0.0");
}

void bootstrap();

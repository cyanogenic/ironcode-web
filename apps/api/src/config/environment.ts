import { z } from "zod";

const environmentSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    API_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    APP_ORIGINS: z.string().min(1),
    DATABASE_URL: z.string().min(1),
    JWT_ACCESS_SECRET: z.string().min(32),
    REFRESH_TOKEN_DAYS: z.coerce.number().int().min(1).max(90).default(30),
    COOKIE_SECURE: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    OTP_PROVIDER: z.enum(["console", "aliyun"]).default("console"),
    OTP_PEPPER: z.string().min(32),
    ALIYUN_SMS_ACCESS_KEY_ID: z.string().optional(),
    ALIYUN_SMS_ACCESS_KEY_SECRET: z.string().optional(),
    ALIYUN_SMS_SIGN_NAME: z.string().optional(),
    ALIYUN_SMS_TEMPLATE_CODE: z.string().optional(),
    ALIYUN_SMS_ENDPOINT: z.string().min(1).default("dysmsapi.aliyuncs.com"),
    R2_ACCOUNT_ID: z.string().optional(),
    R2_ACCESS_KEY_ID: z.string().optional(),
    R2_SECRET_ACCESS_KEY: z.string().optional(),
    R2_BUCKET: z.string().optional(),
    R2_PUBLIC_BASE_URL: z.string().url().optional().or(z.literal("")),
    SEED_ADMIN_USERNAME: z.string().optional(),
    SEED_ADMIN_PASSWORD: z.string().optional(),
  })
  .superRefine((value, context) => {
    if (value.OTP_PROVIDER === "aliyun") {
      for (const key of [
        "ALIYUN_SMS_ACCESS_KEY_ID",
        "ALIYUN_SMS_ACCESS_KEY_SECRET",
        "ALIYUN_SMS_SIGN_NAME",
        "ALIYUN_SMS_TEMPLATE_CODE",
      ] as const) {
        if (!value[key]) {
          context.addIssue({
            code: "custom",
            path: [key],
            message: `${key} is required when OTP_PROVIDER=aliyun`,
          });
        }
      }
    }

    if (value.NODE_ENV !== "production") return;

    if (!value.COOKIE_SECURE) {
      context.addIssue({
        code: "custom",
        path: ["COOKIE_SECURE"],
        message: "COOKIE_SECURE must be true in production",
      });
    }

    if (value.OTP_PROVIDER === "console") {
      context.addIssue({
        code: "custom",
        path: ["OTP_PROVIDER"],
        message: "console OTP is forbidden in production",
      });
    }

    for (const key of [
      "R2_ACCOUNT_ID",
      "R2_ACCESS_KEY_ID",
      "R2_SECRET_ACCESS_KEY",
      "R2_BUCKET",
    ] as const) {
      if (!value[key]) {
        context.addIssue({
          code: "custom",
          path: [key],
          message: `${key} is required in production`,
        });
      }
    }
  });

export type Environment = z.infer<typeof environmentSchema>;

export function validateEnvironment(
  input: Record<string, unknown>,
): Environment {
  const result = environmentSchema.safeParse(input);
  if (!result.success) {
    throw new Error(
      `Invalid environment configuration:\n${z.prettifyError(result.error)}`,
    );
  }
  return result.data;
}

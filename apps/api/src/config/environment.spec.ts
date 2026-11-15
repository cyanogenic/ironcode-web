import { describe, expect, it } from "vitest";
import { validateEnvironment } from "./environment";

const baseEnvironment = {
  NODE_ENV: "development",
  API_PORT: "3000",
  APP_ORIGINS: "http://localhost:5173,http://localhost:5174",
  DATABASE_URL: "postgresql://ironcode:secret@localhost:5432/ironcode",
  JWT_ACCESS_SECRET: "jwt-secret-with-more-than-32-characters",
  REFRESH_TOKEN_DAYS: "30",
  COOKIE_SECURE: "false",
  CUSTOMER_PHONE_LOGIN_ENABLED: "true",
  CUSTOMER_EMAIL_LOGIN_ENABLED: "false",
  OTP_PROVIDER: "console",
  OTP_PEPPER: "otp-pepper-with-more-than-32-characters",
};

describe("validateEnvironment", () => {
  it("accepts the local console OTP provider in development", () => {
    const result = validateEnvironment(baseEnvironment);
    expect(result.API_PORT).toBe(3000);
    expect(result.COOKIE_SECURE).toBe(false);
  });

  it("rejects console OTP and insecure cookies in production", () => {
    expect(() =>
      validateEnvironment({ ...baseEnvironment, NODE_ENV: "production" }),
    ).toThrow(/console OTP is forbidden in production/);
  });

  it("requires private R2 credentials in production", () => {
    expect(() =>
      validateEnvironment({
        ...baseEnvironment,
        NODE_ENV: "production",
        COOKIE_SECURE: "true",
        OTP_PROVIDER: "aliyun",
        ALIYUN_SMS_ACCESS_KEY_ID: "access-key",
        ALIYUN_SMS_ACCESS_KEY_SECRET: "secret-key",
        ALIYUN_SMS_SIGN_NAME: "铁码维修",
        ALIYUN_SMS_TEMPLATE_CODE: "SMS_123456789",
      }),
    ).toThrow(/R2_ACCOUNT_ID is required in production/);
  });

  it("requires all Aliyun SMS settings when the provider is selected", () => {
    expect(() =>
      validateEnvironment({
        ...baseEnvironment,
        OTP_PROVIDER: "aliyun",
      }),
    ).toThrow(/ALIYUN_SMS_ACCESS_KEY_ID is required/);
  });

  it("requires SMTP settings when email login uses SMTP", () => {
    expect(() =>
      validateEnvironment({
        ...baseEnvironment,
        CUSTOMER_EMAIL_LOGIN_ENABLED: "true",
        EMAIL_PROVIDER: "smtp",
      }),
    ).toThrow(/SMTP_HOST is required/);
  });

  it("forbids console email delivery in production when email login is enabled", () => {
    expect(() =>
      validateEnvironment({
        ...baseEnvironment,
        NODE_ENV: "production",
        CUSTOMER_PHONE_LOGIN_ENABLED: "false",
        CUSTOMER_EMAIL_LOGIN_ENABLED: "true",
      }),
    ).toThrow(/console email is forbidden in production/);
  });

  it("accepts a fully configured production environment", () => {
    const result = validateEnvironment({
      ...baseEnvironment,
      NODE_ENV: "production",
      COOKIE_SECURE: "true",
      OTP_PROVIDER: "aliyun",
      ALIYUN_SMS_ACCESS_KEY_ID: "access-key",
      ALIYUN_SMS_ACCESS_KEY_SECRET: "secret-key",
      ALIYUN_SMS_SIGN_NAME: "铁码维修",
      ALIYUN_SMS_TEMPLATE_CODE: "SMS_123456789",
      R2_ACCOUNT_ID: "account-id",
      R2_ACCESS_KEY_ID: "access-key",
      R2_SECRET_ACCESS_KEY: "secret-key",
      R2_BUCKET: "ironcode-private",
    });
    expect(result.NODE_ENV).toBe("production");
  });
});

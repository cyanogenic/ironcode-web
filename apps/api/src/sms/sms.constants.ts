import type Dysmsapi20170525 from "@alicloud/dysmsapi20170525";

export const ALIYUN_SMS_CLIENT = Symbol("ALIYUN_SMS_CLIENT");

export type AliyunSmsClient = Pick<Dysmsapi20170525, "sendSms">;

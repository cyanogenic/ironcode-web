import type { Transporter } from "nodemailer";

export const EMAIL_TRANSPORTER = Symbol("EMAIL_TRANSPORTER");

export type EmailTransporter = Pick<Transporter, "sendMail">;

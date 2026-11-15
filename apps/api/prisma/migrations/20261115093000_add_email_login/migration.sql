-- CreateEnum
CREATE TYPE "VerificationChannel" AS ENUM ('SMS', 'EMAIL');

-- Add email identities to users.
ALTER TABLE "User"
ADD COLUMN "email" VARCHAR(254),
ADD COLUMN "emailVerifiedAt" TIMESTAMPTZ(3);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- Generalize OTP challenges while preserving existing, short-lived SMS rows.
ALTER TABLE "OtpChallenge"
ADD COLUMN "channel" "VerificationChannel" NOT NULL DEFAULT 'SMS',
ADD COLUMN "destination" VARCHAR(254);

UPDATE "OtpChallenge" SET "destination" = "phone";

-- Codes issued by the old application use a different hash format. Invalidate
-- only pending, short-lived challenges so users cannot receive a false match.
DELETE FROM "OtpChallenge" WHERE "consumedAt" IS NULL;

ALTER TABLE "OtpChallenge"
ALTER COLUMN "destination" SET NOT NULL,
ALTER COLUMN "purpose" TYPE VARCHAR(80),
DROP COLUMN "phone",
ALTER COLUMN "channel" DROP DEFAULT;

DROP INDEX IF EXISTS "OtpChallenge_phone_purpose_createdAt_idx";
CREATE INDEX "OtpChallenge_channel_destination_purpose_createdAt_idx"
ON "OtpChallenge"("channel", "destination", "purpose", "createdAt");

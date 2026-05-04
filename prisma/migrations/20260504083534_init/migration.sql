-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('USER', 'ADMIN');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" SERIAL NOT NULL,
    "first_name" VARCHAR(64),
    "last_name" VARCHAR(64),
    "email" VARCHAR(120) NOT NULL,
    "password_hash" VARCHAR(256),
    "email_verification_hash" VARCHAR(256),
    "role" "public"."Role" NOT NULL DEFAULT 'USER',
    "is_activated" BOOLEAN NOT NULL DEFAULT false,
    "auth_provider" VARCHAR(20) NOT NULL DEFAULT 'local',
    "locality_id" INTEGER,
    "longitude" DOUBLE PRECISION,
    "latitude" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Session" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "refresh_token" VARCHAR(512) NOT NULL,
    "ip_address" VARCHAR(45),
    "device" VARCHAR(64),
    "os" VARCHAR(64),
    "browser" VARCHAR(64),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "public"."User"("email");

-- CreateIndex
CREATE INDEX "User_id_idx" ON "public"."User"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Session_refresh_token_key" ON "public"."Session"("refresh_token");

-- CreateIndex
CREATE INDEX "Session_user_id_idx" ON "public"."Session"("user_id");

-- AddForeignKey
ALTER TABLE "public"."Session" ADD CONSTRAINT "Session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

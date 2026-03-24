-- =============================================================================
-- SHOP DATABASE - Complete Schema (Final State)
-- =============================================================================
-- Consolidated from 2 Prisma migrations.
-- Run against: shop_db as shop_user (or postgres superuser)
-- Note: Prisma uses quoted PascalCase table/column names.
-- =============================================================================

-- Enums
DO $$ BEGIN CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "TxType" AS ENUM ('DEPOSIT', 'PURCHASE', 'ADJUSTMENT', 'REFUND'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "NotificationType" AS ENUM ('PURCHASE', 'BOOKING', 'SYSTEM'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- USER TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "image" TEXT,
    "emailVerified" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

-- =============================================================================
-- ACCOUNT TABLE (OAuth / NextAuth)
-- =============================================================================
CREATE TABLE IF NOT EXISTS "Account" (
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Account_pkey" PRIMARY KEY ("provider", "providerAccountId")
);

ALTER TABLE "Account" DROP CONSTRAINT IF EXISTS "Account_userId_fkey";
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =============================================================================
-- SESSION TABLE (NextAuth)
-- =============================================================================
CREATE TABLE IF NOT EXISTS "Session" (
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "Session_sessionToken_key" ON "Session"("sessionToken");

ALTER TABLE "Session" DROP CONSTRAINT IF EXISTS "Session_userId_fkey";
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =============================================================================
-- VERIFICATION TOKEN TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("identifier", "token")
);

-- =============================================================================
-- WALLET TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS "Wallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "balance" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Wallet_userId_key" ON "Wallet"("userId");

ALTER TABLE "Wallet" DROP CONSTRAINT IF EXISTS "Wallet_userId_fkey";
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- =============================================================================
-- TRANSACTION TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS "Transaction" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "type" "TxType" NOT NULL,
    "referenceId" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Transaction" DROP CONSTRAINT IF EXISTS "Transaction_walletId_fkey";
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_walletId_fkey"
    FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- =============================================================================
-- PRODUCT TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS "Product" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "imageUrl" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "stock" INTEGER NOT NULL,
    "isService" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- =============================================================================
-- ORDER TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS "Order" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_userId_fkey";
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- =============================================================================
-- ORDER ITEM TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "OrderItem" DROP CONSTRAINT IF EXISTS "OrderItem_orderId_fkey";
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OrderItem" DROP CONSTRAINT IF EXISTS "OrderItem_productId_fkey";
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- =============================================================================
-- BOOKING TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS "Booking" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "serviceId" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Booking" DROP CONSTRAINT IF EXISTS "Booking_userId_fkey";
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- =============================================================================
-- NOTIFICATION TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Notification" DROP CONSTRAINT IF EXISTS "Notification_userId_fkey";
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- =============================================================================
-- PRISMA MIGRATIONS TABLE (Prisma tracks its own migrations)
-- =============================================================================
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id" VARCHAR(36) NOT NULL,
    "checksum" VARCHAR(64) NOT NULL,
    "finished_at" TIMESTAMP(3),
    "migration_name" VARCHAR(255) NOT NULL,
    "logs" TEXT,
    "rolled_back_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
    "applied_steps_count" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "_prisma_migrations_pkey" PRIMARY KEY ("id")
);

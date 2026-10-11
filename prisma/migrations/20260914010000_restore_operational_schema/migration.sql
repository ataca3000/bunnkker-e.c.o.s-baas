-- Restore operational tables and order attribution without resetting existing data.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "vendedorId" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "vendedorName" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "confirmedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "Purchase" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "supplier" TEXT NOT NULL,
  "concept" TEXT NOT NULL,
  "amount" REAL NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'Pendiente',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "synced" BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS "ShrinkageLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "productId" TEXT NOT NULL,
  "productName" TEXT NOT NULL,
  "productCategory" TEXT NOT NULL,
  "discrepancyType" TEXT NOT NULL,
  "qty" INTEGER NOT NULL,
  "estimatedLoss" REAL NOT NULL,
  "notes" TEXT NOT NULL,
  "reportedBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "AppConfig" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'global',
  "licenseType" TEXT NOT NULL DEFAULT 'TRIAL',
  "tenantId" TEXT,
  "cloudToken" TEXT,
  "pairedAt" TIMESTAMP(3),
  "lastBackupAt" TIMESTAMP(3),
  "lastBackupSize" INTEGER,
  "lastBackupHash" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "SwarmTransaction" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "requestingNode" TEXT NOT NULL,
  "providingNode" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "qty" INTEGER NOT NULL,
  "reservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'RESERVED',
  "commissionEarned" REAL NOT NULL DEFAULT 0
);

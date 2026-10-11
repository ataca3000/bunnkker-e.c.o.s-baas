-- Reconcile the restored historical migrations with the current PostgreSQL Prisma schema.
-- Additive/idempotent column changes preserve existing rows. Unique indexes are rebuilt
-- with tenant scope to match the current schema.

ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "OrderEvent" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "SyncQueue" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "SyncQueue" ADD COLUMN IF NOT EXISTS "retryCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "SyncQueue" ADD COLUMN IF NOT EXISTS "processAfter" TIMESTAMP(3);
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "SupportTicket" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "Purchase" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "ShrinkageLog" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "SwarmTransaction" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL DEFAULT 'default';

-- Current Prisma schema permits a missing PIN and scopes identity uniqueness by tenant.
ALTER TABLE "User" ALTER COLUMN "pin" DROP NOT NULL;

DROP INDEX IF EXISTS "Customer_phone_key";
DROP INDEX IF EXISTS "SupportTicket_folio_key";
DROP INDEX IF EXISTS "User_email_key";
DROP INDEX IF EXISTS "User_pin_key";

CREATE UNIQUE INDEX IF NOT EXISTS "Customer_tenantId_phone_key" ON "Customer"("tenantId", "phone");
CREATE UNIQUE INDEX IF NOT EXISTS "SupportTicket_tenantId_folio_key" ON "SupportTicket"("tenantId", "folio");
CREATE UNIQUE INDEX IF NOT EXISTS "User_tenantId_email_key" ON "User"("tenantId", "email");

-- Prisma Float fields map to PostgreSQL DOUBLE PRECISION. Older baseline SQL used REAL.
ALTER TABLE "Product" ALTER COLUMN "price" TYPE DOUBLE PRECISION USING "price"::DOUBLE PRECISION;
ALTER TABLE "Product" ALTER COLUMN "rating" TYPE DOUBLE PRECISION USING "rating"::DOUBLE PRECISION;
ALTER TABLE "Order" ALTER COLUMN "total" TYPE DOUBLE PRECISION USING "total"::DOUBLE PRECISION;
ALTER TABLE "OrderItem" ALTER COLUMN "precio" TYPE DOUBLE PRECISION USING "precio"::DOUBLE PRECISION;
ALTER TABLE "CashRegisterLog" ALTER COLUMN "declaredAmount" TYPE DOUBLE PRECISION USING "declaredAmount"::DOUBLE PRECISION;
ALTER TABLE "CashRegisterLog" ALTER COLUMN "expectedAmount" TYPE DOUBLE PRECISION USING "expectedAmount"::DOUBLE PRECISION;
ALTER TABLE "CashRegisterLog" ALTER COLUMN "discrepancy" TYPE DOUBLE PRECISION USING "discrepancy"::DOUBLE PRECISION;
ALTER TABLE "Purchase" ALTER COLUMN "amount" TYPE DOUBLE PRECISION USING "amount"::DOUBLE PRECISION;
ALTER TABLE "ShrinkageLog" ALTER COLUMN "estimatedLoss" TYPE DOUBLE PRECISION USING "estimatedLoss"::DOUBLE PRECISION;
ALTER TABLE "SwarmTransaction" ALTER COLUMN "commissionEarned" TYPE DOUBLE PRECISION USING "commissionEarned"::DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS "SyncQueue_status_idx" ON "SyncQueue"("status");

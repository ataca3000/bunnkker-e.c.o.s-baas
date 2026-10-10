-- Idempotent additions allow recovery when a database was partially rebuilt.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "deliveryPin" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "deliveryLat" DOUBLE PRECISION;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "deliveryLng" DOUBLE PRECISION;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "deliveryAddress" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "loadedBy" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "loadedByUid" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "loadingStartedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "loadingFinishedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "isLoaded" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "assignedDriverId" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "signatureData" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "photoData" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;

CREATE INDEX IF NOT EXISTS "Order_status_deliveryType_idx" ON "Order"("status", "deliveryType");
CREATE INDEX IF NOT EXISTS "Order_assignedDriverId_status_idx" ON "Order"("assignedDriverId", "status");

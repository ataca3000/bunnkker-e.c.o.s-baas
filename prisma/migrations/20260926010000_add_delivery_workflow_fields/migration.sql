ALTER TABLE "Order" ADD COLUMN "deliveryPin" TEXT;
ALTER TABLE "Order" ADD COLUMN "deliveryLat" DOUBLE PRECISION;
ALTER TABLE "Order" ADD COLUMN "deliveryLng" DOUBLE PRECISION;
ALTER TABLE "Order" ADD COLUMN "deliveryAddress" TEXT;
ALTER TABLE "Order" ADD COLUMN "loadedBy" TEXT;
ALTER TABLE "Order" ADD COLUMN "loadedByUid" TEXT;
ALTER TABLE "Order" ADD COLUMN "loadingStartedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "loadingFinishedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "isLoaded" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Order" ADD COLUMN "assignedDriverId" TEXT;
ALTER TABLE "Order" ADD COLUMN "signatureData" TEXT;
ALTER TABLE "Order" ADD COLUMN "photoData" TEXT;
ALTER TABLE "Order" ADD COLUMN "completedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "rejectionReason" TEXT;

CREATE INDEX "Order_status_deliveryType_idx" ON "Order"("status", "deliveryType");
CREATE INDEX "Order_assignedDriverId_status_idx" ON "Order"("assignedDriverId", "status");

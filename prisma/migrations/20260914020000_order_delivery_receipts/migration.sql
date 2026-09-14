ALTER TABLE "Order" ADD COLUMN "preparedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "paidAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "dispatchedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "deliveredAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "receivedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "deliveryPhoto" TEXT;
ALTER TABLE "Order" ADD COLUMN "customerReceived" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "DigitalReceipt" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL DEFAULT 'default',
  "orderId" TEXT NOT NULL,
  "cashierId" TEXT NOT NULL,
  "cashierName" TEXT NOT NULL,
  "customerId" TEXT,
  "total" DOUBLE PRECISION NOT NULL,
  "paymentMethod" TEXT NOT NULL,
  "receiptNumber" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DigitalReceipt_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DigitalReceipt_receiptNumber_key" ON "DigitalReceipt"("receiptNumber");
CREATE INDEX "DigitalReceipt_tenantId_createdAt_idx" ON "DigitalReceipt"("tenantId", "createdAt");
CREATE UNIQUE INDEX "DigitalReceipt_orderId_key" ON "DigitalReceipt"("orderId");
ALTER TABLE "DigitalReceipt" ADD CONSTRAINT "DigitalReceipt_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

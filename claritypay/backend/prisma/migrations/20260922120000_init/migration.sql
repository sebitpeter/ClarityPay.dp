-- ClarityPay initial PostgreSQL schema
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL,
    "typicalTransfer" DOUBLE PRECISION NOT NULL,
    "trustedContact" TEXT NOT NULL,
    "trustedPhone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "recipient" TEXT NOT NULL,
    "recipientRef" TEXT NOT NULL,
    "isNewRecipient" BOOLEAN NOT NULL DEFAULT true,
    "riskScore" INTEGER NOT NULL DEFAULT 0,
    "riskLevel" TEXT NOT NULL DEFAULT 'LOW',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SIMULATED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Transaction_customerId_idx" ON "Transaction"("customerId");
CREATE INDEX "Alert_customerId_idx" ON "Alert"("customerId");
CREATE INDEX "AuditEvent_createdAt_idx" ON "AuditEvent"("createdAt");

ALTER TABLE "Transaction"
ADD CONSTRAINT "Transaction_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Alert"
ADD CONSTRAINT "Alert_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

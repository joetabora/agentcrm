-- Phase 10: transactions hub

CREATE TYPE "TransactionStatus" AS ENUM ('OPEN', 'UNDER_CONTRACT', 'CLOSED', 'FELL_THROUGH', 'CANCELLED');
CREATE TYPE "OfferStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'COUNTERED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN');
CREATE TYPE "PartyRole" AS ENUM ('BUYER', 'SELLER', 'BUYER_AGENT', 'SELLER_AGENT', 'LENDER', 'ATTORNEY', 'TITLE', 'OTHER');
CREATE TYPE "DeadlineKind" AS ENUM ('INSPECTION', 'FINANCING', 'APPRAISAL', 'EARNEST_MONEY', 'CLOSING', 'OTHER');
CREATE TYPE "ChecklistStatus" AS ENUM ('TODO', 'DONE', 'NA');
CREATE TYPE "TransactionSide" AS ENUM ('BUYER', 'SELLER', 'DUAL');

CREATE TABLE "Transaction" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "opportunityId" TEXT NOT NULL,
  "propertyId" TEXT,
  "status" "TransactionStatus" NOT NULL DEFAULT 'OPEN',
  "title" TEXT NOT NULL,
  "purchasePrice" DECIMAL(14,2),
  "closingDate" TIMESTAMP(3),
  "side" "TransactionSide" NOT NULL DEFAULT 'BUYER',
  "gciAmount" DECIMAL(14,2),
  "agentSplitPercent" DECIMAL(5,2),
  "brokerageSplitPercent" DECIMAL(5,2),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Transaction_opportunityId_key" ON "Transaction"("opportunityId");
CREATE INDEX "Transaction_organizationId_status_idx" ON "Transaction"("organizationId", "status");
CREATE INDEX "Transaction_propertyId_idx" ON "Transaction"("propertyId");

CREATE TABLE "TransactionParty" (
  "id" TEXT NOT NULL,
  "transactionId" TEXT NOT NULL,
  "contactId" TEXT,
  "role" "PartyRole" NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TransactionParty_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TransactionParty_transactionId_idx" ON "TransactionParty"("transactionId");
CREATE INDEX "TransactionParty_contactId_idx" ON "TransactionParty"("contactId");

CREATE TABLE "Offer" (
  "id" TEXT NOT NULL,
  "transactionId" TEXT NOT NULL,
  "status" "OfferStatus" NOT NULL DEFAULT 'DRAFT',
  "amount" DECIMAL(14,2) NOT NULL,
  "submittedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Offer_transactionId_idx" ON "Offer"("transactionId");

CREATE TABLE "TransactionDeadline" (
  "id" TEXT NOT NULL,
  "transactionId" TEXT NOT NULL,
  "kind" "DeadlineKind" NOT NULL,
  "label" TEXT NOT NULL,
  "dueAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TransactionDeadline_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TransactionDeadline_transactionId_idx" ON "TransactionDeadline"("transactionId");
CREATE INDEX "TransactionDeadline_dueAt_idx" ON "TransactionDeadline"("dueAt");

CREATE TABLE "TransactionChecklistItem" (
  "id" TEXT NOT NULL,
  "transactionId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "status" "ChecklistStatus" NOT NULL DEFAULT 'TODO',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "dueAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TransactionChecklistItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TransactionChecklistItem_transactionId_idx" ON "TransactionChecklistItem"("transactionId");

CREATE TABLE "TransactionDocument" (
  "id" TEXT NOT NULL,
  "transactionId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "contentType" TEXT,
  "sizeBytes" INTEGER,
  "esignEnvelopeId" TEXT,
  "uploadedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TransactionDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TransactionDocument_transactionId_idx" ON "TransactionDocument"("transactionId");

ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TransactionParty" ADD CONSTRAINT "TransactionParty_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TransactionParty" ADD CONSTRAINT "TransactionParty_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TransactionDeadline" ADD CONSTRAINT "TransactionDeadline_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TransactionChecklistItem" ADD CONSTRAINT "TransactionChecklistItem_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TransactionDocument" ADD CONSTRAINT "TransactionDocument_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TransactionDocument" ADD CONSTRAINT "TransactionDocument_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

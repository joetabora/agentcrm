-- AlterTable
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "listedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PropertyPriceEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "price" DECIMAL(14,2) NOT NULL,
    "notedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "provenance" "DataProvenance" NOT NULL DEFAULT 'USER_ENTERED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PropertyPriceEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PropertyPriceEvent_propertyId_notedAt_idx" ON "PropertyPriceEvent"("propertyId", "notedAt");
CREATE INDEX IF NOT EXISTS "PropertyPriceEvent_organizationId_idx" ON "PropertyPriceEvent"("organizationId");

DO $$ BEGIN
  ALTER TABLE "PropertyPriceEvent" ADD CONSTRAINT "PropertyPriceEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "PropertyPriceEvent" ADD CONSTRAINT "PropertyPriceEvent_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "PropertyPriceEvent" ENABLE ROW LEVEL SECURITY;

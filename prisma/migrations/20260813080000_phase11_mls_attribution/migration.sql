-- Phase 11: MLS attribution on Property

ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "mlsSource" TEXT;
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "mlsListingKey" TEXT;
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "mlsAttribution" TEXT;
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "mlsLastSyncedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Property_organizationId_mlsNumber_idx" ON "Property"("organizationId", "mlsNumber");

CREATE UNIQUE INDEX IF NOT EXISTS "Property_organizationId_mlsListingKey_key"
  ON "Property"("organizationId", "mlsListingKey")
  WHERE "mlsListingKey" IS NOT NULL;

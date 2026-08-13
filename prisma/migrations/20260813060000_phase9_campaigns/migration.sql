-- Phase 9: marketing campaigns

CREATE TYPE "CampaignStatus" AS ENUM (
  'DRAFT',
  'PENDING_APPROVAL',
  'ACTIVE',
  'PAUSED',
  'COMPLETED',
  'ARCHIVED'
);

CREATE TYPE "CampaignEnrollmentStatus" AS ENUM (
  'ACTIVE',
  'COMPLETED',
  'EXITED',
  'ERROR',
  'SKIPPED'
);

CREATE TABLE "Campaign" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "channel" "CommChannel" NOT NULL,
  "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
  "definition" JSONB,
  "audience" JSONB,
  "approvedAt" TIMESTAMP(3),
  "approvedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CampaignEnrollment" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "status" "CampaignEnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
  "currentStepKey" TEXT,
  "nextRunAt" TIMESTAMP(3),
  "lastError" TEXT,
  "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "exitedAt" TIMESTAMP(3),
  CONSTRAINT "CampaignEnrollment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Campaign_organizationId_status_idx" ON "Campaign"("organizationId", "status");
CREATE INDEX "CampaignEnrollment_organizationId_status_idx" ON "CampaignEnrollment"("organizationId", "status");
CREATE INDEX "CampaignEnrollment_organizationId_status_nextRunAt_idx" ON "CampaignEnrollment"("organizationId", "status", "nextRunAt");
CREATE INDEX "CampaignEnrollment_campaignId_idx" ON "CampaignEnrollment"("campaignId");
CREATE UNIQUE INDEX "CampaignEnrollment_campaignId_contactId_key" ON "CampaignEnrollment"("campaignId", "contactId");

ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CampaignEnrollment" ADD CONSTRAINT "CampaignEnrollment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignEnrollment" ADD CONSTRAINT "CampaignEnrollment_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignEnrollment" ADD CONSTRAINT "CampaignEnrollment_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "WorkflowEnrollment" ADD COLUMN IF NOT EXISTS "nextRunAt" TIMESTAMP(3);
ALTER TABLE "WorkflowEnrollment" ADD COLUMN IF NOT EXISTS "lastError" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WorkflowEnrollment_organizationId_status_nextRunAt_idx"
  ON "WorkflowEnrollment"("organizationId", "status", "nextRunAt");

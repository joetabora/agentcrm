-- CreateEnum
CREATE TYPE "TaskRecurrenceRule" AS ENUM ('NONE', 'DAILY', 'WEEKLY', 'MONTHLY');

-- AlterTable
ALTER TABLE "Task" ADD COLUMN "recurrenceRule" "TaskRecurrenceRule" NOT NULL DEFAULT 'NONE';
ALTER TABLE "Task" ADD COLUMN "recurrenceParentId" TEXT;

-- CreateIndex
CREATE INDEX "Task_organizationId_status_snoozedUntil_idx" ON "Task"("organizationId", "status", "snoozedUntil");
CREATE INDEX "Task_recurrenceParentId_idx" ON "Task"("recurrenceParentId");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_recurrenceParentId_fkey" FOREIGN KEY ("recurrenceParentId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "SavedViewEntity" AS ENUM ('LEADS', 'CONTACTS');

-- CreateEnum
CREATE TYPE "RoutingAssignMode" AS ENUM ('SPECIFIC_USER', 'ROUND_ROBIN');

-- CreateTable
CREATE TABLE "SavedView" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "entity" "SavedViewEntity" NOT NULL DEFAULT 'LEADS',
    "filters" JSONB NOT NULL,
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoutingRule" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "conditions" JSONB NOT NULL,
    "assignMode" "RoutingAssignMode" NOT NULL DEFAULT 'SPECIFIC_USER',
    "targetUserId" TEXT,
    "roundRobinUserIds" JSONB,
    "roundRobinIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoutingRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SavedView_organizationId_entity_idx" ON "SavedView"("organizationId", "entity");

-- CreateIndex
CREATE INDEX "SavedView_ownerUserId_idx" ON "SavedView"("ownerUserId");

-- CreateIndex
CREATE INDEX "RoutingRule_organizationId_enabled_position_idx" ON "RoutingRule"("organizationId", "enabled", "position");

-- AddForeignKey
ALTER TABLE "SavedView" ADD CONSTRAINT "SavedView_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedView" ADD CONSTRAINT "SavedView_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutingRule" ADD CONSTRAINT "RoutingRule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutingRule" ADD CONSTRAINT "RoutingRule_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

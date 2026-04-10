-- AlterTable
ALTER TABLE "services" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "services_organizationId_sortOrder_idx" ON "services"("organizationId", "sortOrder");

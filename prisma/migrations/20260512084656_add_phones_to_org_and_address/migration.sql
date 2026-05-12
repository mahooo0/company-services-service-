-- Add denormalized phone fields synced from organization-service-main via RabbitMQ.
-- Both columns are nullable JSONB; consumer hydrates on next organization.updated /
-- address.updated event. No backfill — pre-existing rows keep NULL until next event.

ALTER TABLE "organizations" ADD COLUMN "phones" JSONB;
ALTER TABLE "organization_addresses" ADD COLUMN "phone" JSONB;

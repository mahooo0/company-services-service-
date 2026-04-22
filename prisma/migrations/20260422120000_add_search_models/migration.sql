-- Enable pg_trgm extension for fuzzy text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Denormalized organizations table (synced via RabbitMQ)
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "category" TEXT,
    "description" TEXT,
    "avatar" TEXT,
    "averageRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- Denormalized branch points (synced via RabbitMQ from organization-service addresses)
CREATE TABLE "organization_addresses" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "address" TEXT,
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "workTime" JSONB,

    CONSTRAINT "organization_addresses_pkey" PRIMARY KEY ("id")
);

-- Indexes for organizations
CREATE INDEX "organizations_name_idx" ON "organizations"("name");

-- GIN trigram index for fuzzy text search on organization name
CREATE INDEX "organizations_name_trgm_idx" ON "organizations" USING GIN ("name" gin_trgm_ops);

-- GIN trigram index for fuzzy text search on service name
CREATE INDEX "services_name_trgm_idx" ON "services" USING GIN ("name" gin_trgm_ops);

-- Indexes for organization_addresses
CREATE INDEX "organization_addresses_organizationId_idx" ON "organization_addresses"("organizationId");
CREATE INDEX "organization_addresses_lat_lon_idx" ON "organization_addresses"("lat", "lon");

-- Foreign key
ALTER TABLE "organization_addresses" ADD CONSTRAINT "organization_addresses_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

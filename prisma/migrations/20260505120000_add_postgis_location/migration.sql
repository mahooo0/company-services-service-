-- Enable PostGIS extension (idempotent)
CREATE EXTENSION IF NOT EXISTS postgis;

-- Add geography(Point, 4326) column derived from existing lat/lon.
-- Postgres maintains this STORED generated column automatically — no
-- application changes needed in OrganizationEventConsumer.
-- ST_MakePoint takes (lon, lat) — order matters.
ALTER TABLE "organization_addresses"
  ADD COLUMN "location" geography(Point, 4326)
  GENERATED ALWAYS AS (
    ST_SetSRID(ST_MakePoint("lon", "lat"), 4326)::geography
  ) STORED;

-- Spatial index used by ST_DWithin / ST_Distance.
CREATE INDEX "organization_addresses_location_gist_idx"
  ON "organization_addresses"
  USING GIST ("location");

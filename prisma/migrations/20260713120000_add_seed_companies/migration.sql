-- Seed (non-partner) companies: reference catalog for /search map + grid.
-- No services, no account, no platform reviews — contacts and coordinates only.
-- Populated by a one-off import (prisma/seed-companies-import.ts), not synced via RabbitMQ.
-- `category` is stored pre-normalized to the orgCategory enum format (VET_CLINICS, ...)
-- so the existing orgCategory filter matches seed rows without translation at query time.

CREATE TABLE IF NOT EXISTS seed_companies (
    "id"        TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "category"  TEXT NOT NULL,
    "slug"      TEXT NOT NULL,
    "phone"     TEXT,
    "address"   TEXT,
    "place"     TEXT,
    "lat"       DOUBLE PRECISION NOT NULL,
    "lon"       DOUBLE PRECISION NOT NULL,
    "stars"     DOUBLE PRECISION,
    "reviews"   INTEGER,
    "email"     TEXT,
    "facebook"  TEXT,
    "instagram" TEXT,
    "whatsapp"  TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seed_companies_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "seed_companies_category_idx"
  ON seed_companies ("category");
CREATE INDEX IF NOT EXISTS "seed_companies_lat_lon_idx"
  ON seed_companies ("lat", "lon");

-- Trigram indexes mirror the ones on organizations / organization_addresses
-- (migration 20260508101227): Query C matches name/address/place with ILIKE + `%`.
CREATE INDEX IF NOT EXISTS seed_companies_name_trgm_idx
  ON seed_companies USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS seed_companies_address_trgm_idx
  ON seed_companies USING GIN (address gin_trgm_ops);
CREATE INDEX IF NOT EXISTS seed_companies_place_trgm_idx
  ON seed_companies USING GIN (place gin_trgm_ops);

-- Phase 8 (quick-260508-jpk): pg_trgm typo tolerance.
-- pg_trgm extension already installed on prod (verified live).
-- This migration adds GIN trigram indexes; no extension creation needed.

CREATE INDEX IF NOT EXISTS organizations_name_trgm_idx
  ON organizations USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS services_name_trgm_idx
  ON services USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS service_types_name_trgm_idx
  ON service_types USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS service_categories_name_trgm_idx
  ON service_categories USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS organization_addresses_name_trgm_idx
  ON organization_addresses USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS organization_addresses_address_trgm_idx
  ON organization_addresses USING GIN (address gin_trgm_ops);
CREATE INDEX IF NOT EXISTS organization_addresses_city_trgm_idx
  ON organization_addresses USING GIN (city gin_trgm_ops);

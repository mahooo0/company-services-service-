/**
 * One-off import of seed (non-partner) companies into this service's database.
 *
 * Source of truth is the `seed_companies` table in the organization-service database
 * (populated from the legacy Convex `seedCompanies` collection). Rows are copied here
 * verbatim — same primary keys — so the two copies stay reconcilable, and `/search`
 * can UNION them with `organizations` in a single query (cross-database joins are
 * not possible in Postgres).
 *
 * Category is normalized on the way in: the source stores a category *slug*
 * ("vet-clinics"), while `organizations.category` — and therefore the `orgCategory`
 * filter — uses the enum form ("VET_CLINICS"). Normalizing at import time keeps the
 * query path free of translation logic.
 *
 * Idempotent: re-running upserts by id and never duplicates rows.
 *
 * Usage:
 *   SOURCE_DATABASE_URL="postgresql://…/organization" \
 *     pnpm exec ts-node --transpile-only prisma/seed-companies-import.ts
 */
import { PrismaClient } from '@prisma/client';

/** Source category slug → the category enum used by `organizations`. */
const CATEGORY_BY_SLUG: Record<string, string> = {
  'vet-clinics': 'VET_CLINICS',
  'pet-stores': 'PET_STORES',
  grooming: 'GROOMING',
  breeders: 'BREEDERS',
  cynologists: 'CYNOLOGISTS',
  walking: 'WALKING',
};

const BATCH_SIZE = 500;

interface SourceRow {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  place: string | null;
  phone: string | null;
  lat: number;
  lon: number;
  stars: number | null;
  reviews: number | null;
  email: string | null;
  facebook: string | null;
  instagram: string | null;
  whatsapp: string | null;
}

/** Scraped values use "0" as a placeholder for "no data". Treat it as absent. */
function nullifyPlaceholder(value: string | null): string | null {
  const trimmed = value?.trim();
  return !trimmed || trimmed === '0' ? null : trimmed;
}

async function main(): Promise<void> {
  const sourceUrl = process.env.SOURCE_DATABASE_URL;
  if (!sourceUrl) {
    throw new Error(
      'SOURCE_DATABASE_URL is required (organization-service database).',
    );
  }

  const source = new PrismaClient({ datasources: { db: { url: sourceUrl } } });
  const target = new PrismaClient();

  try {
    const rows = await source.$queryRawUnsafe<SourceRow[]>(
      `SELECT id, name, slug, address, place, phone, lat, lon, stars, reviews,
              email, facebook, instagram, whatsapp
         FROM seed_companies`,
    );
    console.log(`source rows: ${rows.length}`);

    const unmapped = [
      ...new Set(rows.map((r) => r.slug).filter((s) => !CATEGORY_BY_SLUG[s])),
    ];
    if (unmapped.length) {
      throw new Error(
        `Unmapped category slugs: ${unmapped.join(', ')}. ` +
          'Add them to CATEGORY_BY_SLUG — leaving them unmapped would silently ' +
          'exclude those rows from the orgCategory filter.',
      );
    }

    let written = 0;
    for (let offset = 0; offset < rows.length; offset += BATCH_SIZE) {
      const batch = rows.slice(offset, offset + BATCH_SIZE);
      const values: string[] = [];
      const params: unknown[] = [];

      for (const row of batch) {
        const base = params.length;
        values.push(
          `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5},` +
            ` $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10},` +
            ` $${base + 11}, $${base + 12}, $${base + 13}, $${base + 14}, $${base + 15},` +
            ' NOW(), NOW())',
        );
        params.push(
          row.id,
          row.name,
          CATEGORY_BY_SLUG[row.slug],
          row.slug,
          nullifyPlaceholder(row.phone),
          nullifyPlaceholder(row.address),
          nullifyPlaceholder(row.place),
          row.lat,
          row.lon,
          row.stars,
          row.reviews === null ? null : Math.trunc(row.reviews),
          nullifyPlaceholder(row.email),
          nullifyPlaceholder(row.facebook),
          nullifyPlaceholder(row.instagram),
          nullifyPlaceholder(row.whatsapp),
        );
      }

      written += await target.$executeRawUnsafe(
        `INSERT INTO seed_companies
           ("id", "name", "category", "slug", "phone", "address", "place",
            "lat", "lon", "stars", "reviews", "email", "facebook", "instagram",
            "whatsapp", "createdAt", "updatedAt")
         VALUES ${values.join(', ')}
         ON CONFLICT ("id") DO UPDATE SET
           "name" = EXCLUDED."name",
           "category" = EXCLUDED."category",
           "slug" = EXCLUDED."slug",
           "phone" = EXCLUDED."phone",
           "address" = EXCLUDED."address",
           "place" = EXCLUDED."place",
           "lat" = EXCLUDED."lat",
           "lon" = EXCLUDED."lon",
           "stars" = EXCLUDED."stars",
           "reviews" = EXCLUDED."reviews",
           "email" = EXCLUDED."email",
           "facebook" = EXCLUDED."facebook",
           "instagram" = EXCLUDED."instagram",
           "whatsapp" = EXCLUDED."whatsapp",
           "updatedAt" = NOW()`,
        ...params,
      );
      console.log(`upserted ${written}/${rows.length}`);
    }

    const [{ total }] = await target.$queryRawUnsafe<{ total: number }[]>(
      'SELECT count(*)::int AS total FROM seed_companies',
    );
    console.log(`seed_companies now holds ${total} rows`);
  } finally {
    await source.$disconnect();
    await target.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

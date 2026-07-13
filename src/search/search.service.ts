import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { OrgServiceClient } from '@/clients/org-service-client.service';
import { LogService } from '@/log/log.service';
import {
  SearchQueryDto,
  SearchSortBy,
  GroupBy,
  SeedCompanyDto,
  SuggestQueryDto,
  SuggestResponseDto,
  SuggestCategoryDto,
  SuggestBusinessDto,
  SuggestServiceDto,
} from './dto';
import { classifyIntent } from './intent-classifier';
import { isOpenNow, WorkTime } from './is-open-now';
import categoriesData from './categories.json';

type SeededCategory = {
  id: string;
  names: { ru: string; uk: string; en: string; az: string };
  synonyms: string[];
  icon?: string;
  color?: string;
  parentCategory?: string | null;
  popularity?: number;
  businessCountByCity?: Record<string, number>;
};

const SEEDED_CATEGORIES = categoriesData as SeededCategory[];

// Pre-build category synonym set (lowercased) for intent classifier.
const CATEGORY_SYNONYMS = new Set<string>(
  SEEDED_CATEGORIES.flatMap(c =>
    [...c.synonyms, ...Object.values(c.names)].map(s => s.toLowerCase().trim()),
  ),
);

// haversineKm helper removed by quick-260511-h2n — businesses no longer
// computed with a separate distance calc; branch.distance comes from the
// main search() Haversine SQL expression.

// Highlight first variant substring in text, wrap with <em>...</em>.
// Returns single-element array (matches content-search highlight shape).
function wrapHighlight(text: string, variants: string[]): string[] | undefined {
  if (!text) return undefined;
  const lower = text.toLowerCase();
  for (const v of variants) {
    if (v.length < 2) continue;
    const idx = lower.indexOf(v.toLowerCase());
    if (idx >= 0) {
      const before = text.slice(0, idx);
      const match = text.slice(idx, idx + v.length);
      const after = text.slice(idx + v.length);
      return [`${before}<em>${match}</em>${after}`];
    }
  }
  return undefined;
}

// Транслитерация кириллица ↔ латиница для мультиязычного поиска
const TRANSLIT_MAP: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'yo',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'kh',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'shch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
  і: 'i',
  ї: 'yi',
  є: 'ye',
  ґ: 'g',
};

const REVERSE_TRANSLIT: Record<string, string> = {};
for (const [cyr, lat] of Object.entries(TRANSLIT_MAP)) {
  if (lat) REVERSE_TRANSLIT[lat] = cyr;
}

function generateSearchVariants(q: string): string[] {
  const lower = q.toLowerCase().trim();
  const variants = new Set<string>([lower]);

  // Кириллица → латиница
  let latinized = '';
  for (const ch of lower) {
    latinized += TRANSLIT_MAP[ch] ?? ch;
  }
  variants.add(latinized);

  // Латиница → кириллица (простой посимвольный)
  let cyrillicized = '';
  for (const ch of lower) {
    cyrillicized += REVERSE_TRANSLIT[ch] ?? ch;
  }
  variants.add(cyrillicized);

  return [...variants].filter(v => v.length >= 2);
}

interface BranchResult {
  organization: {
    id: string;
    name: string;
    slug: string | null;
    category: string | null;
    description: string | null;
    avatar: string | null;
    averageRating: number;
    reviewCount: number;
    phones: any;
    /**
     * False for seed (non-partner) companies — scraped businesses that are not
     * registered on the platform. They have no services, no reviews and no
     * company page, so the frontend must not link them to /company/{slug} or
     * render a rating. True for every organization row.
     */
    isPartner: boolean;
    /**
     * Populated only when the request was filtered by orgCategory=BREEDERS.
     * Cross-service enrichment from organization-service's
     * /breeders/availability endpoint — surfaces marketplace activity
     * (which orgs currently have animals for sale, what breeds, etc.).
     * Absent on non-BREEDERS rows; zeroed entry when the org has no
     * AVAILABLE children in PUBLISHED litters at request time.
     */
    breedersInfo?: {
      hasAvailableAnimals: boolean;
      availableCount: number;
      availableBreeds: { value: string; count: number }[];
    };
  };
  branch: {
    id: string;
    name: string | null;
    address: string | null;
    city: string | null;
    lat: number;
    lon: number;
    distance: number | null;
    workTime: any;
    phone: any;
  } | null;
  services: {
    id: string;
    name: string;
    description: string | null;
    price: number | null;
    imageId: string | null;
    typeName: string;
    typeSlug: string;
    categoryName: string;
    categorySlug: string;
    variations: { id: string; name: string; price: number }[];
  }[];
}

export interface SearchResponse {
  data: BranchResult[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgServiceClient: OrgServiceClient,
    private readonly logger: LogService,
  ) {}

  /**
   * The row cap assumes the whole matching set fits under it. That assumption is
   * what silently broke before — the Kyiv map lost 751 of 1384 pins and nobody
   * noticed, because a capped query looks exactly like a complete one. Say so in
   * the logs when a source query comes back full, so growth in the data is what
   * raises the alarm, not users reporting missing pins.
   */
  private warnIfCapHit(source: string, rowCount: number, cap: number): void {
    if (rowCount < cap) return;
    this.logger.warn(
      `search: ${source} hit the row cap — results are incomplete and pagination will under-report`,
      { source, rowCount, cap },
    );
  }

  /**
   * Enrich the paginated page with breedersInfo when the search was
   * filtered to BREEDERS orgs. Single bulk call to organization-service;
   * absent orgs fall back to a zeroed entry. Failures (timeout / discovery)
   * leave breedersInfo undefined — search continues.
   */
  private async enrichWithBreedersInfo(
    rows: BranchResult[],
    orgCategory: string | undefined,
  ): Promise<void> {
    if (orgCategory !== 'BREEDERS' || rows.length === 0) return;
    const orgIds = [...new Set(rows.map((r) => r.organization.id))];
    const availability =
      await this.orgServiceClient.getBreedersAvailability(orgIds);
    for (const row of rows) {
      const entry = availability[row.organization.id];
      row.organization.breedersInfo = entry ?? {
        hasAvailableAnimals: false,
        availableCount: 0,
        availableBreeds: [],
      };
    }
  }

  /**
   * Единый поиск: Компания → Точка (адрес + гео) → Услуги.
   * Мультиязычный: укр/рус/eng с транслитерацией.
   * Матчит по: названию услуги, компании, категории, типу.
   */
  async search(query: SearchQueryDto): Promise<SearchResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;
    const hasGeo = query.lat != null && query.lon != null;
    const isGroupByOrg = query.groupBy === GroupBy.ORGANIZATION;
    // Queries A/B/C each read from OFFSET 0 and are merged into one map, which
    // is then sliced in JS to produce the page. Two rules follow, and the old
    // `limit * 5` default-path cap broke both:
    //
    // 1. The cap must be page-invariant. It decides how many rows each source
    //    contributes, and the merge order (A before B before C) depends on that,
    //    so a cap that grows with `offset` builds a different map per page and
    //    the slice boundaries drift — rows come back on two pages while others
    //    are never returned at all.
    // 2. The cap must cover the whole matching set. At `limit * 5` the Kyiv map
    //    (limit=100, cap=500) returned 633 of 1384 pins and served pages 8..14
    //    empty, while `total` — an uncapped COUNT — kept promising the rest.
    //
    // One generous, page-invariant cap satisfies both, and a spare LIMIT costs
    // almost nothing when fewer rows exist: on the Kyiv map, raising it from 500
    // to 20000 moved a page from 2.87s to 3.12s and made it complete.
    const sqlRowCap = Math.max(limit * 50, 20000);

    const conditions: string[] = ['s."isActive" = true'];
    const params: any[] = [];
    let paramIndex = 1;

    // Мультиязычный текстовый поиск
    if (query.q) {
      const variants = generateSearchVariants(query.q);
      const likeClauses: string[] = [];

      for (const variant of variants) {
        const likeParam = `%${variant}%`;
        const trgmParam = variant;
        likeClauses.push(`(
          s."name" ILIKE $${paramIndex} OR s."name" % $${paramIndex + 1}
          OR o."name" ILIKE $${paramIndex} OR o."name" % $${paramIndex + 1}
          OR sc."name" ILIKE $${paramIndex} OR sc."name" % $${paramIndex + 1}
          OR sc."slug" ILIKE $${paramIndex}
          OR st."name" ILIKE $${paramIndex} OR st."name" % $${paramIndex + 1}
          OR st."slug" ILIKE $${paramIndex}
        )`);
        params.push(likeParam, trgmParam);
        paramIndex += 2;
      }

      conditions.push(`(${likeClauses.join(' OR ')})`);
    }

    // Фильтр по рейтингу. CASE WHEN — orgs with reviewCount=0 default to 5★,
    // so they pass `rating >= N` predicates instead of being silently excluded.
    // Mirrors the SELECT expression in the same query so filter and display agree.
    if (query.rating != null) {
      conditions.push(
        `(CASE WHEN o."reviewCount" = 0 THEN 5 ELSE o."averageRating" END) >= $${paramIndex}`,
      );
      params.push(query.rating);
      paramIndex++;
    }

    // Фильтр по цене
    if (query.priceMin != null) {
      conditions.push(
        `COALESCE(s."price"::float, sp."minPrice") >= $${paramIndex}`,
      );
      params.push(query.priceMin);
      paramIndex++;
    }

    if (query.priceMax != null) {
      conditions.push(
        `COALESCE(s."price"::float, sp."minPrice") <= $${paramIndex}`,
      );
      params.push(query.priceMax);
      paramIndex++;
    }

    // Фильтр по категории
    if (query.categoryId) {
      conditions.push(`st."categoryId" = $${paramIndex}`);
      params.push(query.categoryId);
      paramIndex++;
    }

    // Фильтр по типу
    if (query.typeId) {
      conditions.push(`s."typeId" = $${paramIndex}`);
      params.push(query.typeId);
      paramIndex++;
    }

    // Фильтр по категории организации (PageCategory)
    if (query.orgCategory) {
      conditions.push(`o."category" = $${paramIndex}`);
      params.push(query.orgCategory);
      paramIndex++;
    }

    // Гео-фильтр через Haversine (PostGIS не установлен в проде Postgres image).
    // Use plain lat/lon columns + great-circle formula. The btree index
    // on (lat, lon) is not used for radius queries, but at MVP scale this is
    // acceptable and matches the pre-PostGIS behavior. To re-enable PostGIS
    // later, swap the docker image to postgis/postgis and re-add ST_DWithin.
    let distanceExpr = 'NULL::float';
    let geoCondition = '';
    if (hasGeo) {
      distanceExpr = `(
        6371 * acos(
          LEAST(1.0,
            cos(radians($${paramIndex})) * cos(radians(oa."lat"))
            * cos(radians(oa."lon") - radians($${paramIndex + 1}))
            + sin(radians($${paramIndex})) * sin(radians(oa."lat"))
          )
        )
      )`;
      params.push(query.lat, query.lon);
      paramIndex += 2;

      geoCondition = ` AND oa."lat" IS NOT NULL AND ${distanceExpr} <= $${paramIndex}`;
      // radius приходит в метрах из DTO (default 25000); Haversine считает в км, поэтому /1000.
      params.push((query.radius ?? 25000) / 1000);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ') + geoCondition;

    // P3 fix: real total count. The main data query is LIMIT-capped at
    // sqlRowCap (limit * 5) for grouping headroom, so groupMap.size would
    // misreport the actual number of matches. Run a separate COUNT over the
    // same FROM + WHERE with no LIMIT, counting either (org, branch) pairs
    // for the default path or distinct orgs for groupBy=organization.
    //
    // Note: this is Option A — counts Query A matches only. Orgs found
    // exclusively via Query B (org/branch-name match without service hit)
    // are not in this total, so groupBy mode may slightly under-count when
    // Query B adds extras. Acceptable trade-off: 2% miss beats today's
    // 5x lie (see P3 brief).
    // P3+ fix: when the data path runs Query B (org-rooted) as a fallback for
    // service-less orgs, the count must also union Query B's universe, else
    // total dramatically under-reports on installs where most orgs have no
    // services. Mirrors the data path's `skipQueryB` rule.
    const skipQueryBForCount =
      query.priceMin != null ||
      query.priceMax != null ||
      query.categoryId != null ||
      query.typeId != null;

    const countSelectKey = isGroupByOrg
      ? 's."organizationId"'
      : 's."organizationId", oa."id"';
    const countSelectKeyB = isGroupByOrg ? 'o."id"' : 'o."id", oa."id"';

    // Build Query-B-equivalent WHERE for the count side. Parameter indices
    // continue from `paramIndex` after Query A's params so the merged param
    // array stays consistent.
    const countParamsB: any[] = [];
    let countPIdxB = paramIndex;
    const countCondsB: string[] = ['o."isActive" = true'];
    if (!skipQueryBForCount && query.q) {
      const variantsB = generateSearchVariants(query.q);
      const likesB: string[] = [];
      for (const v of variantsB) {
        likesB.push(`(
          o."name" ILIKE $${countPIdxB} OR o."name" % $${countPIdxB + 1}
          OR o."category" ILIKE $${countPIdxB} OR o."category" % $${countPIdxB + 1}
          OR oa."name" ILIKE $${countPIdxB} OR oa."name" % $${countPIdxB + 1}
          OR oa."address" ILIKE $${countPIdxB} OR oa."address" % $${countPIdxB + 1}
          OR oa."city" ILIKE $${countPIdxB} OR oa."city" % $${countPIdxB + 1}
        )`);
        countParamsB.push(`%${v}%`, v);
        countPIdxB += 2;
      }
      countCondsB.push(`(${likesB.join(' OR ')})`);
    }
    if (!skipQueryBForCount && query.rating != null) {
      countCondsB.push(
        `(CASE WHEN o."reviewCount" = 0 THEN 5 ELSE o."averageRating" END) >= $${countPIdxB}`,
      );
      countParamsB.push(query.rating);
      countPIdxB++;
    }
    if (!skipQueryBForCount && query.orgCategory) {
      countCondsB.push(`o."category" = $${countPIdxB}`);
      countParamsB.push(query.orgCategory);
      countPIdxB++;
    }
    let countDistanceExprB = 'NULL::float';
    let countGeoB = '';
    if (!skipQueryBForCount && hasGeo) {
      countDistanceExprB = `(
        6371 * acos(
          LEAST(1.0,
            cos(radians($${countPIdxB})) * cos(radians(oa."lat"))
            * cos(radians(oa."lon") - radians($${countPIdxB + 1}))
            + sin(radians($${countPIdxB})) * sin(radians(oa."lat"))
          )
        )
      )`;
      countParamsB.push(query.lat, query.lon);
      countPIdxB += 2;
      countGeoB = ` AND oa."lat" IS NOT NULL AND ${countDistanceExprB} <= $${countPIdxB}`;
      countParamsB.push((query.radius ?? 25000) / 1000);
      countPIdxB++;
    }
    const whereClauseCountB = countCondsB.join(' AND ') + countGeoB;

    // Count mirror for Query C (seed companies). Same gate as the data path —
    // including `rating`, which excludes seed rows entirely. Parameter indices
    // continue after Query B's so the merged param array stays positional.
    const skipQueryCForCount = skipQueryBForCount || query.rating != null;

    const countSelectKeyC = isGroupByOrg
      ? 'sc."id"'
      : 'sc."id", sc."id" AS "branchId"';

    const countParamsC: any[] = [];
    let countPIdxC = countPIdxB;
    const countCondsC: string[] = [];
    if (!skipQueryCForCount && query.q) {
      const variantsC = generateSearchVariants(query.q);
      const likesC: string[] = [];
      for (const v of variantsC) {
        likesC.push(`(
          sc."name" ILIKE $${countPIdxC} OR sc."name" % $${countPIdxC + 1}
          OR sc."address" ILIKE $${countPIdxC} OR sc."address" % $${countPIdxC + 1}
          OR sc."place" ILIKE $${countPIdxC} OR sc."place" % $${countPIdxC + 1}
        )`);
        countParamsC.push(`%${v}%`, v);
        countPIdxC += 2;
      }
      countCondsC.push(`(${likesC.join(' OR ')})`);
    }
    if (!skipQueryCForCount && query.orgCategory) {
      countCondsC.push(`sc."category" = $${countPIdxC}`);
      countParamsC.push(query.orgCategory);
      countPIdxC++;
    }
    let countGeoC = '';
    if (!skipQueryCForCount && hasGeo) {
      const countDistanceExprC = `(
        6371 * acos(
          LEAST(1.0,
            cos(radians($${countPIdxC})) * cos(radians(sc."lat"))
            * cos(radians(sc."lon") - radians($${countPIdxC + 1}))
            + sin(radians($${countPIdxC})) * sin(radians(sc."lat"))
          )
        )
      )`;
      countParamsC.push(query.lat, query.lon);
      countPIdxC += 2;
      countGeoC = ` AND ${countDistanceExprC} <= $${countPIdxC}`;
      countParamsC.push((query.radius ?? 25000) / 1000);
      countPIdxC++;
    }
    const whereClauseCountC =
      (countCondsC.length ? countCondsC.join(' AND ') : 'TRUE') + countGeoC;

    const countSqlA = `
      SELECT DISTINCT ${countSelectKey}
      FROM services s
      JOIN service_types st ON s."typeId" = st."id"
      JOIN service_categories sc ON st."categoryId" = sc."id"
      LEFT JOIN organizations o ON s."organizationId" = o."id"
      LEFT JOIN location_services ls ON ls."serviceId" = s."id"
      LEFT JOIN LATERAL (
        SELECT oa2.*
        FROM organization_addresses oa2
        WHERE oa2."id" = ls."locationId"
           OR (ls."locationId" IS NULL AND oa2."organizationId" = s."organizationId")
      ) oa ON true
      LEFT JOIN service_min_prices sp ON sp."serviceId" = s."id"
      WHERE ${whereClause}
    `;
    const countSqlB = `
      SELECT DISTINCT ${countSelectKeyB}
      FROM organizations o
      LEFT JOIN LATERAL (
        SELECT oa2.*
        FROM organization_addresses oa2
        WHERE oa2."organizationId" = o."id"
      ) oa ON true
      WHERE ${whereClauseCountB}
    `;
    const countSqlC = `
      SELECT DISTINCT ${countSelectKeyC}
      FROM seed_companies sc
      WHERE ${whereClauseCountC}
    `;
    const countSql = `
      WITH service_min_prices AS (
        SELECT "serviceId", MIN("price")::float AS "minPrice"
        FROM service_variations
        WHERE "isActive" = true
        GROUP BY "serviceId"
      )
      SELECT COUNT(*) AS "total" FROM (
        ${countSqlA}
        ${skipQueryBForCount ? '' : `UNION ${countSqlB}`}
        ${skipQueryCForCount ? '' : `UNION ${countSqlC}`}
      ) merged
    `;
    const countRows = await this.prisma.$queryRawUnsafe<{ total: bigint }[]>(
      countSql,
      ...params,
      ...countParamsB,
      ...countParamsC,
    );
    const realTotal = Number(countRows[0]?.total ?? 0);

    // Сортировка
    let orderBy: string;
    switch (query.sort) {
      case SearchSortBy.NAME:
        orderBy = 'o."name" ASC NULLS LAST';
        break;
      case SearchSortBy.DISTANCE:
        orderBy = hasGeo ? 'distance ASC NULLS LAST' : 'o."averageRating" DESC';
        break;
      case SearchSortBy.RATING:
        orderBy = 'o."averageRating" DESC';
        break;
      case SearchSortBy.PRICE_ASC:
        orderBy = 'COALESCE(s."price"::float, sp."minPrice") ASC NULLS LAST';
        break;
      case SearchSortBy.PRICE_DESC:
        orderBy = 'COALESCE(s."price"::float, sp."minPrice") DESC NULLS LAST';
        break;
      default:
        orderBy = 'o."averageRating" DESC, s."name" ASC';
    }

    // Every sort above can tie (same rating, same name, same price), and each
    // page re-runs the query from OFFSET 0 with a different LIMIT before slicing
    // the merged map. Without a unique final key Postgres is free to order tied
    // rows differently per run, so page boundaries drifted: 79 of 1732 Kyiv rows
    // came back on two pages while 79 others were never returned at all.
    const tieBreakA = ', s."organizationId", oa."id" NULLS LAST, s."id"';

    // Основной запрос: плоский список (услуга + точка + организация)
    const sql = `
      WITH service_min_prices AS (
        SELECT "serviceId", MIN("price")::float AS "minPrice"
        FROM service_variations
        WHERE "isActive" = true
        GROUP BY "serviceId"
      )
      SELECT
        s."id" AS "serviceId",
        s."name" AS "serviceName",
        s."description" AS "serviceDescription",
        s."price"::float AS "servicePrice",
        s."imageId" AS "serviceImageId",
        s."organizationId",
        st."name" AS "typeName",
        st."slug" AS "typeSlug",
        sc."name" AS "categoryName",
        sc."slug" AS "categorySlug",
        o."id" AS "orgId",
        o."name" AS "orgName",
        o."slug" AS "orgSlug",
        o."category" AS "orgCategory",
        o."description" AS "orgDescription",
        o."avatar" AS "orgAvatar",
        o."phones" AS "orgPhones",
        CASE WHEN o."reviewCount" = 0 THEN 5 ELSE o."averageRating" END AS "orgRating",
        COALESCE(o."reviewCount", 0) AS "orgReviewCount",
        oa."id" AS "branchId",
        oa."name" AS "branchName",
        oa."address" AS "branchAddress",
        oa."city" AS "branchCity",
        oa."lat" AS "branchLat",
        oa."lon" AS "branchLon",
        oa."workTime" AS "branchWorkTime",
        oa."phone" AS "branchPhone",
        ${distanceExpr} AS distance,
        sp."minPrice",
        COUNT(*) OVER() AS "totalCount"
      FROM services s
      JOIN service_types st ON s."typeId" = st."id"
      JOIN service_categories sc ON st."categoryId" = sc."id"
      LEFT JOIN organizations o ON s."organizationId" = o."id"
      LEFT JOIN location_services ls ON ls."serviceId" = s."id"
      LEFT JOIN LATERAL (
        SELECT oa2.*
        FROM organization_addresses oa2
        WHERE oa2."id" = ls."locationId"
           OR (ls."locationId" IS NULL AND oa2."organizationId" = s."organizationId")
      ) oa ON true
      LEFT JOIN service_min_prices sp ON sp."serviceId" = s."id"
      WHERE ${whereClause}
      ORDER BY ${orderBy}${tieBreakA}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(sqlRowCap, 0); // берём с запасом для группировки (raised in groupBy=organization mode)

    const rows = await this.prisma.$queryRawUnsafe<any[]>(sql, ...params);
    this.warnIfCapHit('query A (services)', rows.length, sqlRowCap);

    // Группировка: orgId+branchId → { organization, branch, services[] }
    const groupKey = (r: any) =>
      `${r.orgId ?? r.organizationId}::${r.branchId ?? 'no-branch'}`;

    const groupMap = new Map<string, BranchResult>();

    for (const r of rows) {
      const key = groupKey(r);

      if (!groupMap.has(key)) {
        groupMap.set(key, {
          organization: {
            id: r.orgId ?? r.organizationId,
            name: r.orgName ?? null,
            slug: r.orgSlug ?? null,
            category: r.orgCategory ?? null,
            description: r.orgDescription ?? null,
            avatar: r.orgAvatar ?? null,
            averageRating: Number(r.orgRating) || 0,
            reviewCount: Number(r.orgReviewCount) || 0,
            phones: r.orgPhones ?? null,
            isPartner: true,
          },
          branch: r.branchId
            ? {
                id: r.branchId,
                name: r.branchName,
                address: r.branchAddress,
                city: r.branchCity,
                lat: r.branchLat,
                lon: r.branchLon,
                distance:
                  r.distance != null
                    ? Math.round(r.distance * 100) / 100
                    : null,
                workTime: r.branchWorkTime,
                phone: r.branchPhone ?? null,
              }
            : null,
          services: [],
        });
      }

      const group = groupMap.get(key)!;
      // Не дублировать услугу в одной группе
      if (!group.services.some(s => s.id === r.serviceId)) {
        group.services.push({
          id: r.serviceId,
          name: r.serviceName,
          description: r.serviceDescription,
          price: r.servicePrice ?? r.minPrice ?? null,
          imageId: r.serviceImageId,
          typeName: r.typeName,
          typeSlug: r.typeSlug,
          categoryName: r.categoryName,
          categorySlug: r.categorySlug,
          variations: [],
        });
      }
    }

    // Подтянуть вариации для найденных услуг
    const allServiceIds = [...new Set(rows.map(r => r.serviceId))];
    if (allServiceIds.length > 0) {
      const variations = await this.prisma.serviceVariation.findMany({
        where: { serviceId: { in: allServiceIds }, isActive: true },
        select: { id: true, serviceId: true, name: true, price: true },
      });

      for (const group of groupMap.values()) {
        for (const svc of group.services) {
          svc.variations = variations
            .filter(v => v.serviceId === svc.id)
            .map(v => ({
              id: v.id,
              name: v.name,
              price: Number(v.price),
            }));
        }
      }
    }

    // Query B — org-rooted: match orgs whose name/category/branch fields ILIKE
    // the query variants, EVEN IF they have zero seeded services. This closes
    // Bug 1 (q=груминг returns 0 because "Грумінг-салон PetStyle" has org+addr
    // but no services; Query A's `FROM services s` strips it before WHERE).
    //
    // quick-260511-h2n: also runs in BROWSE mode (no q) so the catalog map
    // shows orgs without services as pins — Query A's `FROM services s` was
    // hiding them. Filter conditions (rating, orgCategory, geo) still apply.
    //
    // Skipped only when service-bound filters are present (priceMin/Max/
    // categoryId/typeId require a service row to filter on; Query B has none,
    // so skipping preserves filter semantics — orgs without services SHOULD
    // NOT pass a price filter).
    const skipQueryB =
      query.priceMin != null ||
      query.priceMax != null ||
      query.categoryId != null ||
      query.typeId != null;

    if (!skipQueryB) {
      const conditionsB: string[] = ['o."isActive" = true'];
      const paramsB: any[] = [];
      let pIdxB = 1;

      // Text-match clauses ONLY when q present. Without q, Query B becomes a
      // pure filter-by-geo/rating/orgCategory browse for orgs (with or
      // without services) in the requested radius.
      if (query.q) {
        const variantsB = generateSearchVariants(query.q);
        const likeClausesB: string[] = [];
        for (const variant of variantsB) {
          const likeParam = `%${variant}%`;
          const trgmParam = variant;
          likeClausesB.push(`(
            o."name" ILIKE $${pIdxB} OR o."name" % $${pIdxB + 1}
            OR o."category" ILIKE $${pIdxB} OR o."category" % $${pIdxB + 1}
            OR oa."name" ILIKE $${pIdxB} OR oa."name" % $${pIdxB + 1}
            OR oa."address" ILIKE $${pIdxB} OR oa."address" % $${pIdxB + 1}
            OR oa."city" ILIKE $${pIdxB} OR oa."city" % $${pIdxB + 1}
          )`);
          paramsB.push(likeParam, trgmParam);
          pIdxB += 2;
        }
        conditionsB.push(`(${likeClausesB.join(' OR ')})`);
      }

      if (query.rating != null) {
        // Same default-5 CASE expression as Query A's rating predicate.
        conditionsB.push(
          `(CASE WHEN o."reviewCount" = 0 THEN 5 ELSE o."averageRating" END) >= $${pIdxB}`,
        );
        paramsB.push(query.rating);
        pIdxB++;
      }

      if (query.orgCategory) {
        conditionsB.push(`o."category" = $${pIdxB}`);
        paramsB.push(query.orgCategory);
        pIdxB++;
      }

      let distanceExprB = 'NULL::float';
      let geoConditionB = '';
      if (hasGeo) {
        // Haversine — see Query A note on PostGIS rollback.
        distanceExprB = `(
          6371 * acos(
            LEAST(1.0,
              cos(radians($${pIdxB})) * cos(radians(oa."lat"))
              * cos(radians(oa."lon") - radians($${pIdxB + 1}))
              + sin(radians($${pIdxB})) * sin(radians(oa."lat"))
            )
          )
        )`;
        paramsB.push(query.lat, query.lon);
        pIdxB += 2;

        geoConditionB = ` AND oa."lat" IS NOT NULL AND ${distanceExprB} <= $${pIdxB}`;
        // radius приходит в метрах из DTO (default 25000); Haversine считает в км, поэтому /1000.
        paramsB.push((query.radius ?? 25000) / 1000);
        pIdxB++;
      }

      const whereClauseB = conditionsB.join(' AND ') + geoConditionB;

      // Org-rooted ordering: distance/rating/name only (no service price here).
      let orderByB: string;
      switch (query.sort) {
        case SearchSortBy.NAME:
          orderByB = 'o."name" ASC NULLS LAST';
          break;
        case SearchSortBy.DISTANCE:
          orderByB = hasGeo
            ? 'distance ASC NULLS LAST'
            : 'o."averageRating" DESC';
          break;
        case SearchSortBy.RATING:
          orderByB = 'o."averageRating" DESC';
          break;
        default:
          orderByB = 'o."averageRating" DESC, o."name" ASC';
      }

      const sqlB = `
        SELECT
          o."id" AS "orgId",
          o."name" AS "orgName",
          o."slug" AS "orgSlug",
          o."category" AS "orgCategory",
          o."description" AS "orgDescription",
          o."avatar" AS "orgAvatar",
          o."phones" AS "orgPhones",
          CASE WHEN o."reviewCount" = 0 THEN 5 ELSE o."averageRating" END AS "orgRating",
          COALESCE(o."reviewCount", 0) AS "orgReviewCount",
          oa."id" AS "branchId",
          oa."name" AS "branchName",
          oa."address" AS "branchAddress",
          oa."city" AS "branchCity",
          oa."lat" AS "branchLat",
          oa."lon" AS "branchLon",
          oa."workTime" AS "branchWorkTime",
          oa."phone" AS "branchPhone",
          ${distanceExprB} AS distance
        FROM organizations o
        LEFT JOIN LATERAL (
          SELECT oa2.*
          FROM organization_addresses oa2
          WHERE oa2."organizationId" = o."id"
        ) oa ON true
        WHERE ${whereClauseB}
        ORDER BY ${orderByB}, o."id", oa."id" NULLS LAST
        LIMIT $${pIdxB} OFFSET 0
      `;
      paramsB.push(sqlRowCap);

      const rowsB = await this.prisma.$queryRawUnsafe<any[]>(sqlB, ...paramsB);
      this.warnIfCapHit('query B (organizations)', rowsB.length, sqlRowCap);

      // Merge: only insert org-rooted rows that don't already exist in groupMap
      // (guards against duplicating an org that already had matching services).
      for (const r of rowsB) {
        const key = `${r.orgId}::${r.branchId ?? 'no-branch'}`;
        if (groupMap.has(key)) continue;

        groupMap.set(key, {
          organization: {
            id: r.orgId,
            name: r.orgName ?? null,
            slug: r.orgSlug ?? null,
            category: r.orgCategory ?? null,
            description: r.orgDescription ?? null,
            avatar: r.orgAvatar ?? null,
            averageRating: Number(r.orgRating) || 0,
            reviewCount: Number(r.orgReviewCount) || 0,
            phones: r.orgPhones ?? null,
            isPartner: true,
          },
          branch: r.branchId
            ? {
                id: r.branchId,
                name: r.branchName,
                address: r.branchAddress,
                city: r.branchCity,
                lat: r.branchLat,
                lon: r.branchLon,
                distance:
                  r.distance != null
                    ? Math.round(r.distance * 100) / 100
                    : null,
                workTime: r.branchWorkTime,
                phone: r.branchPhone ?? null,
              }
            : null,
          services: [],
        });
      }
    }

    // Query C: seed (non-partner) companies — scraped businesses with no
    // services, no account and no platform reviews. Mirrors Query B's shape
    // (a serviceless row still needs a branch to become a map pin), reading
    // from the local `seed_companies` copy.
    //
    // Skipped on service-bound filters for the same reason as Query B, PLUS on
    // `rating`: a seed row has no platform reviews, and Query B's
    // "reviewCount = 0 -> treat as 5 stars" rule would otherwise let every seed
    // company pass a "5 stars only" filter as a fake five-star business.
    //
    // Merged last and never overwrites an existing key, so partners always rank
    // above non-partners — matching the legacy Convex catalog behaviour.
    const skipQueryC =
      query.priceMin != null ||
      query.priceMax != null ||
      query.categoryId != null ||
      query.typeId != null ||
      query.rating != null;

    if (!skipQueryC) {
      const conditionsC: string[] = [];
      const paramsC: any[] = [];
      let pIdxC = 1;

      if (query.q) {
        const variantsC = generateSearchVariants(query.q);
        const likeClausesC: string[] = [];
        for (const variant of variantsC) {
          likeClausesC.push(`(
            sc."name" ILIKE $${pIdxC} OR sc."name" % $${pIdxC + 1}
            OR sc."address" ILIKE $${pIdxC} OR sc."address" % $${pIdxC + 1}
            OR sc."place" ILIKE $${pIdxC} OR sc."place" % $${pIdxC + 1}
          )`);
          paramsC.push(`%${variant}%`, variant);
          pIdxC += 2;
        }
        conditionsC.push(`(${likeClausesC.join(' OR ')})`);
      }

      if (query.orgCategory) {
        // `category` is stored pre-normalized to the enum form on import,
        // so it compares directly against the same values organizations use.
        conditionsC.push(`sc."category" = $${pIdxC}`);
        paramsC.push(query.orgCategory);
        pIdxC++;
      }

      let distanceExprC = 'NULL::float';
      let geoConditionC = '';
      if (hasGeo) {
        // Haversine — see Query A note on PostGIS rollback.
        distanceExprC = `(
          6371 * acos(
            LEAST(1.0,
              cos(radians($${pIdxC})) * cos(radians(sc."lat"))
              * cos(radians(sc."lon") - radians($${pIdxC + 1}))
              + sin(radians($${pIdxC})) * sin(radians(sc."lat"))
            )
          )
        )`;
        paramsC.push(query.lat, query.lon);
        pIdxC += 2;

        geoConditionC = ` AND ${distanceExprC} <= $${pIdxC}`;
        paramsC.push((query.radius ?? 25000) / 1000);
        pIdxC++;
      }

      const whereClauseC =
        (conditionsC.length ? conditionsC.join(' AND ') : 'TRUE') +
        geoConditionC;

      // No rating and no price on a seed row — only distance and name can order it.
      const orderByC =
        query.sort === SearchSortBy.DISTANCE && hasGeo
          ? 'distance ASC NULLS LAST'
          : 'sc."name" ASC';

      const sqlC = `
        SELECT
          sc."id" AS "seedId",
          sc."name" AS "seedName",
          sc."category" AS "seedCategory",
          sc."address" AS "seedAddress",
          sc."place" AS "seedPlace",
          sc."phone" AS "seedPhone",
          sc."lat" AS "seedLat",
          sc."lon" AS "seedLon",
          ${distanceExprC} AS distance
        FROM seed_companies sc
        WHERE ${whereClauseC}
        ORDER BY ${orderByC}, sc."id"
        LIMIT $${pIdxC} OFFSET 0
      `;
      paramsC.push(sqlRowCap);

      const rowsC = await this.prisma.$queryRawUnsafe<any[]>(sqlC, ...paramsC);
      this.warnIfCapHit('query C (seed companies)', rowsC.length, sqlRowCap);

      for (const r of rowsC) {
        // A seed company has no separate branch entity — the address is part of
        // the row — so its own id doubles as the branch id. The frontend uses
        // branch.id to de-duplicate map markers, so it must be stable and unique.
        const key = `${r.seedId}::${r.seedId}`;
        if (groupMap.has(key)) continue;

        const phones = r.seedPhone ? [r.seedPhone] : null;

        groupMap.set(key, {
          organization: {
            id: r.seedId,
            // `slug` in the source is the CATEGORY slug ("vet-clinics"), not a
            // business slug. Exposing it would make the frontend build a broken
            // /company/{slug} link, so a seed company has no slug at all.
            slug: null,
            name: r.seedName,
            category: r.seedCategory ?? null,
            description: null,
            avatar: null,
            // Scraped Google ratings are not platform reviews and are not shown.
            averageRating: 0,
            reviewCount: 0,
            phones,
            isPartner: false,
          },
          branch: {
            id: r.seedId,
            name: null,
            address: r.seedAddress ?? null,
            city: r.seedPlace ?? null,
            lat: r.seedLat,
            lon: r.seedLon,
            distance:
              r.distance != null ? Math.round(r.distance * 100) / 100 : null,
            workTime: null,
            phone: phones,
          },
          services: [],
        });
      }
    }

    // Default path (groupBy absent / not 'organization') — byte-identical to
    // pre-quick-260512-nvd behavior. One row per (org, branch) tuple.
    if (!isGroupByOrg) {
      const allGroups = [...groupMap.values()];
      // P3 fix: total comes from the dedicated COUNT query (computed before
      // the LIMIT-capped main fetch), not from the over-fetched groupMap.
      const total = realTotal;
      const paginated = allGroups.slice(offset, offset + limit);

      await this.enrichWithBreedersInfo(paginated, query.orgCategory);

      return {
        data: paginated,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      };
    }

    // groupBy=organization path — two-pass dedupe with deterministic
    // representative-branch selection.
    //
    // Pass 1: scan groupMap in INSERTION ORDER (which reflects SQL ORDER BY
    // for Query A, then Query B). Track:
    //   - orgRepresentative: orgId → BranchResult (current best candidate)
    //   - orgFirstSeenIndex: orgId → integer (position of first row for that
    //     org in groupMap — used as stable output sort key, preserves
    //     existing sort semantics).
    //
    // Best-representative rule:
    //   - If candidate has a branch and current best has no branch → replace.
    //   - If both have branches and hasGeo:
    //       prefer smaller branch.distance (null treated as +Infinity, so
    //       any non-null distance beats null). Ties broken by lex(branch.id)
    //       ASC (deterministic & stable across paginated requests).
    //   - If both have branches and NOT hasGeo:
    //       prefer lex(branch.id) ASC.
    //   - If candidate has no branch and current best has a branch → keep best.
    //   - Branchless orgs only emit if NO branched candidate exists for that org.
    const orgRepresentative = new Map<string, BranchResult>();
    const orgFirstSeenIndex = new Map<string, number>();
    let idx = 0;
    for (const candidate of groupMap.values()) {
      const orgId = candidate.organization.id;
      if (!orgFirstSeenIndex.has(orgId)) {
        orgFirstSeenIndex.set(orgId, idx);
      }
      idx++;

      const current = orgRepresentative.get(orgId);
      if (!current) {
        orgRepresentative.set(orgId, candidate);
        continue;
      }

      // Both rows for the same org — pick the better representative.
      const curHasBranch = current.branch !== null;
      const candHasBranch = candidate.branch !== null;

      if (candHasBranch && !curHasBranch) {
        orgRepresentative.set(orgId, candidate);
        continue;
      }
      if (!candHasBranch && curHasBranch) {
        continue; // keep current
      }
      if (!candHasBranch && !curHasBranch) {
        continue; // both branchless — first one wins (stable)
      }

      // Both have branches.
      const curBranch = current.branch!;
      const candBranch = candidate.branch!;

      if (hasGeo) {
        const curDist = curBranch.distance ?? Number.POSITIVE_INFINITY;
        const candDist = candBranch.distance ?? Number.POSITIVE_INFINITY;
        if (candDist < curDist) {
          orgRepresentative.set(orgId, candidate);
          continue;
        }
        if (candDist > curDist) {
          continue;
        }
        // Tie on distance — break by lex(branch.id) ASC.
        if (candBranch.id < curBranch.id) {
          orgRepresentative.set(orgId, candidate);
        }
        continue;
      }

      // No geo — pure lex(branch.id) ASC.
      if (candBranch.id < curBranch.id) {
        orgRepresentative.set(orgId, candidate);
      }
    }

    // Pass 2: emit representatives sorted by orgFirstSeenIndex (preserves
    // the SQL ORDER BY semantics — the org's first appearance dictates its
    // position in the output, regardless of which branch ended up as rep).
    const uniqueOrgs = [...orgRepresentative.entries()]
      .sort(
        (a, b) =>
          (orgFirstSeenIndex.get(a[0]) ?? 0) -
          (orgFirstSeenIndex.get(b[0]) ?? 0),
      )
      .map(([, rep]) => rep);

    // P3 fix: total comes from the dedicated COUNT query (counts distinct
    // orgs in groupBy mode), not from the LIMIT-capped uniqueOrgs.length.
    const total = realTotal;
    const paginated = uniqueOrgs.slice(offset, offset + limit);

    await this.enrichWithBreedersInfo(paginated, query.orgCategory);

    return {
      data: paginated,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasMore: page * limit < total,
    };
  }

  // Lazy cache (60s TTL) for service-name synonyms used by intent classifier.
  private serviceSynonymsCache: Set<string> | null = null;
  private serviceSynonymsCacheTs = 0;

  private async getServiceSynonyms(): Promise<Set<string>> {
    const now = Date.now();
    if (
      this.serviceSynonymsCache &&
      now - this.serviceSynonymsCacheTs < 60_000
    ) {
      return this.serviceSynonymsCache;
    }
    const types = await this.prisma.serviceType.findMany({
      select: { name: true, slug: true },
    });
    const set = new Set<string>();
    for (const t of types) {
      set.add(t.name.toLowerCase());
      set.add(t.slug.toLowerCase());
    }
    this.serviceSynonymsCache = set;
    this.serviceSynonymsCacheTs = now;
    return set;
  }

  /**
   * Detail of a single seed (non-partner) company, for the reduced page these
   * get instead of /company/{slug}. Contacts and location only — a seed company
   * has no services, no schedule, and its scraped rating is not exposed.
   */
  async getSeedCompany(id: string): Promise<SeedCompanyDto> {
    const rows = await this.prisma.$queryRawUnsafe<
      {
        id: string;
        name: string;
        category: string;
        slug: string;
        phone: string | null;
        address: string | null;
        place: string | null;
        lat: number;
        lon: number;
        email: string | null;
        facebook: string | null;
        instagram: string | null;
        whatsapp: string | null;
      }[]
    >(
      `SELECT "id", "name", "category", "slug", "phone", "address", "place",
              "lat", "lon", "email", "facebook", "instagram", "whatsapp"
         FROM seed_companies
        WHERE "id" = $1`,
      id,
    );

    const row = rows[0];
    if (!row) {
      throw new NotFoundException(`Seed company ${id} not found`);
    }

    return {
      id: row.id,
      name: row.name,
      category: row.category,
      categorySlug: row.slug,
      phone: row.phone ?? undefined,
      address: row.address ?? undefined,
      city: row.place ?? undefined,
      lat: row.lat,
      lon: row.lon,
      email: row.email ?? undefined,
      facebook: row.facebook ?? undefined,
      instagram: row.instagram ?? undefined,
      whatsapp: row.whatsapp ?? undefined,
    };
  }

  /**
   * Phase 7 typed-sections autocomplete.
   * Returns { query, intent, sections: { categories, businesses, services }, took, cached }.
   * Categories source: static JSON seed (22 multilingual entries).
   * Businesses/services: Postgres ILIKE on org/service names.
   */
  async suggest(query: SuggestQueryDto): Promise<SuggestResponseDto> {
    const t0 = Date.now();
    const q = query.q.trim();
    const lang = query.lang ?? 'ru';
    const variants = generateSearchVariants(q);

    // quick-260511-h2n: businesses[] now mirrors main /search BranchResult
    // shape (organization+branch+services). Reuse the search() method so
    // suggest and /search return the SAME data — only difference is the
    // wrapping ({sections.businesses} vs {data}) and the limit (5 vs 20).
    // Drop the legacy flat-shape findBusinessesPg helper.
    // categories is sync — pulled out of Promise.all to keep eslint happy.
    // lang dropped from findCategoriesFromSeed signature (was unused; eslint
    // no-unused-vars). Kept on the suggest() input + intent classifier.
    void lang;
    const categories = this.findCategoriesFromSeed(variants);
    const [businessesSearch, services] = await Promise.all([
      this.searchBusinessesViaSearch(q, query.lat, query.lon),
      this.findServicesPg(variants),
    ]);

    const businesses = this.mapBranchResultsToSuggestBusinesses(
      businessesSearch,
      variants,
    );

    const serviceSynonyms = await this.getServiceSynonyms();
    const intent = classifyIntent({
      query: q,
      categorySynonyms: CATEGORY_SYNONYMS,
      serviceSynonyms,
    });

    return {
      query: q,
      intent,
      sections: { categories, businesses, services },
      took: Date.now() - t0,
      cached: false,
    };
  }

  // Reuse the main search() method to fetch businesses for suggest. Same
  // SQL, same joins, same pg_trgm typo tolerance — only different paging
  // (limit=5 for autocomplete UX). radius default 25000m (25 km) matches main
  // search behavior. Returns raw BranchResult[]; mapping to SuggestBusinessDto
  // happens in mapBranchResultsToSuggestBusinesses.
  private async searchBusinessesViaSearch(
    q: string,
    lat?: number,
    lon?: number,
  ): Promise<BranchResult[]> {
    const searchQuery: SearchQueryDto = {
      q,
      lat,
      lon,
      radius: 25000,
      sort: SearchSortBy.RELEVANCE,
      page: 1,
      limit: 5,
    };
    const resp = await this.search(searchQuery);
    return resp.data;
  }

  // Convert main /search BranchResult[] into SuggestBusinessDto[] — drops
  // any rows without a branch (suggest must never surface address-less orgs;
  // FE has no branch.id to navigate to), copies branch.distance to top-level
  // distanceKm + computes isOpenNow from branch.workTime + adds highlight.
  private mapBranchResultsToSuggestBusinesses(
    rows: BranchResult[],
    variants: string[],
  ): SuggestBusinessDto[] {
    return rows
      .filter(r => r.branch !== null)
      .map(r => {
        const branch = r.branch!;
        const dto: SuggestBusinessDto = {
          type: 'business',
          organization: r.organization,
          branch,
          services: r.services,
        };
        if (branch.distance != null) {
          dto.distanceKm = branch.distance;
        }
        if (branch.workTime) {
          dto.isOpenNow = isOpenNow(branch.workTime as WorkTime);
        }
        const hl = wrapHighlight(r.organization.name ?? '', variants);
        if (hl) dto.highlight = { name: hl };
        return dto;
      });
  }

  // -------- /suggest helpers --------

  private findCategoriesFromSeed(variants: string[]): SuggestCategoryDto[] {
    const lowerVariants = variants.map(v => v.toLowerCase());
    type Scored = { cat: SeededCategory; score: number };
    const scored: Scored[] = [];

    for (const cat of SEEDED_CATEGORIES) {
      const haystack: string[] = [
        cat.id.toLowerCase(),
        ...cat.synonyms.map(s => s.toLowerCase()),
        ...Object.values(cat.names).map(n => n.toLowerCase()),
      ];
      let score = 0;
      for (const v of lowerVariants) {
        for (const h of haystack) {
          if (h.includes(v)) score += 1;
        }
      }
      if (score > 0) scored.push({ cat, score });
    }

    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const popA = a.cat.popularity ?? 0;
      const popB = b.cat.popularity ?? 0;
      return popB - popA;
    });

    return scored.slice(0, 5).map(({ cat }) => ({
      type: 'category' as const,
      id: cat.id,
      names: cat.names,
      icon: cat.icon,
      color: cat.color,
      popularity: cat.popularity,
    }));
  }

  // findBusinessesPg removed by quick-260511-h2n — businesses now come from
  // search() via searchBusinessesViaSearch + mapBranchResultsToSuggestBusinesses
  // (see suggest() above).

  private async findServicesPg(
    variants: string[],
  ): Promise<SuggestServiceDto[]> {
    if (variants.length === 0) return [];

    const params: any[] = [];
    let pIdx = 1;
    const likeClauses: string[] = [];
    for (const v of variants) {
      params.push(`%${v}%`, v);
      likeClauses.push(`(s."name" ILIKE $${pIdx} OR s."name" % $${pIdx + 1})`);
      pIdx += 2;
    }

    const sql = `
      SELECT
        s."id",
        s."name",
        s."organizationId",
        o."name" AS "organizationName",
        o."category" AS "organizationCategory",
        CASE WHEN o."reviewCount" = 0 THEN 5 ELSE o."averageRating" END AS "organizationRating"
      FROM services s
      LEFT JOIN organizations o ON s."organizationId" = o."id"
      WHERE s."isActive" = true
        AND (${likeClauses.join(' OR ')})
      ORDER BY s."name" ASC
      LIMIT 5
    `;

    const rows = await this.prisma.$queryRawUnsafe<any[]>(sql, ...params);

    return rows.map(r => {
      const dto: SuggestServiceDto = {
        type: 'service',
        id: r.id,
        name: r.name,
      };
      if (r.organizationId) dto.organizationId = r.organizationId;
      if (r.organizationName) dto.organizationName = r.organizationName;
      if (r.organizationCategory)
        dto.organizationCategory = r.organizationCategory;
      if (r.organizationRating != null)
        dto.organizationRating = Number(r.organizationRating);

      const hl = wrapHighlight(r.name ?? '', variants);
      if (hl) dto.highlight = { name: hl };

      return dto;
    });
  }
}

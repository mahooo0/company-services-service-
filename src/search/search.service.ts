import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import {
  SearchQueryDto,
  SearchSortBy,
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

// Naive haversine — km. Sufficient for /suggest distance display (PostGIS not
// required here per Phase 7 plan; main /search endpoint still uses PostGIS).
function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

// Highlight first variant substring in text, wrap with <em>...</em>.
// Returns single-element array (matches content-search highlight shape).
function wrapHighlight(
  text: string,
  variants: string[],
): string[] | undefined {
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
  constructor(private readonly prisma: PrismaService) {}

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

    // Фильтр по рейтингу
    if (query.rating != null) {
      conditions.push(`o."averageRating" >= $${paramIndex}`);
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
      params.push(query.radius);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ') + geoCondition;

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
        COALESCE(o."averageRating", 0) AS "orgRating",
        COALESCE(o."reviewCount", 0) AS "orgReviewCount",
        oa."id" AS "branchId",
        oa."name" AS "branchName",
        oa."address" AS "branchAddress",
        oa."city" AS "branchCity",
        oa."lat" AS "branchLat",
        oa."lon" AS "branchLon",
        oa."workTime" AS "branchWorkTime",
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
        LIMIT 1
      ) oa ON true
      LEFT JOIN service_min_prices sp ON sp."serviceId" = s."id"
      WHERE ${whereClause}
      ORDER BY ${orderBy}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit * 5, 0); // берём с запасом для группировки

    const rows = await this.prisma.$queryRawUnsafe<any[]>(sql, ...params);

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
    // Skipped when:
    //  - no text query (filter-only requests rely on Query A's joins)
    //  - service-bound filters present (priceMin/Max/categoryId/typeId require
    //    a service row to filter on; Query B has none, so skipping preserves
    //    filter semantics — orgs without services SHOULD NOT pass a price filter)
    const skipQueryB =
      !query.q ||
      query.priceMin != null ||
      query.priceMax != null ||
      query.categoryId != null ||
      query.typeId != null;

    if (!skipQueryB && query.q) {
      const variantsB = generateSearchVariants(query.q);
      const conditionsB: string[] = ['o."isActive" = true'];
      const paramsB: any[] = [];
      let pIdxB = 1;

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

      if (query.rating != null) {
        conditionsB.push(`o."averageRating" >= $${pIdxB}`);
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
        paramsB.push(query.radius);
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
          COALESCE(o."averageRating", 0) AS "orgRating",
          COALESCE(o."reviewCount", 0) AS "orgReviewCount",
          oa."id" AS "branchId",
          oa."name" AS "branchName",
          oa."address" AS "branchAddress",
          oa."city" AS "branchCity",
          oa."lat" AS "branchLat",
          oa."lon" AS "branchLon",
          oa."workTime" AS "branchWorkTime",
          ${distanceExprB} AS distance
        FROM organizations o
        LEFT JOIN LATERAL (
          SELECT oa2.*
          FROM organization_addresses oa2
          WHERE oa2."organizationId" = o."id"
          ORDER BY oa2."id"
          LIMIT 1
        ) oa ON true
        WHERE ${whereClauseB}
        ORDER BY ${orderByB}
        LIMIT $${pIdxB} OFFSET 0
      `;
      paramsB.push(limit * 5);

      const rowsB = await this.prisma.$queryRawUnsafe<any[]>(sqlB, ...paramsB);

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
              }
            : null,
          services: [],
        });
      }
    }

    const allGroups = [...groupMap.values()];
    const total = allGroups.length;
    const paginated = allGroups.slice(offset, offset + limit);

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

    const [categories, businesses, services] = await Promise.all([
      this.findCategoriesFromSeed(variants, lang),
      this.findBusinessesPg(variants, query.lat, query.lon),
      this.findServicesPg(variants),
    ]);

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

  // -------- /suggest helpers --------

  private findCategoriesFromSeed(
    variants: string[],
    _lang: 'ru' | 'uk' | 'en',
  ): SuggestCategoryDto[] {
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

  private async findBusinessesPg(
    variants: string[],
    lat?: number,
    lon?: number,
  ): Promise<SuggestBusinessDto[]> {
    if (variants.length === 0) return [];

    const params: any[] = [];
    let pIdx = 1;
    const likeClauses: string[] = [];
    for (const v of variants) {
      params.push(`%${v}%`, v);
      likeClauses.push(
        `(o."name" ILIKE $${pIdx} OR o."name" % $${pIdx + 1} OR o."category" ILIKE $${pIdx} OR o."category" % $${pIdx + 1})`,
      );
      pIdx += 2;
    }

    const sql = `
      SELECT
        o."id",
        o."name",
        o."category",
        COALESCE(o."averageRating", 0) AS rating,
        o."avatar" AS banner,
        oa."lat" AS "addrLat",
        oa."lon" AS "addrLon",
        oa."workTime" AS "workTime"
      FROM organizations o
      LEFT JOIN LATERAL (
        SELECT * FROM organization_addresses
        WHERE "organizationId" = o."id"
        ORDER BY "id"
        LIMIT 1
      ) oa ON true
      WHERE o."isActive" = true
        AND (${likeClauses.join(' OR ')})
      ORDER BY o."averageRating" DESC NULLS LAST, o."name" ASC
      LIMIT 5
    `;

    const rows = await this.prisma.$queryRawUnsafe<any[]>(sql, ...params);

    return rows.map(r => {
      const dto: SuggestBusinessDto = {
        type: 'business',
        id: r.id,
        name: r.name,
      };
      if (r.category) dto.category = r.category;
      if (r.rating != null) dto.rating = Number(r.rating);
      if (r.banner) dto.banner = r.banner;

      if (
        lat != null &&
        lon != null &&
        r.addrLat != null &&
        r.addrLon != null
      ) {
        dto.distanceKm = haversineKm(
          lat,
          lon,
          Number(r.addrLat),
          Number(r.addrLon),
        );
      }

      if (r.workTime) {
        dto.isOpenNow = isOpenNow(r.workTime as WorkTime);
      }

      const hl = wrapHighlight(r.name ?? '', variants);
      if (hl) dto.highlight = { name: hl };

      return dto;
    });
  }

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
        COALESCE(o."averageRating", 0) AS "organizationRating"
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

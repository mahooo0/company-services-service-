import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { SearchQueryDto, SearchSortBy, SuggestQueryDto } from './dto';

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
        likeClauses.push(`(
          s."name" ILIKE $${paramIndex}
          OR o."name" ILIKE $${paramIndex}
          OR sc."name" ILIKE $${paramIndex}
          OR sc."slug" ILIKE $${paramIndex}
          OR st."name" ILIKE $${paramIndex}
          OR st."slug" ILIKE $${paramIndex}
        )`);
        params.push(likeParam);
        paramIndex++;
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

    // Гео-фильтр
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
      LEFT JOIN organization_addresses oa ON oa."id" = ls."locationId"
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

  /**
   * Автокомплит — подсказки при вводе.
   * Ищет по услугам, компаниям, категориям. Мультиязычный.
   */
  async suggest(query: SuggestQueryDto): Promise<any[]> {
    const variants = generateSearchVariants(query.q);
    const suggestLimit = query.limit ?? 5;

    const likeParams = variants.map(v => `%${v}%`);

    // Услуги
    const serviceSql = `
      SELECT DISTINCT ON (s."name") s."id", s."name", 'service' AS type,
        o."name" AS "orgName", o."slug" AS "orgSlug", o."id" AS "orgId"
      FROM services s
      LEFT JOIN organizations o ON s."organizationId" = o."id"
      WHERE s."isActive" = true
        AND (${variants.map((_, i) => `s."name" ILIKE $${i + 1}`).join(' OR ')})
      ORDER BY s."name"
      LIMIT $${variants.length + 1}
    `;

    // Категории
    const categorySql = `
      SELECT sc."id", sc."name", 'category' AS type, sc."slug" AS extra
      FROM service_categories sc
      WHERE ${variants.map((_, i) => `(sc."name" ILIKE $${i + 1} OR sc."slug" ILIKE $${i + 1})`).join(' OR ')}
      LIMIT $${variants.length + 1}
    `;

    // Компании
    const orgSql = `
      SELECT o."id", o."name", o."slug", 'organization' AS type, o."category" AS extra
      FROM organizations o
      WHERE o."isActive" = true
        AND (${variants.map((_, i) => `o."name" ILIKE $${i + 1}`).join(' OR ')})
      LIMIT $${variants.length + 1}
    `;

    const [services, categories, orgs] = await Promise.all([
      this.prisma.$queryRawUnsafe<any[]>(
        serviceSql,
        ...likeParams,
        suggestLimit,
      ),
      this.prisma.$queryRawUnsafe<any[]>(
        categorySql,
        ...likeParams,
        suggestLimit,
      ),
      this.prisma.$queryRawUnsafe<any[]>(orgSql, ...likeParams, suggestLimit),
    ]);

    const results = [
      ...categories.map(c => ({
        type: 'category',
        id: c.id,
        name: c.name,
        extra: c.extra,
      })),
      ...services.map(s => ({
        type: 'service',
        id: s.id,
        name: s.name,
        organization: {
          id: s.orgId,
          name: s.orgName,
          slug: s.orgSlug,
        },
      })),
      ...orgs.map(o => ({
        type: 'organization',
        id: o.id,
        name: o.name,
        slug: o.slug,
        extra: o.extra,
      })),
    ];

    return results.slice(0, suggestLimit);
  }
}

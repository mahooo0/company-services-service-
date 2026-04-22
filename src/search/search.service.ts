import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import {
  SearchQueryDto,
  SearchSortBy,
  SuggestQueryDto,
} from './dto/search-query.dto';
import {
  ServiceSearchResultDto,
  OrganizationSearchResultDto,
  SuggestResultDto,
  PaginatedResultDto,
} from './dto/search-result.dto';

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Поиск услуг по точкам (филиалам).
   * Каждый результат = услуга + конкретная точка где она доступна.
   * JOIN: services → location_services → organization_addresses (точка)
   */
  async searchServices(
    query: SearchQueryDto,
  ): Promise<PaginatedResultDto<ServiceSearchResultDto>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;
    const hasGeo = query.lat != null && query.lon != null;

    const conditions: string[] = ['s."isActive" = true'];
    const params: any[] = [];
    let paramIndex = 1;

    // Text search
    if (query.q) {
      conditions.push(
        `(s."name" ILIKE $${paramIndex} OR o."name" ILIKE $${paramIndex})`,
      );
      params.push(`%${query.q}%`);
      paramIndex++;
    }

    // Rating filter
    if (query.rating != null) {
      conditions.push(`o."averageRating" >= $${paramIndex}`);
      params.push(query.rating);
      paramIndex++;
    }

    // Price filters
    if (query.priceMin != null) {
      conditions.push(`COALESCE(s."price", sv."minPrice") >= $${paramIndex}`);
      params.push(query.priceMin);
      paramIndex++;
    }

    if (query.priceMax != null) {
      conditions.push(`COALESCE(s."price", sv."minPrice") <= $${paramIndex}`);
      params.push(query.priceMax);
      paramIndex++;
    }

    // Category filter
    if (query.categoryId) {
      conditions.push(`st."categoryId" = $${paramIndex}`);
      params.push(query.categoryId);
      paramIndex++;
    }

    // Type filter
    if (query.typeId) {
      conditions.push(`s."typeId" = $${paramIndex}`);
      params.push(query.typeId);
      paramIndex++;
    }

    // Geo distance expression
    let distanceSelect = 'NULL::float AS distance';
    let geoCondition = '';
    if (hasGeo) {
      const distExpr = `(
        6371 * acos(
          LEAST(1.0, cos(radians($${paramIndex})) * cos(radians(oa."lat"))
          * cos(radians(oa."lon") - radians($${paramIndex + 1}))
          + sin(radians($${paramIndex})) * sin(radians(oa."lat")))
        )
      )`;
      distanceSelect = `${distExpr} AS distance`;
      params.push(query.lat, query.lon);
      paramIndex += 2;

      geoCondition = ` AND ${distExpr} <= $${paramIndex}`;
      params.push(query.radius);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ') + geoCondition;

    // Sort
    let orderBy: string;
    switch (query.sort) {
      case SearchSortBy.DISTANCE:
        orderBy = hasGeo ? 'distance ASC NULLS LAST' : 'o."averageRating" DESC';
        break;
      case SearchSortBy.RATING:
        orderBy = 'o."averageRating" DESC';
        break;
      case SearchSortBy.PRICE_ASC:
        orderBy = 'COALESCE(s."price", sv."minPrice") ASC NULLS LAST';
        break;
      case SearchSortBy.PRICE_DESC:
        orderBy = 'COALESCE(s."price", sv."minPrice") DESC NULLS LAST';
        break;
      default:
        if (query.q) {
          orderBy = 'similarity(s."name", $1) DESC, o."averageRating" DESC';
        } else {
          orderBy = 'o."averageRating" DESC';
        }
    }

    const sql = `
      WITH service_prices AS (
        SELECT "serviceId", MIN("price") AS "minPrice"
        FROM service_variations
        WHERE "isActive" = true
        GROUP BY "serviceId"
      )
      SELECT
        s."id",
        s."name",
        s."description",
        s."price"::float,
        s."isActive",
        s."imageId",
        st."name" AS "typeName",
        st."slug" AS "typeSlug",
        sc."name" AS "categoryName",
        sc."slug" AS "categorySlug",
        o."id" AS "organizationId",
        o."name" AS "organizationName",
        o."avatar" AS "organizationAvatar",
        o."averageRating" AS "organizationRating",
        o."reviewCount" AS "organizationReviewCount",
        oa."id" AS "branchId",
        oa."name" AS "branchName",
        oa."address" AS "branchAddress",
        oa."city" AS "branchCity",
        oa."lat" AS "branchLat",
        oa."lon" AS "branchLon",
        oa."workTime" AS "branchWorkTime",
        ${distanceSelect},
        sv."minPrice",
        COUNT(*) OVER() AS "totalCount"
      FROM services s
      JOIN service_types st ON s."typeId" = st."id"
      JOIN service_categories sc ON st."categoryId" = sc."id"
      JOIN organizations o ON s."organizationId" = o."id"
      JOIN location_services ls ON ls."serviceId" = s."id"
      JOIN organization_addresses oa ON oa."id" = ls."locationId"
      LEFT JOIN service_prices sv ON sv."serviceId" = s."id"
      WHERE ${whereClause}
      ORDER BY ${orderBy}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);

    const results = await this.prisma.$queryRawUnsafe<any[]>(sql, ...params);

    const total = results.length > 0 ? Number(results[0].totalCount) : 0;

    const data: ServiceSearchResultDto[] = results.map(r => ({
      id: r.id,
      name: r.name,
      description: r.description,
      price: r.price ?? r.minPrice,
      isActive: r.isActive,
      imageId: r.imageId,
      typeName: r.typeName,
      typeSlug: r.typeSlug,
      categoryName: r.categoryName,
      categorySlug: r.categorySlug,
      organizationId: r.organizationId,
      organizationName: r.organizationName,
      organizationAvatar: r.organizationAvatar,
      organizationRating: r.organizationRating,
      organizationReviewCount: r.organizationReviewCount,
      branchId: r.branchId,
      branchName: r.branchName,
      distance:
        r.distance != null ? Math.round(r.distance * 100) / 100 : undefined,
      branchAddress: r.branchAddress,
      branchCity: r.branchCity,
    }));

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasMore: page * limit < total,
    };
  }

  /**
   * Поиск точек (филиалов) организаций.
   * Каждый результат = точка + данные организации + кол-во услуг в этой точке.
   */
  async searchBranches(
    query: SearchQueryDto,
  ): Promise<PaginatedResultDto<OrganizationSearchResultDto>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;
    const hasGeo = query.lat != null && query.lon != null;

    const conditions: string[] = ['o."isActive" = true'];
    const params: any[] = [];
    let paramIndex = 1;

    if (query.q) {
      conditions.push(
        `(o."name" ILIKE $${paramIndex} OR oa."name" ILIKE $${paramIndex})`,
      );
      params.push(`%${query.q}%`);
      paramIndex++;
    }

    if (query.rating != null) {
      conditions.push(`o."averageRating" >= $${paramIndex}`);
      params.push(query.rating);
      paramIndex++;
    }

    // Category filter
    if (query.categoryId) {
      conditions.push(`EXISTS (
        SELECT 1 FROM location_services ls2
        JOIN services s2 ON s2."id" = ls2."serviceId"
        JOIN service_types st2 ON s2."typeId" = st2."id"
        WHERE ls2."locationId" = oa."id"
        AND st2."categoryId" = $${paramIndex}
        AND s2."isActive" = true
      )`);
      params.push(query.categoryId);
      paramIndex++;
    }

    let distanceSelect = 'NULL::float AS distance';
    let geoCondition = '';
    if (hasGeo) {
      const distExpr = `(
        6371 * acos(
          LEAST(1.0, cos(radians($${paramIndex})) * cos(radians(oa."lat"))
          * cos(radians(oa."lon") - radians($${paramIndex + 1}))
          + sin(radians($${paramIndex})) * sin(radians(oa."lat")))
        )
      )`;
      distanceSelect = `${distExpr} AS distance`;
      params.push(query.lat, query.lon);
      paramIndex += 2;

      geoCondition = ` AND ${distExpr} <= $${paramIndex}`;
      params.push(query.radius);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ') + geoCondition;

    let orderBy: string;
    switch (query.sort) {
      case SearchSortBy.DISTANCE:
        orderBy = hasGeo ? 'distance ASC NULLS LAST' : 'o."averageRating" DESC';
        break;
      case SearchSortBy.RATING:
        orderBy = 'o."averageRating" DESC';
        break;
      default:
        if (query.q) {
          orderBy = 'similarity(o."name", $1) DESC, o."averageRating" DESC';
        } else {
          orderBy = 'o."averageRating" DESC';
        }
    }

    const sql = `
      SELECT
        oa."id" AS "branchId",
        oa."name" AS "branchName",
        oa."address" AS "branchAddress",
        oa."city" AS "branchCity",
        oa."lat" AS "branchLat",
        oa."lon" AS "branchLon",
        oa."workTime" AS "branchWorkTime",
        o."id",
        o."name",
        o."category",
        o."description",
        o."avatar",
        o."averageRating",
        o."reviewCount",
        (
          SELECT COUNT(*)::int FROM location_services ls3
          JOIN services s3 ON s3."id" = ls3."serviceId" AND s3."isActive" = true
          WHERE ls3."locationId" = oa."id"
        ) AS "serviceCount",
        ${distanceSelect},
        COUNT(*) OVER() AS "totalCount"
      FROM organization_addresses oa
      JOIN organizations o ON o."id" = oa."organizationId"
      WHERE ${whereClause}
      ORDER BY ${orderBy}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);

    const results = await this.prisma.$queryRawUnsafe<any[]>(sql, ...params);

    const total = results.length > 0 ? Number(results[0].totalCount) : 0;

    const data: OrganizationSearchResultDto[] = results.map(r => ({
      id: r.id,
      name: r.name,
      category: r.category,
      description: r.description,
      avatar: r.avatar,
      averageRating: r.averageRating,
      reviewCount: r.reviewCount,
      serviceCount: r.serviceCount,
      branchId: r.branchId,
      branchName: r.branchName,
      branchAddress: r.branchAddress,
      branchCity: r.branchCity,
      distance:
        r.distance != null ? Math.round(r.distance * 100) / 100 : undefined,
    }));

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasMore: page * limit < total,
    };
  }

  async suggest(query: SuggestQueryDto): Promise<SuggestResultDto[]> {
    const searchTerm = `%${query.q}%`;
    const suggestLimit = query.limit ?? 5;

    // Services suggest
    const serviceSql = `
      SELECT DISTINCT s."id", s."name", o."name" AS "orgName"
      FROM services s
      JOIN organizations o ON s."organizationId" = o."id"
      WHERE s."isActive" = true
        AND s."name" ILIKE $1
      ORDER BY similarity(s."name", $2) DESC
      LIMIT $3
    `;

    const services = await this.prisma.$queryRawUnsafe<any[]>(
      serviceSql,
      searchTerm,
      query.q,
      suggestLimit,
    );

    // Organizations suggest
    const orgSql = `
      SELECT o."id", o."name", o."category"
      FROM organizations o
      WHERE o."isActive" = true
        AND o."name" ILIKE $1
      ORDER BY similarity(o."name", $2) DESC
      LIMIT $3
    `;

    const orgs = await this.prisma.$queryRawUnsafe<any[]>(
      orgSql,
      searchTerm,
      query.q,
      suggestLimit,
    );

    const results: SuggestResultDto[] = [
      ...services.map(s => ({
        type: 'service' as const,
        id: s.id,
        name: s.name,
        extra: s.orgName,
      })),
      ...orgs.map(o => ({
        type: 'organization' as const,
        id: o.id,
        name: o.name,
        extra: o.category,
      })),
    ];

    return results.slice(0, suggestLimit);
  }
}

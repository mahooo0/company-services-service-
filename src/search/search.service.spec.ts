import { SearchService } from './search.service';
import { SearchQueryDto } from './dto';

describe('SearchService — radius unit conversion (meters → km for Haversine)', () => {
  let service: SearchService;
  let mockPrisma: { $queryRawUnsafe: jest.Mock };

  beforeEach(() => {
    mockPrisma = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([]),
    };
    service = new SearchService(
      mockPrisma as any,
      { getBreedersAvailability: () => Promise.resolve({}) } as any,
      { warn: jest.fn() } as any,
    );
  });

  it.each([
    [500, 0.5],
    [1000, 1],
    [2000, 2],
    [5000, 5],
    [25000, 25],
  ])(
    'search() with radius=%i meters pushes %s km to SQL params',
    async (radiusMeters, expectedKm) => {
      await service.search({
        lat: 50.4501,
        lon: 30.5234,
        radius: radiusMeters,
        page: 1,
        limit: 20,
      } as SearchQueryDto);

      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalled();
      const callArgs = mockPrisma.$queryRawUnsafe.mock.calls[0];
      const params = callArgs.slice(1);
      expect(params).toContain(expectedKm);
    },
  );
});

describe('SearchService — suggest internal radius (L833 fix)', () => {
  let service: SearchService;
  let mockPrisma: { $queryRawUnsafe: jest.Mock };

  beforeEach(() => {
    mockPrisma = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([]),
    };
    service = new SearchService(
      mockPrisma as any,
      { getBreedersAvailability: () => Promise.resolve({}) } as any,
      { warn: jest.fn() } as any,
    );
  });

  it('searchBusinessesViaSearch() passes radius: 25000 (25 km in meters) to search()', async () => {
    const searchSpy = jest.spyOn(service, 'search').mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      limit: 5,
      totalPages: 1,
      hasMore: false,
    });

    await (service as any).searchBusinessesViaSearch('test', 50.4501, 30.5234);

    expect(searchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ radius: 25000 }),
    );
  });
});

// Brief: an organization with reviewCount=0 must be treated as 5★ everywhere
// it's shown. In /search we apply this rule via a CASE WHEN expression both
// in the SELECT (so the response carries 5) and in the WHERE rating filter
// (so unreviewed orgs aren't excluded by rating>=N predicates).
describe('SearchService — default-5 rating for unreviewed orgs (CASE WHEN)', () => {
  let service: SearchService;
  let mockPrisma: { $queryRawUnsafe: jest.Mock };

  // Matches `CASE WHEN o."reviewCount" = 0 THEN 5 ... ELSE o."averageRating" ...`
  // Permissive on whitespace and exact float form (5 or 5.0).
  const CASE_RATING_RE =
    /CASE\s+WHEN\s+o\."reviewCount"\s*=\s*0\s+THEN\s+5(?:\.0)?\s+ELSE\s+o\."averageRating"\s+END/i;

  beforeEach(() => {
    mockPrisma = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([]),
    };
    service = new SearchService(
      mockPrisma as any,
      { getBreedersAvailability: () => Promise.resolve({}) } as any,
      { warn: jest.fn() } as any,
    );
  });

  it('Query A SELECT projects orgRating via CASE WHEN reviewCount = 0 → 5', async () => {
    await service.search({
      lat: 50.4501,
      lon: 30.5234,
      radius: 5000,
      page: 1,
      limit: 20,
    } as SearchQueryDto);

    // calls[0] is the P3 COUNT query (SELECT DISTINCT, no orgRating). calls[1]
    // is the main data query which carries the projection of interest.
    const allSql = mockPrisma.$queryRawUnsafe.mock.calls
      .map(c => c[0] as string)
      .join('\n');
    expect(allSql).toMatch(CASE_RATING_RE);
    // No COALESCE(o."averageRating", 0) — the old default-0 path is gone.
    expect(allSql).not.toMatch(/COALESCE\(o\."averageRating",\s*0\)/);
  });

  it('Query A WHERE rating filter uses CASE expression (so unreviewed orgs pass rating >= N)', async () => {
    await service.search({
      lat: 50.4501,
      lon: 30.5234,
      radius: 5000,
      rating: 4,
      page: 1,
      limit: 20,
    } as SearchQueryDto);

    const allSql = mockPrisma.$queryRawUnsafe.mock.calls
      .map(c => c[0] as string)
      .join('\n');
    // Predicate must compare CASE expression to a parameter placeholder.
    expect(allSql).toMatch(
      /CASE\s+WHEN\s+o\."reviewCount"\s*=\s*0[^]*?END\)?\s*>=\s*\$\d+/i,
    );
    // The raw `o."averageRating" >= $N` form must NOT be used standalone.
    expect(allSql).not.toMatch(/(?<!END\)?\s)o\."averageRating"\s*>=/);
  });

  it('Query B SELECT (groupBy=organization path) also uses CASE WHEN', async () => {
    await service.search({
      lat: 50.4501,
      lon: 30.5234,
      radius: 5000,
      page: 1,
      limit: 20,
      groupBy: 'organization',
    } as SearchQueryDto);

    // Query B is the second SQL invocation.
    const calls = mockPrisma.$queryRawUnsafe.mock.calls;
    // Both Query A (services-rooted) and Query B (org-rooted) fire in groupBy
    // mode; both SQLs must contain the CASE expression.
    const allSql = calls.map(c => c[0] as string).join('\n');
    expect(allSql).toMatch(CASE_RATING_RE);
    expect(allSql).not.toMatch(/COALESCE\(o\."averageRating",\s*0\)/);
  });
});

// Brief P3: `total` in the response must reflect the real number of matches,
// not the (limit * 5)-capped groupMap size. Fix: run a separate COUNT query
// alongside the main data fetch, with the same WHERE but no LIMIT.
describe('SearchService — total reflects real match count (P3 fix)', () => {
  let service: SearchService;
  let mockPrisma: { $queryRawUnsafe: jest.Mock };

  beforeEach(() => {
    mockPrisma = { $queryRawUnsafe: jest.fn() };
    service = new SearchService(
      mockPrisma as any,
      { getBreedersAvailability: () => Promise.resolve({}) } as any,
      { warn: jest.fn() } as any,
    );
  });

  it('runs a separate COUNT query before the main data query', async () => {
    mockPrisma.$queryRawUnsafe
      .mockResolvedValueOnce([{ total: BigInt(633) }]) // count
      .mockResolvedValue([]); // main + optional Query B

    await service.search({
      lat: 50.4501,
      lon: 30.5234,
      radius: 5000,
      page: 1,
      limit: 20,
    } as SearchQueryDto);

    expect(mockPrisma.$queryRawUnsafe.mock.calls.length).toBeGreaterThanOrEqual(
      2,
    );
    const countSql = mockPrisma.$queryRawUnsafe.mock.calls[0][0] as string;
    // COUNT query: counts distinct (org, branch) pairs over the same WHERE,
    // without a LIMIT clause.
    expect(countSql).toMatch(/SELECT\s+COUNT\(\*\)\s+AS\s+"?total"?/i);
    expect(countSql).toMatch(/SELECT\s+DISTINCT\s+s\."organizationId"/i);
    expect(countSql).not.toMatch(/\bLIMIT\b/i);
  });

  it('result.total comes from the COUNT query, not groupMap.size', async () => {
    mockPrisma.$queryRawUnsafe
      .mockResolvedValueOnce([{ total: BigInt(633) }]) // count
      .mockResolvedValue([]); // main + optional Query B

    const res = await service.search({
      lat: 50.4501,
      lon: 30.5234,
      radius: 5000,
      page: 1,
      limit: 20,
    } as SearchQueryDto);

    expect(res.total).toBe(633);
    expect(res.totalPages).toBe(Math.ceil(633 / 20));
  });

  it('total is invariant across different limit values (same COUNT SQL)', async () => {
    const counts: number[] = [];
    for (const limit of [1, 20, 100]) {
      mockPrisma.$queryRawUnsafe.mockReset();
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([{ total: BigInt(633) }])
        .mockResolvedValue([]);

      const res = await service.search({
        lat: 50.4501,
        lon: 30.5234,
        radius: 5000,
        page: 1,
        limit,
      } as SearchQueryDto);
      counts.push(res.total);
    }
    expect(counts).toEqual([633, 633, 633]);
  });

  it('uses COUNT query in groupBy=organization mode too', async () => {
    mockPrisma.$queryRawUnsafe
      .mockResolvedValueOnce([{ total: BigInt(420) }]) // count
      .mockResolvedValue([]); // Query A main + Query B

    const res = await service.search({
      lat: 50.4501,
      lon: 30.5234,
      radius: 5000,
      page: 1,
      limit: 20,
      groupBy: 'organization',
    } as SearchQueryDto);

    expect(res.total).toBe(420);
    const countSql = mockPrisma.$queryRawUnsafe.mock.calls[0][0] as string;
    expect(countSql).toMatch(/SELECT\s+COUNT\(\*\)/i);
    expect(countSql).not.toMatch(/\bLIMIT\b/i);
  });
});

describe('SearchService — Query C (seed / non-partner companies)', () => {
  let service: SearchService;
  let mockPrisma: { $queryRawUnsafe: jest.Mock };

  const seedRow = {
    seedId: '11111111-1111-5111-8111-111111111111',
    seedName: 'Зоомагазин Лапка',
    seedCategory: 'PET_STORES',
    seedAddress: 'вулиця Хрещатик 1',
    seedPlace: 'Київ',
    seedPhone: '(050) 123-4567',
    seedLat: 50.45,
    seedLon: 30.52,
    distance: 1.234,
  };

  // Query A carries a `COUNT(*) OVER()` window, so match the counter by its
  // full projection instead — otherwise the count fixture leaks into Query A.
  const isCountSql = (sql: string) =>
    /SELECT\s+COUNT\(\*\)\s+AS\s+"total"/i.test(sql);
  const isSeedDataSql = (sql: string) =>
    /FROM seed_companies sc/i.test(sql) && !isCountSql(sql);

  /** Routes each SQL statement to its own fixture, whatever the call order. */
  const routeSql = (sql: string) => {
    if (isCountSql(sql)) return [{ total: BigInt(1) }];
    if (isSeedDataSql(sql)) return [seedRow];
    return [];
  };

  const seedQueries = () =>
    mockPrisma.$queryRawUnsafe.mock.calls
      .map(([sql]) => sql as string)
      .filter(isSeedDataSql);

  beforeEach(() => {
    mockPrisma = {
      $queryRawUnsafe: jest.fn((sql: string) => Promise.resolve(routeSql(sql))),
    };
    service = new SearchService(
      mockPrisma as any,
      { getBreedersAvailability: () => Promise.resolve({}) } as any,
      { warn: jest.fn() } as any,
    );
  });

  it('returns seed companies when no service-bound filter is applied', async () => {
    const res = await service.search({ page: 1, limit: 20 } as SearchQueryDto);

    expect(seedQueries()).toHaveLength(1);
    expect(res.data).toHaveLength(1);
    expect(res.data[0].organization.isPartner).toBe(false);
  });

  it('maps a seed row into a map-renderable result', async () => {
    const res = await service.search({
      lat: 50.4501,
      lon: 30.5234,
      page: 1,
      limit: 20,
    } as SearchQueryDto);

    const { organization, branch, services } = res.data[0];
    expect(organization).toMatchObject({
      id: seedRow.seedId,
      name: seedRow.seedName,
      category: 'PET_STORES',
      isPartner: false,
      // A category slug must never leak into organization.slug — the frontend
      // would build a broken /company/{slug} link out of it.
      slug: null,
      // Scraped Google stars are not platform reviews and are not exposed.
      averageRating: 0,
      reviewCount: 0,
    });
    expect(organization.phones).toEqual([seedRow.seedPhone]);
    // The frontend silently drops any result without branch lat/lon — a seed
    // company would vanish from the map without this synthetic branch.
    expect(branch).toMatchObject({
      id: seedRow.seedId,
      address: seedRow.seedAddress,
      city: seedRow.seedPlace,
      lat: seedRow.seedLat,
      lon: seedRow.seedLon,
      distance: 1.23,
    });
    expect(services).toEqual([]);
  });

  it.each([
    ['priceMin', { priceMin: 100 }],
    ['priceMax', { priceMax: 900 }],
    ['categoryId', { categoryId: 'cat-uuid' }],
    ['typeId', { typeId: 'type-uuid' }],
    // A seed row has no platform reviews. Without this gate, Query B's
    // "reviewCount = 0 -> 5 stars" rule would pass every seed company off as
    // a five-star business.
    ['rating', { rating: 4 }],
  ])('excludes seed companies when %s is applied', async (_name, filter) => {
    const res = await service.search({
      page: 1,
      limit: 20,
      ...filter,
    } as SearchQueryDto);

    expect(seedQueries()).toHaveLength(0);
    expect(res.data).toHaveLength(0);
    const countSql = mockPrisma.$queryRawUnsafe.mock.calls[0][0] as string;
    expect(countSql).not.toMatch(/FROM seed_companies/i);
  });

  it('counts seed companies in total, so pagination does not lie', async () => {
    await service.search({ page: 1, limit: 20 } as SearchQueryDto);

    const countSql = mockPrisma.$queryRawUnsafe.mock.calls[0][0] as string;
    expect(countSql).toMatch(/UNION[\s\S]*FROM seed_companies sc/i);
    expect(countSql).not.toMatch(/\bLIMIT\b/i);
  });

  it('filters seed companies by orgCategory using the normalized enum value', async () => {
    await service.search({
      page: 1,
      limit: 20,
      orgCategory: 'VET_CLINICS',
    } as SearchQueryDto);

    const [sql, ...params] = mockPrisma.$queryRawUnsafe.mock.calls.find(
      ([s]: [string]) => isSeedDataSql(s),
    ) as [string, ...unknown[]];

    expect(sql).toMatch(/sc\."category" = \$\d+/);
    expect(params).toContain('VET_CLINICS');
  });
});

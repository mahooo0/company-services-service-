import { SearchService } from './search.service';
import { SearchQueryDto } from './dto';

describe('SearchService — radius unit conversion (meters → km for Haversine)', () => {
  let service: SearchService;
  let mockPrisma: { $queryRawUnsafe: jest.Mock };

  beforeEach(() => {
    mockPrisma = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([]),
    };
    service = new SearchService(mockPrisma as any);
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
    service = new SearchService(mockPrisma as any);
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
    service = new SearchService(mockPrisma as any);
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
    service = new SearchService(mockPrisma as any);
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

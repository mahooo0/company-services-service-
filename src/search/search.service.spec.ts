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

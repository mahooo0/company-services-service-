import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SearchQueryDto } from './search-query.dto';

describe('SearchQueryDto - radius', () => {
  describe('accepts meter range [100, 100000]', () => {
    it.each([[100], [500], [1000], [2000], [5000], [25000], [100000]])(
      'radius=%i passes validation',
      async radius => {
        const dto = plainToInstance(SearchQueryDto, { radius });
        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
        expect(dto.radius).toBe(radius);
      },
    );
  });

  describe('rejects out-of-range values', () => {
    it.each([
      [0],
      [-1],
      [-50],
      // Legacy km values (used by the old frontend contract) — now correctly
      // rejected since the autodetect shim has been removed.
      [0.5],
      [1],
      [2],
      [5],
      [99],
      [100001],
      [200000],
    ])('radius=%s fails validation', async radius => {
      const dto = plainToInstance(SearchQueryDto, { radius });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  it('default value is 25000 (25 km in meters)', () => {
    const dto = plainToInstance(SearchQueryDto, {});
    expect(dto.radius).toBe(25000);
  });
});

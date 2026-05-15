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

  describe('autodetect shim — converts legacy km values (< 100) to meters', () => {
    it.each([
      [0.5, 500],
      [1, 1000],
      [2, 2000],
      [5, 5000],
      [10, 10000],
      [99, 99000],
    ])(
      'radius=%s (legacy km) is transformed to %i meters and passes validation',
      async (input, expected) => {
        const dto = plainToInstance(SearchQueryDto, { radius: input });
        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
        expect(dto.radius).toBe(expected);
      },
    );
  });

  describe('rejects out-of-range values', () => {
    it.each([[0], [-1], [-50], [100001], [200000]])(
      'radius=%i fails validation',
      async radius => {
        const dto = plainToInstance(SearchQueryDto, { radius });
        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
      },
    );
  });

  it('default value is 25000 (25 km in meters)', () => {
    const dto = plainToInstance(SearchQueryDto, {});
    expect(dto.radius).toBe(25000);
  });
});

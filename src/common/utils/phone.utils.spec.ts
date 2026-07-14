import { normalizeUaPhone } from './phone.utils';

describe('normalizeUaPhone', () => {
  it('converts the scraped format to the E.164 form partners are stored in', () => {
    expect(normalizeUaPhone('(097) 374-1467')).toBe('+380973741467');
    expect(normalizeUaPhone('(044) 290-3357')).toBe('+380442903357');
  });

  it('leaves an already-normalized number alone, so the import stays re-runnable', () => {
    expect(normalizeUaPhone('+380973741467')).toBe('+380973741467');
  });

  it('accepts a country code that lost its plus', () => {
    expect(normalizeUaPhone('380973741467')).toBe('+380973741467');
  });

  it('treats absent and placeholder values as no phone', () => {
    expect(normalizeUaPhone(null)).toBeNull();
    expect(normalizeUaPhone(undefined)).toBeNull();
    expect(normalizeUaPhone('')).toBeNull();
    expect(normalizeUaPhone('0')).toBeNull();
  });

  // The five rows in dev that cannot be salvaged. A tel: link built from any of
  // them is guaranteed not to connect, so the UI renders no phone at all rather
  // than a plausible-looking dead one. Their company rows stay on the map.
  it.each([
    ['797-2520'],
    ['(7950) 604-0075'],
    ['(1717) 353-0630'],
    ['(3374) 990-5521'],
    ['(4873) 017-8017'],
  ])('drops %s — it cannot be dialled', phone => {
    expect(normalizeUaPhone(phone)).toBeNull();
  });

  it('never emits a value that breaks the shape the catalog relies on', () => {
    const samples = [
      '(097) 374-1467',
      '+380973741467',
      '380973741467',
      '797-2520',
      '(7950) 604-0075',
      null,
    ];
    for (const sample of samples) {
      const result = normalizeUaPhone(sample);
      if (result !== null) expect(result).toMatch(/^\+380\d{9}$/);
    }
  });
});

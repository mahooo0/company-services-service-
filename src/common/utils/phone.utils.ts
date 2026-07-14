/**
 * Scraped seed-company phones come as "(097) 374-1467", while `organizations`
 * stores E.164 ("+380951211212"). Both end up side by side in one /search
 * result, so seed phones are normalized on import — otherwise the catalog shows
 * two different phone formats in the same list and a `tel:` link built from the
 * scraped form does not dial.
 *
 * Returns null for anything that cannot be made into a Ukrainian number: a
 * 7-digit local number with no area code, or the handful of rows the scraper
 * mangled into something foreign-looking ("(7950) 604-0075"). No phone is better
 * than a tel: link that is guaranteed not to connect.
 *
 * Guarantee: the result is either null or matches /^\+380\d{9}$/.
 */
export function normalizeUaPhone(
  value: string | null | undefined,
): string | null {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === '0') return null;
  if (/^\+380\d{9}$/.test(trimmed)) return trimmed;

  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('0')) {
    return `+380${digits.slice(1)}`;
  }
  if (digits.length === 12 && digits.startsWith('380')) {
    return `+${digits}`;
  }
  return null;
}

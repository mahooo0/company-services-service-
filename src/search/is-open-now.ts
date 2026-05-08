// Pure isOpenNow — workTime + Date → boolean. No DI, no @Injectable.
// Phase 7 port (quick-260508-dlw). Mirrors content-search-service's helper.
//
// Phase 7 MVP: assume Europe/Kyiv (UTC+3). Per-city IANA timezone handling
// is deferred to Phase 9 alongside analytics.

export type WorkTimeSlot = { open: string; close: string };

export type WorkTime = Partial<{
  monday: WorkTimeSlot;
  tuesday: WorkTimeSlot;
  wednesday: WorkTimeSlot;
  thursday: WorkTimeSlot;
  friday: WorkTimeSlot;
  saturday: WorkTimeSlot;
  sunday: WorkTimeSlot;
}>;

// Index aligns with Date.prototype.getUTCDay(): 0 = Sunday … 6 = Saturday.
const DAYS: Array<keyof WorkTime> = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

const KYIV_OFFSET_MS = 3 * 60 * 60 * 1000;

export function isOpenNow(
  workTime: WorkTime | null | undefined,
  nowUtc: Date = new Date(),
): boolean {
  if (!workTime || typeof workTime !== 'object') return false;

  const local = new Date(nowUtc.getTime() + KYIV_OFFSET_MS);
  const dayKey = DAYS[local.getUTCDay()];
  const slot = workTime[dayKey];
  if (!slot || !slot.open || !slot.close) return false;

  const hh = String(local.getUTCHours()).padStart(2, '0');
  const mm = String(local.getUTCMinutes()).padStart(2, '0');
  const hhmm = `${hh}:${mm}`;

  return hhmm >= slot.open && hhmm <= slot.close;
}

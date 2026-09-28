/**
 * The time zone dates are shown in: the person's choice from Profile, else the device's.
 * Set once per workspace load by useWorkspace; formatters read it through `withZone`.
 */
let zone: string | undefined;

export function setDisplayTimeZone(tz: string | null | undefined) {
  zone = tz || undefined;
}

/** Adds the display zone to Intl date options. */
export const withZone = <T extends Intl.DateTimeFormatOptions>(options: T): T =>
  zone ? { ...options, timeZone: zone } : options;

/** Days between two instants' calendar dates in the display zone (0 = same day). */
export function calendarDaysBetween(earlier: Date, later: Date): number {
  const key = (d: Date) =>
    Date.parse(new Intl.DateTimeFormat("en-CA", withZone({ year: "numeric", month: "2-digit", day: "2-digit" })).format(d));
  return Math.round((key(later) - key(earlier)) / 86_400_000);
}

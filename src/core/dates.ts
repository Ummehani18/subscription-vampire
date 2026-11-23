/**
 * Date helpers. Dates are 'YYYY-MM-DD' strings and all arithmetic is UTC, so
 * results never depend on the local timezone.
 */

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MS_PER_DAY = 86_400_000;
const MIN_YEAR = 1;
const MAX_YEAR = 9999;

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}

function isValidYmd(year: number, month: number, day: number): boolean {
  return (
    Number.isInteger(year) &&
    year >= MIN_YEAR &&
    year <= MAX_YEAR &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= daysInMonth(year, month)
  );
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, '0');
}

function toIso(year: number, month: number, day: number): string {
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}

/** Two-digit years: 00-79 are 20xx, 80-99 are 19xx. */
function expandTwoDigitYear(yy: number): number {
  return yy <= 79 ? 2000 + yy : 1900 + yy;
}

function monthFromName(name: string): number | null {
  const index = MONTHS.indexOf(name.toLowerCase());
  return index === -1 ? null : index + 1;
}

// Day and month may be written with one or two digits (5/1/2026 or 05/01/2026).
const DD_MM_YYYY_SLASH = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
const DD_MM_YY_SLASH = /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/;
const DD_MM_YYYY_DASH = /^(\d{1,2})-(\d{1,2})-(\d{4})$/;
const DD_MMM_YYYY_DASH = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/;
const DD_MMM_YYYY_SPACE = /^(\d{1,2}) ([A-Za-z]{3}) (\d{4})$/;
const YYYY_MM_DD = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;

function build(year: number, month: number | null, day: number): string | null {
  if (month === null || !isValidYmd(year, month, day)) return null;
  return toIso(year, month, day);
}

/**
 * Parses a statement date to 'YYYY-MM-DD', or null if it is not one of the
 * supported formats or is not a real calendar date.
 *
 * Supported: DD/MM/YYYY, DD/MM/YY, DD-MM-YYYY, DD-MMM-YYYY, DD MMM YYYY,
 * YYYY-MM-DD. Numeric dates are day-first. Two-digit years 00-79 map to 20xx
 * and 80-99 to 19xx. Month names are three letters, case-insensitive.
 */
export function parseDate(input: string): string | null {
  const s = input.trim();
  let m: RegExpExecArray | null;

  if ((m = DD_MM_YYYY_SLASH.exec(s)) || (m = DD_MM_YYYY_DASH.exec(s))) {
    return build(Number(m[3]), Number(m[2]), Number(m[1]));
  }
  if ((m = DD_MM_YY_SLASH.exec(s))) {
    return build(expandTwoDigitYear(Number(m[3])), Number(m[2]), Number(m[1]));
  }
  if ((m = DD_MMM_YYYY_DASH.exec(s)) || (m = DD_MMM_YYYY_SPACE.exec(s))) {
    return build(Number(m[3]), monthFromName(m[2] ?? ''), Number(m[1]));
  }
  if ((m = YYYY_MM_DD.exec(s))) {
    return build(Number(m[1]), Number(m[2]), Number(m[3]));
  }
  return null;
}

function parseIsoOrThrow(date: string): { year: number; month: number; day: number } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const year = Number(m?.[1]);
  const month = Number(m?.[2]);
  const day = Number(m?.[3]);
  if (!m || !isValidYmd(year, month, day)) {
    throw new RangeError(`Invalid ISO date: ${date}`);
  }
  return { year, month, day };
}

/** Whole days since 1970-01-01 (UTC) for a valid ISO date. */
function toEpochDays({ year, month, day }: { year: number; month: number; day: number }): number {
  const d = new Date(0);
  // setUTCFullYear avoids Date.UTC treating years 0-99 as 19xx.
  d.setUTCFullYear(year, month - 1, day);
  return Math.round(d.getTime() / MS_PER_DAY);
}

function fromEpochDays(days: number): string {
  const d = new Date(days * MS_PER_DAY);
  const year = d.getUTCFullYear();
  if (year < MIN_YEAR || year > MAX_YEAR) {
    throw new RangeError(`Date out of supported range (years ${MIN_YEAR}-${MAX_YEAR})`);
  }
  return toIso(year, d.getUTCMonth() + 1, d.getUTCDate());
}

function assertInteger(n: number, name: string): void {
  if (!Number.isInteger(n)) throw new RangeError(`${name} must be an integer, got ${n}`);
}

/** Adds `n` days (may be negative). Throws RangeError for an invalid date or non-integer `n`. */
export function addDays(date: string, n: number): string {
  assertInteger(n, 'n');
  return fromEpochDays(toEpochDays(parseIsoOrThrow(date)) + n);
}

/**
 * Adds `n` calendar months (may be negative). The day-of-month is kept and
 * clamped to the end of the target month, e.g. 31 Jan + 1 month = 28/29 Feb.
 * Throws RangeError for an invalid date or non-integer `n`.
 */
export function addMonths(date: string, n: number): string {
  assertInteger(n, 'n');
  const { year, month, day } = parseIsoOrThrow(date);
  const total = year * 12 + (month - 1) + n;
  const newYear = Math.floor(total / 12);
  const newMonth = (total - newYear * 12) + 1;
  if (newYear < MIN_YEAR || newYear > MAX_YEAR) {
    throw new RangeError(`Date out of supported range (years ${MIN_YEAR}-${MAX_YEAR})`);
  }
  return toIso(newYear, newMonth, Math.min(day, daysInMonth(newYear, newMonth)));
}

/** Whole days from `a` to `b`: positive when `b` is later. Throws RangeError for an invalid date. */
export function daysBetween(a: string, b: string): number {
  return toEpochDays(parseIsoOrThrow(b)) - toEpochDays(parseIsoOrThrow(a));
}

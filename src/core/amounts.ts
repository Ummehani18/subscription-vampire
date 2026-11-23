import type { Paise } from './types';

interface ParsedAmount {
  negative: boolean;
  paise: Paise;
}

const CURRENCY_PREFIX = /^(?:₹|rs\.?|inr)\s*/i;
const DR_CR_SUFFIX = /\s*(?:dr|cr)\.?$/i;
const NEGATIVE_SIGN = /^[-\u2212]\s*/;
// Digits with optional comma grouping (any grouping style), up to 2 decimals.
const NUMBER_PATTERN = /^(?:(\d+(?:,\d+)*)(?:\.(\d{1,2}))?|\.(\d{1,2}))$/;

/** Shared parser. Works on the string only, so no floating-point is involved. */
function parseCore(input: string): ParsedAmount | null {
  let s = input.trim();
  let negative = false;

  const parenthesised = /^\((.*)\)$/.exec(s);
  if (parenthesised) {
    negative = true;
    s = (parenthesised[1] ?? '').trim();
  }

  s = s.replace(DR_CR_SUFFIX, '');
  s = s.replace(CURRENCY_PREFIX, '');
  if (NEGATIVE_SIGN.test(s)) {
    negative = true;
    s = s.replace(NEGATIVE_SIGN, '');
  }
  s = s.replace(CURRENCY_PREFIX, '');

  const match = NUMBER_PATTERN.exec(s);
  if (!match) return null;

  const integerDigits = (match[1] ?? '').replace(/,/g, '');
  const fractionDigits = (match[2] ?? match[3] ?? '').padEnd(2, '0');

  // Reject values that cannot be held exactly as integer paise.
  if (integerDigits.length > 14) return null;
  const paise = Number(integerDigits || '0') * 100 + Number(fractionDigits);
  if (!Number.isSafeInteger(paise)) return null;

  return { negative, paise };
}

/**
 * Parses an amount string to its absolute value in integer paise.
 * Accepts thousands separators (including Indian grouping), `₹`, `Rs`, `Rs.`,
 * `INR`, surrounding spaces, parentheses, a leading minus and a trailing
 * `Dr`/`Cr`. Direction is decided elsewhere, so the sign is dropped.
 * Returns null for anything else, including more than 2 decimal places.
 */
export function parseAmount(input: string): Paise | null {
  return parseCore(input)?.paise ?? null;
}

/**
 * Like `parseAmount`, but a leading `-` or surrounding parentheses make the
 * result negative. A trailing `Dr`/`Cr` marker is accepted but does not change
 * the sign. Used for the single signed amount column.
 */
export function parseSignedAmount(input: string): number | null {
  const parsed = parseCore(input);
  if (!parsed) return null;
  return parsed.negative && parsed.paise !== 0 ? -parsed.paise : parsed.paise;
}

/**
 * Formats paise as `₹1,23,456.78` using Indian digit grouping and always two
 * decimal places. Negative values render as `-₹1,234.00`.
 * Throws RangeError if the input is not a safe integer (a caller bug).
 */
export function formatINR(p: Paise): string {
  if (!Number.isSafeInteger(p)) {
    throw new RangeError(`formatINR expects integer paise, got ${p}`);
  }
  const abs = Math.abs(p);
  const rupees = String(Math.floor(abs / 100));
  const fraction = String(abs % 100).padStart(2, '0');

  let grouped = rupees;
  if (rupees.length > 3) {
    const head = rupees.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    grouped = `${head},${rupees.slice(-3)}`;
  }
  return `${p < 0 ? '-' : ''}₹${grouped}.${fraction}`;
}

import { MERCHANT_ALIASES } from '../data/merchantAliases';

export interface NormalizedMerchant {
  /** Uppercase canonical string. Same merchant, same key, whatever the reference numbers. */
  key: string;
  /** Canonical name for a known merchant, otherwise the key in title case. */
  display: string;
  /** Alias category, or 'other' for an unknown merchant. */
  category: string;
  /** True when the merchant matched the alias table (tier 1). */
  known: boolean;
}

/** An unknown merchant's key is its first words after cleanup. */
const MAX_KEY_WORDS = 2;

// UPI handles such as `spotify@ybl` or `9876@oksbi`, removed as a whole token.
const UPI_HANDLE = /[A-Z0-9._]*@[A-Z0-9]+(?:\.[A-Z0-9]+)?/g;

const MONTHS = 'JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC';
const DATES = [
  /\b\d{4}-\d{2}-\d{2}\b/g, // 2026-05-05
  /\b\d{1,2}[/.-]\d{1,2}[/.-](?:\d{4}|\d{2})\b/g, // 05/05/26, 05-05-2026
  new RegExp(`\\b\\d{1,2}[ -]?(?:${MONTHS})[A-Z]*[ -]?(?:\\d{4}|\\d{2})\\b`, 'g'), // 05-MAY-2026, 5 MAY 26
];

// IFSC codes (SBIN0000000, ICIC0000001).
const IFSC = /\b[A-Z]{4}0[A-Z0-9]{6}\b/g;

// Reference numbers: digit runs of 6 or more. Shorter tokens (ZEE5, 365, 1MG) stay.
const LONG_DIGITS = /\d{6,}/g;

// Characters that separate parts of a narration.
// Commas and semicolons are not separators: they are trimmed from word ends instead.
const SEGMENT_SEPARATORS = /[/\\|*:()[\]_~#=@-]+/;

// Bank and channel prefixes at the start of a segment, removed repeatedly.
const PREFIX =
  /^(?:(?:TO|BY)\s+TRANSFER|ACH\s*D|UPI|ACH|NACH|ECS|POS|AUTOPAY|IMPS|NEFT|BIL|INFT|DEBIT|CREDIT)(?![A-Z0-9])\s*/;

const LEADING_PUNCTUATION = /^[^A-Z0-9]+/;

function trimPunctuation(word: string): string {
  return word.replace(/^[^A-Z0-9]+|[^A-Z0-9]+$/g, '');
}

function titleCase(key: string): string {
  return key
    .split(' ')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}

/** Cleans a narration into non-empty segments, each a list of words. */
function toSegments(narration: string): string[][] {
  let text = narration.toUpperCase().replace(UPI_HANDLE, ' ');
  for (const date of DATES) text = text.replace(date, ' ');
  text = text.replace(IFSC, ' ').replace(LONG_DIGITS, ' ');

  const segments: string[][] = [];
  for (const part of text.split(SEGMENT_SEPARATORS)) {
    let segment = part.trim().replace(LEADING_PUNCTUATION, '');
    for (let previous = ''; previous !== segment; ) {
      previous = segment;
      segment = segment.replace(PREFIX, '').replace(LEADING_PUNCTUATION, '');
    }
    const words = segment.split(/\s+/).map(trimPunctuation).filter((w) => w !== '');
    // "DR" / "CR" alone are direction markers, not merchants.
    if (words.length === 0 || (words.length === 1 && (words[0] === 'DR' || words[0] === 'CR'))) continue;
    segments.push(words);
  }
  return segments;
}

/**
 * Turns a messy bank narration into a merchant key.
 *
 * Steps: uppercase, remove UPI handles, dates, IFSC codes and digit runs of 6+,
 * split into segments, remove bank prefixes (UPI, ACH D, NACH, ECS, POS,
 * AUTOPAY, IMPS, NEFT, ...), match the alias table (first match wins), else use
 * the first two words of the first meaningful segment. A segment that is only
 * a single letter or only digits is not meaningful. If nothing meaningful is
 * left the key is ''.
 *
 * Idempotent: `normalizeMerchant(result.key).key === result.key`.
 */
export function normalizeMerchant(narration: string): NormalizedMerchant {
  const segments = toSegments(narration);

  const searchText = segments.map((words) => words.join(' ')).join(' ');
  for (const alias of MERCHANT_ALIASES) {
    if (alias.patterns.some((pattern) => pattern.test(searchText))) {
      return {
        key: alias.canonical.toUpperCase(),
        display: alias.canonical,
        category: alias.category,
        known: true,
      };
    }
  }

  // Judge a segment by the words that would become the key, so the key itself
  // is always meaningful (needed for idempotence).
  const meaningful = segments.find((words) => {
    const joined = words.slice(0, MAX_KEY_WORDS).join('');
    return joined.length > 1 && /[A-Z]/.test(joined);
  });
  const key = meaningful ? meaningful.slice(0, MAX_KEY_WORDS).join(' ') : '';
  return { key, display: titleCase(key), category: 'other', known: false };
}

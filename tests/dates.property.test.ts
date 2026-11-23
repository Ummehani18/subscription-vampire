import { describe, it } from 'vitest';
import fc from 'fast-check';
import { parseDate } from '../src/core/dates';

// Calendar logic below is written independently of src/core/dates.ts so the
// properties do not just echo the implementation.
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function isLeap(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function monthLength(year: number, month: number): number {
  return [31, isLeap(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] as number;
}

const pad = (n: number, width: number): string => String(n).padStart(width, '0');

interface Parts {
  year: number;
  month: number;
  day: number;
}

interface Style {
  /** Write day and month without leading zeros where possible (5/1/2026). */
  unpadded: boolean;
  /** 0 = as in MONTH_NAMES, 1 = UPPER, 2 = lower. */
  nameCase: 0 | 1 | 2;
}

const styleArb: fc.Arbitrary<Style> = fc.record({
  unpadded: fc.boolean(),
  nameCase: fc.constantFrom<0 | 1 | 2>(0, 1, 2),
});

const num = (n: number, unpadded: boolean): string => (unpadded ? String(n) : pad(n, 2));

function monthName(month: number, nameCase: 0 | 1 | 2): string {
  const name = MONTH_NAMES[month - 1] as string;
  return nameCase === 1 ? name.toUpperCase() : nameCase === 2 ? name.toLowerCase() : name;
}

interface Format {
  name: string;
  /** Needs a month in 1-12 (month names). */
  needsRealMonth: boolean;
  /** Years the format can represent. */
  years: { min: number; max: number };
  render: (p: Parts, s: Style) => string;
}

const FORMATS: Format[] = [
  {
    name: 'DD/MM/YYYY',
    needsRealMonth: false,
    years: { min: 1, max: 9999 },
    render: (p, s) => `${num(p.day, s.unpadded)}/${num(p.month, s.unpadded)}/${pad(p.year, 4)}`,
  },
  {
    // The spec fixes the two-digit year pivot, so the generator is limited to 1980-2079.
    name: 'DD/MM/YY',
    needsRealMonth: false,
    years: { min: 1980, max: 2079 },
    render: (p, s) => `${num(p.day, s.unpadded)}/${num(p.month, s.unpadded)}/${pad(p.year % 100, 2)}`,
  },
  {
    name: 'DD-MM-YYYY',
    needsRealMonth: false,
    years: { min: 1, max: 9999 },
    render: (p, s) => `${num(p.day, s.unpadded)}-${num(p.month, s.unpadded)}-${pad(p.year, 4)}`,
  },
  {
    name: 'DD-MMM-YYYY',
    needsRealMonth: true,
    years: { min: 1, max: 9999 },
    render: (p, s) => `${num(p.day, s.unpadded)}-${monthName(p.month, s.nameCase)}-${pad(p.year, 4)}`,
  },
  {
    name: 'DD MMM YYYY',
    needsRealMonth: true,
    years: { min: 1, max: 9999 },
    render: (p, s) => `${num(p.day, s.unpadded)} ${monthName(p.month, s.nameCase)} ${pad(p.year, 4)}`,
  },
  {
    name: 'YYYY-MM-DD',
    needsRealMonth: false,
    years: { min: 1, max: 9999 },
    render: (p, s) => `${pad(p.year, 4)}-${num(p.month, s.unpadded)}-${num(p.day, s.unpadded)}`,
  },
];

const toIso = (p: Parts): string => `${pad(p.year, 4)}-${pad(p.month, 2)}-${pad(p.day, 2)}`;

/** Years biased toward the range statements actually use, plus leap-year-heavy ones. */
function yearArb(min: number, max: number): fc.Arbitrary<number> {
  const any = fc.integer({ min, max });
  if (max < 1980 || min > 2079) return any;
  const near = fc.integer({ min: Math.max(min, 1980), max: Math.min(max, 2079) });
  return fc.oneof({ arbitrary: near, weight: 3 }, { arbitrary: any, weight: 2 });
}

/** Any real calendar date within [minYear, maxYear]. */
function validDateArb(minYear: number, maxYear: number): fc.Arbitrary<Parts> {
  return fc
    .tuple(yearArb(minYear, maxYear), fc.integer({ min: 1, max: 12 }), fc.nat())
    .map(([year, month, raw]) => ({ year, month, day: 1 + (raw % monthLength(year, month)) }));
}

/** A day that does not exist in its month (29-31 where the month is shorter). */
function impossibleDayArb(minYear: number, maxYear: number): fc.Arbitrary<Parts> {
  return fc
    .tuple(yearArb(minYear, maxYear), fc.integer({ min: 1, max: 12 }), fc.integer({ min: 29, max: 31 }))
    .filter(([year, month, day]) => day > monthLength(year, month))
    .map(([year, month, day]) => ({ year, month, day }));
}

describe('P2: parseDate round trip', () => {
  for (const format of FORMATS) {
    it(`parseDate(render(d)) == d for any valid calendar date d, in ${format.name} (years ${format.years.min}-${format.years.max})`, () => {
      fc.assert(
        fc.property(validDateArb(format.years.min, format.years.max), styleArb, (date, style) => {
          return parseDate(format.render(date, style)) === toIso(date);
        }),
        { numRuns: 2000 },
      );
    });
  }

  it('parseDate(render(d)) == d with surrounding whitespace, in any supported format', () => {
    const spaces = fc.constantFrom('', ' ', '  ');
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: FORMATS.length - 1 }),
        validDateArb(1980, 2079),
        styleArb,
        spaces,
        spaces,
        (index, date, style, left, right) => {
          const format = FORMATS[index] as Format;
          return parseDate(`${left}${format.render(date, style)}${right}`) === toIso(date);
        },
      ),
      { numRuns: 2000 },
    );
  });

  it('covers every leap day and every month end: parseDate round-trips 29 Feb and last days', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1980, max: 2079 }),
        fc.integer({ min: 1, max: 12 }),
        styleArb,
        (year, month, style) => {
          const last: Parts = { year, month, day: monthLength(year, month) };
          return FORMATS.every((f) => parseDate(f.render(last, style)) === toIso(last));
        },
      ),
      { numRuns: 1000 },
    );
  });
});

describe('P3: parseDate rejects impossible dates', () => {
  for (const format of FORMATS) {
    it(`parseDate returns null when the day does not exist in its month (29-31), in ${format.name}`, () => {
      fc.assert(
        fc.property(impossibleDayArb(format.years.min, format.years.max), styleArb, (date, style) => {
          return parseDate(format.render(date, style)) === null;
        }),
        { numRuns: 2000 },
      );
    });
  }

  it('rejects 30 and 31 in the months that are too short, and 29 Feb outside leap years', () => {
    const shortMonths30 = [2, 4, 6, 9, 11]; // none have 31 days
    fc.assert(
      fc.property(
        fc.integer({ min: 1980, max: 2079 }),
        fc.constantFrom(...shortMonths30),
        styleArb,
        (year, month, style) => {
          const day = monthLength(year, month) + 1; // first day that does not exist
          return FORMATS.every((f) => parseDate(f.render({ year, month, day }, style)) === null);
        },
      ),
      { numRuns: 1000 },
    );
  });

  for (const format of FORMATS.filter((f) => !f.needsRealMonth)) {
    it(`parseDate returns null for day 0 or a day above 31, in ${format.name}`, () => {
      const badDay = fc.oneof(fc.constant(0), fc.integer({ min: 32, max: 99 }));
      fc.assert(
        fc.property(
          fc.integer({ min: format.years.min, max: format.years.max }),
          fc.integer({ min: 1, max: 12 }),
          badDay,
          (year, month, day) => parseDate(format.render({ year, month, day }, { unpadded: false, nameCase: 0 })) === null,
        ),
        { numRuns: 1000 },
      );
    });

    it(`parseDate returns null for month 0 or a month above 12, in ${format.name}`, () => {
      const badMonth = fc.oneof(fc.constant(0), fc.integer({ min: 13, max: 99 }));
      fc.assert(
        fc.property(
          fc.integer({ min: format.years.min, max: format.years.max }),
          badMonth,
          fc.integer({ min: 1, max: 28 }),
          (year, month, day) => parseDate(format.render({ year, month, day }, { unpadded: false, nameCase: 0 })) === null,
        ),
        { numRuns: 1000 },
      );
    });
  }
});

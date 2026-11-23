import { describe, expect, it } from 'vitest';
import { addDays, addMonths, daysBetween, parseDate } from '../src/core/dates';

describe('parseDate: supported formats', () => {
  it.each([
    ['05/05/2026', '2026-05-05'], // DD/MM/YYYY
    ['25/12/2026', '2026-12-25'],
    ['05/05/26', '2026-05-05'], // DD/MM/YY (HDFC style, as in the sample CSV)
    ['01/06/26', '2026-06-01'],
    ['05-05-2026', '2026-05-05'], // DD-MM-YYYY
    ['05-May-2026', '2026-05-05'], // DD-MMM-YYYY
    ['05 May 2026', '2026-05-05'], // DD MMM YYYY
    ['2026-05-05', '2026-05-05'], // YYYY-MM-DD
  ])('parses %j -> %s', (input, expected) => {
    expect(parseDate(input)).toBe(expected);
  });

  it('treats numeric dates as day-first', () => {
    expect(parseDate('01/02/2026')).toBe('2026-02-01');
    expect(parseDate('03-04-2026')).toBe('2026-04-03');
    expect(parseDate('12/11/26')).toBe('2026-11-12');
  });

  it('accepts one-digit day and month', () => {
    expect(parseDate('5/1/2026')).toBe('2026-01-05');
    expect(parseDate('5 Jan 2026')).toBe('2026-01-05');
    expect(parseDate('2026-1-5')).toBe('2026-01-05');
  });

  it('reads month names case-insensitively, for every month', () => {
    const names = ['Jan', 'FEB', 'mar', 'Apr', 'MAY', 'jun', 'Jul', 'AUG', 'sep', 'Oct', 'NOV', 'dec'];
    names.forEach((name, i) => {
      const month = String(i + 1).padStart(2, '0');
      expect(parseDate(`10 ${name} 2026`)).toBe(`2026-${month}-10`);
      expect(parseDate(`10-${name}-2026`)).toBe(`2026-${month}-10`);
    });
  });

  it('trims surrounding whitespace', () => {
    expect(parseDate('  05/05/2026  ')).toBe('2026-05-05');
  });
});

describe('parseDate: two-digit years', () => {
  it.each([
    ['01/01/00', '2000-01-01'],
    ['01/01/26', '2026-01-01'],
    ['01/01/79', '2079-01-01'],
    ['01/01/80', '1980-01-01'],
    ['01/01/99', '1999-01-01'],
  ])('pivot: %j -> %s', (input, expected) => {
    expect(parseDate(input)).toBe(expected);
  });
});

describe('parseDate: calendar validation', () => {
  it.each(['31/02/2026', '30/02/2026', '31/04/2026', '31/06/2026', '31/09/2026', '31/11/2026'])(
    'rejects day past the end of the month: %j',
    (input) => {
      expect(parseDate(input)).toBeNull();
    },
  );

  it('handles leap years', () => {
    expect(parseDate('29/02/2024')).toBe('2024-02-29');
    expect(parseDate('29/02/2026')).toBeNull();
    expect(parseDate('29/02/2100')).toBeNull(); // century, not a leap year
    expect(parseDate('29/02/2000')).toBe('2000-02-29'); // divisible by 400
    expect(parseDate('29/02/24')).toBe('2024-02-29');
    expect(parseDate('29/02/26')).toBeNull();
  });

  it('rejects out-of-range day, month and year', () => {
    expect(parseDate('00/05/2026')).toBeNull();
    expect(parseDate('32/05/2026')).toBeNull();
    expect(parseDate('05/00/2026')).toBeNull();
    expect(parseDate('05/13/2026')).toBeNull();
    expect(parseDate('01/01/0000')).toBeNull();
    expect(parseDate('2026-13-01')).toBeNull();
    expect(parseDate('2026-02-30')).toBeNull();
    expect(parseDate('31 Feb 2026')).toBeNull();
  });

  it('is day-first, so a US-style month-first date is rejected when invalid', () => {
    expect(parseDate('12/25/2026')).toBeNull();
    expect(parseDate('02/13/2026')).toBeNull();
  });
});

describe('parseDate: invalid or unsupported input', () => {
  it.each([
    '',
    '   ',
    'abc',
    '2026',
    '05/05',
    '05/05/202',
    '05/05/20266',
    '05-05-26', // DD-MM-YY is not a supported format
    '05/May/2026', // slash with month name is not supported
    '05-05 2026', // mixed separators
    '5 Sept 2026', // only three-letter month names
    '05 Mayo 2026',
    '05 Foo 2026',
    '2026/05/05', // YYYY/MM/DD is not supported
    '05.05.2026',
    '05/05/2026 10:30', // timestamps are not supported
    '1e3/05/2026',
    '-5/05/2026',
  ])('returns null for %j', (input) => {
    expect(parseDate(input)).toBeNull();
  });
});

describe('addDays', () => {
  it('adds and subtracts days', () => {
    expect(addDays('2026-05-05', 0)).toBe('2026-05-05');
    expect(addDays('2026-05-05', 1)).toBe('2026-05-06');
    expect(addDays('2026-05-05', 28)).toBe('2026-06-02');
    expect(addDays('2026-05-05', -5)).toBe('2026-04-30');
  });

  it('crosses month, year and leap-day boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2024-02-28', 2)).toBe('2024-03-01');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2026-01-01', 365)).toBe('2027-01-01');
    expect(addDays('2024-01-01', 366)).toBe('2025-01-01');
  });

  it('throws RangeError for an invalid date or non-integer n', () => {
    expect(() => addDays('2026-02-30', 1)).toThrow(RangeError);
    expect(() => addDays('05/05/2026', 1)).toThrow(RangeError);
    expect(() => addDays('', 1)).toThrow(RangeError);
    expect(() => addDays('2026-05-05', 1.5)).toThrow(RangeError);
    expect(() => addDays('2026-05-05', Number.NaN)).toThrow(RangeError);
  });

  it('throws RangeError when the result leaves years 1-9999', () => {
    expect(() => addDays('9999-12-31', 1)).toThrow(RangeError);
    expect(() => addDays('0001-01-01', -1)).toThrow(RangeError);
  });
});

describe('addMonths', () => {
  it('adds months keeping the day-of-month', () => {
    expect(addMonths('2026-05-05', 1)).toBe('2026-06-05');
    expect(addMonths('2026-05-05', 3)).toBe('2026-08-05');
    expect(addMonths('2026-05-05', 12)).toBe('2027-05-05');
    expect(addMonths('2026-05-05', 0)).toBe('2026-05-05');
  });

  it('rolls over the year boundary in both directions', () => {
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-15');
    expect(addMonths('2026-01-15', -1)).toBe('2025-12-15');
    expect(addMonths('2026-11-30', 14)).toBe('2028-01-30');
    expect(addMonths('2026-03-10', -15)).toBe('2024-12-10');
  });

  it('clamps the day to the end of the target month', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29');
    expect(addMonths('2026-03-31', 1)).toBe('2026-04-30');
    expect(addMonths('2026-05-31', -1)).toBe('2026-04-30');
    expect(addMonths('2026-08-31', 6)).toBe('2027-02-28');
    expect(addMonths('2024-02-29', 12)).toBe('2025-02-28'); // yearly next date from a leap day
    expect(addMonths('2024-02-29', 48)).toBe('2028-02-29');
  });

  it('computes quarterly next dates', () => {
    expect(addMonths('2026-11-30', 3)).toBe('2027-02-28');
    expect(addMonths('2026-01-15', 3)).toBe('2026-04-15');
  });

  it('throws RangeError for an invalid date or non-integer n', () => {
    expect(() => addMonths('2026-02-30', 1)).toThrow(RangeError);
    expect(() => addMonths('nope', 1)).toThrow(RangeError);
    expect(() => addMonths('2026-05-05', 0.5)).toThrow(RangeError);
  });

  it('throws RangeError when the result leaves years 1-9999', () => {
    expect(() => addMonths('9999-12-01', 1)).toThrow(RangeError);
    expect(() => addMonths('0001-01-01', -1)).toThrow(RangeError);
  });
});

describe('daysBetween', () => {
  it('is positive when the second date is later', () => {
    expect(daysBetween('2026-05-05', '2026-06-05')).toBe(31);
    expect(daysBetween('2026-05-05', '2026-05-06')).toBe(1);
  });

  it('is zero for equal dates and negative when reversed', () => {
    expect(daysBetween('2026-05-05', '2026-05-05')).toBe(0);
    expect(daysBetween('2026-06-05', '2026-05-05')).toBe(-31);
  });

  it('counts leap days and year boundaries', () => {
    expect(daysBetween('2024-02-28', '2024-03-01')).toBe(2);
    expect(daysBetween('2026-02-28', '2026-03-01')).toBe(1);
    expect(daysBetween('2025-12-31', '2026-12-31')).toBe(365);
    expect(daysBetween('2023-12-31', '2024-12-31')).toBe(366);
  });

  it('matches the sample statement cadences', () => {
    // Jio recharge: exactly 28 days apart.
    expect(daysBetween('2026-05-02', '2026-05-30')).toBe(28);
    // Spotify: 12 Aug -> 13 Sep is 32 days.
    expect(daysBetween('2026-08-12', '2026-09-13')).toBe(32);
    // Reference date check used by "possibly cancelled".
    expect(daysBetween('2026-10-05', '2026-10-26')).toBe(21);
  });

  it('does not depend on the local timezone or DST', () => {
    // Across common DST change dates in the northern hemisphere.
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2);
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2);
  });

  it('is consistent with addDays', () => {
    expect(daysBetween('2026-05-05', addDays('2026-05-05', 123))).toBe(123);
    expect(addDays('2026-05-05', daysBetween('2026-05-05', '2027-02-14'))).toBe('2027-02-14');
  });

  it('throws RangeError for an invalid date', () => {
    expect(() => daysBetween('2026-02-30', '2026-03-01')).toThrow(RangeError);
    expect(() => daysBetween('2026-03-01', '01/03/2026')).toThrow(RangeError);
  });
});

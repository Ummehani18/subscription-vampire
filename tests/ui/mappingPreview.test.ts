import { describe, expect, it } from 'vitest';
import { previewRows } from '../../src/ui/mappingPreview';

const HEADERS = ['Posting Date', 'Details', 'Amount'];
const ROWS = [
  ['05/05/2026', 'NETFLIX', '649.00'],
  ['01/05/2026', 'SALARY', '-85,000.00'],
  ['', '', ''],
  ['bad date', 'BROKEN', '10.00'],
  ['06/05/2026', 'SPOTIFY', '119.00'],
  ['07/05/2026', 'ZOMATO', '343.00'],
  ['08/05/2026', 'UBER', '826.00'],
];
const mapping = { date: 0, narration: 1, amount: 2, flipSign: false };

describe('previewRows', () => {
  it('returns null until three different columns are chosen', () => {
    expect(previewRows(ROWS, HEADERS, { ...mapping, date: -1 })).toBeNull();
    expect(previewRows(ROWS, HEADERS, { ...mapping, narration: 0 })).toBeNull();
    expect(previewRows(ROWS, HEADERS, { ...mapping, amount: 3 })).toBeNull();
  });

  it('shows the first 5 non-blank rows as they will be read', () => {
    const preview = previewRows(ROWS, HEADERS, mapping);
    expect(preview).toHaveLength(5);
    expect(preview?.map((p) => p.raw[1])).toEqual(['NETFLIX', 'SALARY', 'BROKEN', 'SPOTIFY', 'ZOMATO']);
    expect(preview?.[0]?.transaction).toEqual({ date: '2026-05-05', narration: 'NETFLIX', amount: 64900, direction: 'credit' });
  });

  it('marks a row that would be skipped', () => {
    expect(previewRows(ROWS, HEADERS, mapping)?.[2]?.transaction).toBeNull();
  });

  it('"Flip sign" changes which rows are debits', () => {
    const directions = (flipSign: boolean) =>
      previewRows(ROWS, HEADERS, { ...mapping, flipSign })?.map((p) => p.transaction?.direction ?? 'skipped');
    expect(directions(false)).toEqual(['credit', 'debit', 'skipped', 'credit', 'credit']);
    expect(directions(true)).toEqual(['debit', 'credit', 'skipped', 'debit', 'debit']);
  });

  it('respects a custom limit and an empty file', () => {
    expect(previewRows(ROWS, HEADERS, mapping, 2)).toHaveLength(2);
    expect(previewRows([], HEADERS, mapping)).toEqual([]);
  });
});

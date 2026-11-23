import { describe, expect, it } from 'vitest';
import { applyMapping, parseStatement, type ColumnMapping } from '../src/core/parseStatement';

const HEADERS = ['Posting Date', 'Details', 'Amount', 'Reference'];
const mapping = (overrides: Partial<ColumnMapping> = {}): ColumnMapping => ({
  date: 0,
  narration: 1,
  amount: 2,
  flipSign: false,
  ...overrides,
});

describe('applyMapping: column mapping', () => {
  it('maps the chosen date, narration and amount columns', () => {
    const rows = [
      ['05/05/2026', 'NETFLIX', '-649.00', 'r1'],
      ['01/05/2026', 'SALARY', '85,000.00', 'r2'],
    ];
    const result = applyMapping(rows, HEADERS, mapping());
    expect(result).toEqual({
      transactions: [
        { date: '2026-05-05', narration: 'NETFLIX', amount: 64900, direction: 'debit' },
        { date: '2026-05-01', narration: 'SALARY', amount: 8500000, direction: 'credit' },
      ],
      skippedRows: 0,
      needsMapping: false,
    });
  });

  it('uses whichever columns are chosen, in any order', () => {
    const rows = [['-649.00', 'NACH-NETFLIX', '2026-05-05', 'x']];
    const result = applyMapping(rows, HEADERS, mapping({ date: 2, narration: 1, amount: 0 }));
    expect(result.transactions).toEqual([
      { date: '2026-05-05', narration: 'NACH-NETFLIX', amount: 64900, direction: 'debit' },
    ]);
  });

  it('ignores columns that were not mapped', () => {
    const rows = [['05/05/2026', 'NETFLIX', '-649.00', '99999999']];
    expect(applyMapping(rows, HEADERS, mapping()).transactions[0]?.amount).toBe(64900);
  });

  it('keeps row order and does not sort', () => {
    const rows = [
      ['09/05/2026', 'B', '-1.00', ''],
      ['01/05/2026', 'A', '-2.00', ''],
    ];
    const dates = applyMapping(rows, HEADERS, mapping()).transactions.map((t) => t.date);
    expect(dates).toEqual(['2026-05-09', '2026-05-01']);
  });

  it('trims cells and parses every supported date format', () => {
    const cases: Array<[string, string]> = [
      [' 05/05/26 ', '2026-05-05'],
      ['05-May-2026', '2026-05-05'],
      ['05 May 2026', '2026-05-05'],
      ['05-05-2026', '2026-05-05'],
      ['2026-05-05', '2026-05-05'],
    ];
    for (const [raw, iso] of cases) {
      const result = applyMapping([[raw, '  X  ', ' -10.00 ', '']], HEADERS, mapping());
      expect(result.transactions).toEqual([{ date: iso, narration: 'X', amount: 1000, direction: 'debit' }]);
    }
  });

  it('parses Indian-grouped amounts, currency symbols and parentheses', () => {
    const rows = [
      ['05/05/2026', 'A', '-1,23,456.78', ''],
      ['05/05/2026', 'B', '(₹ 500)', ''],
      ['05/05/2026', 'C', 'Rs. 1,000', ''],
    ];
    const result = applyMapping(rows, HEADERS, mapping());
    expect(result.transactions.map((t) => [t.amount, t.direction])).toEqual([
      [12345678, 'debit'],
      [50000, 'debit'],
      [100000, 'credit'],
    ]);
  });
});

describe('applyMapping: direction and flipSign', () => {
  const rows = [
    ['05/05/2026', 'DEBIT ROW', '-649.00', ''],
    ['01/05/2026', 'CREDIT ROW', '85000.00', ''],
  ];

  it('without flipSign, negative is a debit and positive is a credit', () => {
    const result = applyMapping(rows, HEADERS, mapping({ flipSign: false }));
    expect(result.transactions.map((t) => t.direction)).toEqual(['debit', 'credit']);
  });

  it('with flipSign, positive is a debit and negative is a credit', () => {
    const result = applyMapping(rows, HEADERS, mapping({ flipSign: true }));
    expect(result.transactions.map((t) => t.direction)).toEqual(['credit', 'debit']);
  });

  it('flipSign never changes the amount, which stays positive', () => {
    const on = applyMapping(rows, HEADERS, mapping({ flipSign: true })).transactions.map((t) => t.amount);
    const off = applyMapping(rows, HEADERS, mapping({ flipSign: false })).transactions.map((t) => t.amount);
    expect(on).toEqual([64900, 8500000]);
    expect(off).toEqual(on);
  });

  it('flipSign makes an all-positive debit column read as debits', () => {
    const debitOnly = [
      ['05/05/2026', 'NETFLIX', '649.00', ''],
      ['05/06/2026', 'NETFLIX', '649.00', ''],
    ];
    expect(applyMapping(debitOnly, HEADERS, mapping({ flipSign: false })).transactions.map((t) => t.direction)).toEqual([
      'credit',
      'credit',
    ]);
    expect(applyMapping(debitOnly, HEADERS, mapping({ flipSign: true })).transactions.map((t) => t.direction)).toEqual([
      'debit',
      'debit',
    ]);
  });

  it('flipping twice gives the original directions', () => {
    const original = applyMapping(rows, HEADERS, mapping({ flipSign: false })).transactions;
    const flipped = applyMapping(rows, HEADERS, mapping({ flipSign: true })).transactions;
    const swapped = flipped.map((t) => ({ ...t, direction: t.direction === 'debit' ? 'credit' : 'debit' }));
    expect(swapped).toEqual(original);
  });

  it('parentheses and a Unicode minus count as negative, and flipSign reverses them', () => {
    const r = [
      ['05/05/2026', 'A', '(100.00)', ''],
      ['05/05/2026', 'B', '\u2212100.00', ''],
    ];
    expect(applyMapping(r, HEADERS, mapping()).transactions.map((t) => t.direction)).toEqual(['debit', 'debit']);
    expect(applyMapping(r, HEADERS, mapping({ flipSign: true })).transactions.map((t) => t.direction)).toEqual([
      'credit',
      'credit',
    ]);
  });

  it('an explicit trailing Dr/Cr marker wins over the sign and is not flipped', () => {
    const r = [
      ['05/05/2026', 'A', '100.00 Dr', ''],
      ['05/05/2026', 'B', '100.00 Cr', ''],
      ['05/05/2026', 'C', '-100.00 Cr', ''],
    ];
    for (const flipSign of [false, true]) {
      const result = applyMapping(r, HEADERS, mapping({ flipSign }));
      expect(result.transactions.map((t) => t.direction)).toEqual(['debit', 'credit', 'credit']);
    }
  });
});

describe('applyMapping: skipped and blank rows', () => {
  it('skips and counts rows with an unparseable date', () => {
    const rows = [
      ['not a date', 'A', '-1.00', ''],
      ['31/02/2026', 'B', '-1.00', ''],
      ['05/05/2026', 'OK', '-1.00', ''],
    ];
    const result = applyMapping(rows, HEADERS, mapping());
    expect(result.transactions).toHaveLength(1);
    expect(result.skippedRows).toBe(2);
  });

  it('skips and counts rows with an unparseable or zero amount', () => {
    const rows = [
      ['05/05/2026', 'A', 'abc', ''],
      ['05/05/2026', 'B', '', ''],
      ['05/05/2026', 'C', '0.00', ''],
      ['05/05/2026', 'D', '1.234', ''],
      ['05/05/2026', 'OK', '-5.00', ''],
    ];
    const result = applyMapping(rows, HEADERS, mapping());
    expect(result.transactions).toHaveLength(1);
    expect(result.skippedRows).toBe(4);
  });

  it('skips rows too short to reach a mapped column', () => {
    const rows = [['05/05/2026'], ['05/05/2026', 'SHORT'], ['05/05/2026', 'OK', '-1.00']];
    const result = applyMapping(rows, HEADERS, mapping());
    expect(result.transactions).toHaveLength(1);
    expect(result.skippedRows).toBe(2);
  });

  it('ignores completely blank rows without counting them', () => {
    const rows = [['', '', '', ''], ['  ', '', ''], [], ['05/05/2026', 'OK', '-1.00', '']];
    const result = applyMapping(rows, HEADERS, mapping());
    expect(result.transactions).toHaveLength(1);
    expect(result.skippedRows).toBe(0);
  });

  it('returns an empty successful result for no rows', () => {
    expect(applyMapping([], HEADERS, mapping())).toEqual({ transactions: [], skippedRows: 0, needsMapping: false });
  });

  it('keeps an empty narration rather than skipping the row', () => {
    const result = applyMapping([['05/05/2026', '', '-1.00', '']], HEADERS, mapping());
    expect(result.transactions).toEqual([{ date: '2026-05-05', narration: '', amount: 100, direction: 'debit' }]);
  });
});

describe('applyMapping: invalid mapping', () => {
  const rows = [['05/05/2026', 'NETFLIX', '-649.00', '']];
  const stillNeedsMapping = (m: ColumnMapping): void => {
    expect(applyMapping(rows, HEADERS, m)).toEqual({
      transactions: [],
      skippedRows: 0,
      needsMapping: true,
      headers: HEADERS,
      rawRows: rows,
    });
  };

  it('rejects an index past the last column', () => {
    stillNeedsMapping(mapping({ amount: 4 }));
  });

  it('rejects a negative index', () => {
    stillNeedsMapping(mapping({ date: -1 }));
  });

  it('rejects a non-integer or NaN index', () => {
    stillNeedsMapping(mapping({ narration: 1.5 }));
    stillNeedsMapping(mapping({ amount: Number.NaN }));
  });

  it('rejects one column used for two roles', () => {
    stillNeedsMapping(mapping({ date: 0, narration: 0 }));
    stillNeedsMapping(mapping({ narration: 2, amount: 2 }));
  });

  it('does not throw for any invalid mapping', () => {
    expect(() => applyMapping(rows, [], mapping())).not.toThrow();
    expect(() => applyMapping(rows, HEADERS, mapping({ date: Number.POSITIVE_INFINITY }))).not.toThrow();
  });
});

describe('applyMapping: manual path after parseStatement', () => {
  it('completes a statement whose date column name was not recognised', () => {
    const csv = [
      'Posting Date,Narration,Debit,Balance',
      '05/05/26,NETFLIX,649.00,1000.00',
      '06/05/26,SPOTIFY,119.00,881.00',
      'bad,ROW,1.00,880.00',
    ].join('\n');
    const first = parseStatement(csv);
    expect(first.needsMapping).toBe(true);
    expect(first.headers).toEqual(['Posting Date', 'Narration', 'Debit', 'Balance']);

    // The user picks Posting Date, Narration and Debit; the Debit column is all positive, so Flip sign is on.
    const result = applyMapping(first.rawRows ?? [], first.headers ?? [], {
      date: 0,
      narration: 1,
      amount: 2,
      flipSign: true,
    });
    expect(result).toEqual({
      transactions: [
        { date: '2026-05-05', narration: 'NETFLIX', amount: 64900, direction: 'debit' },
        { date: '2026-05-06', narration: 'SPOTIFY', amount: 11900, direction: 'debit' },
      ],
      skippedRows: 1,
      needsMapping: false,
    });
  });

  it('completes a headerless file using the generic "Column N" headers', () => {
    const csv = ['05/05/26,NETFLIX,-649.00', '01/05/26,SALARY,85000.00'].join('\n');
    const first = parseStatement(csv);
    expect(first.needsMapping).toBe(true);
    expect(first.headers).toEqual(['Column 1', 'Column 2', 'Column 3']);

    const result = applyMapping(first.rawRows ?? [], first.headers ?? [], {
      date: 0,
      narration: 1,
      amount: 2,
      flipSign: false,
    });
    expect(result.transactions.map((t) => [t.date, t.amount, t.direction])).toEqual([
      ['2026-05-05', 64900, 'debit'],
      ['2026-05-01', 8500000, 'credit'],
    ]);
    expect(result.skippedRows).toBe(0);
  });

  it('gives the same transactions as automatic detection for a signed Amount column', () => {
    const csv = ['Date,Description,Amount', '05/05/2026,NETFLIX,-649.00', '01/05/2026,SALARY,"85,000.00"'].join('\n');
    const auto = parseStatement(csv);
    const manual = applyMapping(
      [
        ['05/05/2026', 'NETFLIX', '-649.00'],
        ['01/05/2026', 'SALARY', '85,000.00'],
      ],
      ['Date', 'Description', 'Amount'],
      { date: 0, narration: 1, amount: 2, flipSign: false },
    );
    expect(manual).toEqual(auto);
  });
});

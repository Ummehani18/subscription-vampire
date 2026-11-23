import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseStatement } from '../src/core/parseStatement';

const HDFC_HEADER =
  'Date,Narration,Chq./Ref.No.,Value Dt,Withdrawal Amt.,Deposit Amt.,Closing Balance';

describe('parseStatement: split withdrawal/deposit columns (HDFC-like)', () => {
  const csv = [
    HDFC_HEADER,
    '02/05/26,"UPI-PHARMEASY-242995371@ybl",297091801534,02/05/26,1276.00,,203724.00',
    '01/05/26,"NEFT CR-ACME TECH PVT LTD-SALARY",624842080417,01/05/26,,85000.00,205000.00',
  ].join('\n');

  it('parses debits and credits with ISO dates and positive paise', () => {
    const result = parseStatement(csv);
    expect(result.needsMapping).toBe(false);
    expect(result.skippedRows).toBe(0);
    expect(result.transactions).toEqual([
      { date: '2026-05-02', narration: 'UPI-PHARMEASY-242995371@ybl', amount: 127600, direction: 'debit' },
      {
        date: '2026-05-01',
        narration: 'NEFT CR-ACME TECH PVT LTD-SALARY',
        amount: 8500000,
        direction: 'credit',
      },
    ]);
  });

  it('keeps file order and does not sort', () => {
    const dates = parseStatement(csv).transactions.map((t) => t.date);
    expect(dates).toEqual(['2026-05-02', '2026-05-01']);
  });

  it('prefers "Date" over "Value Dt" for the transaction date', () => {
    const result = parseStatement(
      [HDFC_HEADER, '02/05/26,"UPI-X-1",1,09/09/26,10.00,,0'].join('\n'),
    );
    expect(result.transactions[0]?.date).toBe('2026-05-02');
  });

  it('prefers "Txn Date" over "Value Date"', () => {
    const result = parseStatement(
      ['Value Date,Txn Date,Description,Debit,Credit', '09/09/2026,02/05/2026,UPI-X,10.00,'].join('\n'),
    );
    expect(result.transactions[0]?.date).toBe('2026-05-02');
  });

  it('reads Indian-grouped amounts and ignores the balance column', () => {
    const result = parseStatement(
      ['Date,Narration,Withdrawal Amt.,Deposit Amt.,Closing Balance', '01/05/26,RENT,"1,23,456.78",,"9,99,999.00"'].join('\n'),
    );
    expect(result.transactions[0]).toMatchObject({ amount: 12345678, direction: 'debit' });
  });

  it('works when only a debit column is present', () => {
    const result = parseStatement(['Date,Narration,Debit', '01/05/26,NETFLIX,649.00', '02/05/26,UNKNOWN,'].join('\n'));
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0]).toMatchObject({ amount: 64900, direction: 'debit' });
    expect(result.skippedRows).toBe(1);
  });

  it('accepts columns in a different order', () => {
    const result = parseStatement(
      ['Deposit,Withdrawal,Particulars,Txn Date', ',649.00,NACH-NETFLIX,05-05-2026'].join('\n'),
    );
    expect(result.transactions).toEqual([
      { date: '2026-05-05', narration: 'NACH-NETFLIX', amount: 64900, direction: 'debit' },
    ]);
  });
});

describe('parseStatement: preamble, blank lines, encoding', () => {
  it('skips a preamble and blank line before the header', () => {
    const csv = [
      'HDFC-STYLE SYNTHETIC STATEMENT',
      'Statement period: 01/05/2026 to 31/10/2026',
      '',
      HDFC_HEADER,
      '05/05/26,"NACH-NETFLIX COM-5942859575",894933675151,05/05/26,649.00,,183628.00',
    ].join('\n');
    const result = parseStatement(csv);
    expect(result.needsMapping).toBe(false);
    expect(result.skippedRows).toBe(0);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0]?.amount).toBe(64900);
  });

  it('does not count blank lines as skipped rows', () => {
    const csv = [HDFC_HEADER, '', '05/05/26,NETFLIX,1,05/05/26,649.00,,0', '', '   ', ',,,,,,'].join('\n');
    const result = parseStatement(csv);
    expect(result.transactions).toHaveLength(1);
    expect(result.skippedRows).toBe(0);
  });

  it('handles CRLF line endings and a UTF-8 BOM', () => {
    const csv = `\uFEFF${HDFC_HEADER}\r\n05/05/26,NETFLIX,1,05/05/26,649.00,,0\r\n`;
    const result = parseStatement(csv);
    expect(result.needsMapping).toBe(false);
    expect(result.transactions).toHaveLength(1);
  });

  it('keeps commas inside quoted narrations', () => {
    const csv = [HDFC_HEADER, '05/05/26,"POS OPENAI, SAN FRANCISCO",1,05/05/26,1950.00,,0'].join('\n');
    expect(parseStatement(csv).transactions[0]?.narration).toBe('POS OPENAI, SAN FRANCISCO');
  });

  it('trims header and cell whitespace', () => {
    const csv = ['  Date , Narration , Withdrawal Amt. ,Deposit Amt.', ' 05/05/26 , NETFLIX , 649.00 ,'].join('\n');
    expect(parseStatement(csv).transactions).toEqual([
      { date: '2026-05-05', narration: 'NETFLIX', amount: 64900, direction: 'debit' },
    ]);
  });

  it('detects the header in any letter case', () => {
    const csv = ['DATE,NARRATION,WITHDRAWAL AMT.,DEPOSIT AMT.', '05/05/26,NETFLIX,649.00,'].join('\n');
    expect(parseStatement(csv).transactions).toHaveLength(1);
  });
});

describe('parseStatement: single amount column', () => {
  it('treats a negative amount as a debit and a positive amount as a credit', () => {
    const csv = ['Date,Description,Amount', '05/05/2026,NETFLIX,-649.00', '01/05/2026,SALARY,"85,000.00"'].join('\n');
    const result = parseStatement(csv);
    expect(result.transactions).toEqual([
      { date: '2026-05-05', narration: 'NETFLIX', amount: 64900, direction: 'debit' },
      { date: '2026-05-01', narration: 'SALARY', amount: 8500000, direction: 'credit' },
    ]);
  });

  it('reads parentheses and a Unicode minus as negative', () => {
    const csv = ['Date,Description,Amount', '05/05/2026,A,(100.00)', '06/05/2026,B,\u2212200.00'].join('\n');
    const result = parseStatement(csv);
    expect(result.transactions.map((t) => t.direction)).toEqual(['debit', 'debit']);
    expect(result.transactions.map((t) => t.amount)).toEqual([10000, 20000]);
  });

  it('uses a trailing Dr/Cr marker in the amount cell', () => {
    const csv = [
      'Txn Date,Description,Amount',
      '05/05/2026,NETFLIX,649.00 Dr',
      '01/05/2026,SALARY,85000.00 Cr',
      '02/05/2026,RENT,"₹ 18,000.00Dr"',
    ].join('\n');
    const result = parseStatement(csv);
    expect(result.transactions.map((t) => [t.amount, t.direction])).toEqual([
      [64900, 'debit'],
      [8500000, 'credit'],
      [1800000, 'debit'],
    ]);
  });

  it('lets a Dr/Cr marker override the sign', () => {
    const csv = ['Date,Description,Amount', '05/05/2026,A,-100.00 Cr'].join('\n');
    expect(parseStatement(csv).transactions[0]).toMatchObject({ amount: 10000, direction: 'credit' });
  });

  it('uses a Dr/Cr indicator column next to the amount', () => {
    const csv = [
      'Date,Narration,Amount,Dr/Cr',
      '05/05/2026,NETFLIX,649.00,DR',
      '01/05/2026,SALARY,85000.00,CR',
      '02/05/2026,ODD,10.00,??',
    ].join('\n');
    const result = parseStatement(csv);
    expect(result.transactions.map((t) => t.direction)).toEqual(['debit', 'credit']);
    expect(result.skippedRows).toBe(1);
  });

  it('accepts Cr/Dr and Debit/Credit indicator headers and short values', () => {
    const csv = ['Date,Narration,Amount,Cr/Dr', '05/05/2026,A,10.00,D', '06/05/2026,B,20.00,C'].join('\n');
    expect(parseStatement(csv).transactions.map((t) => t.direction)).toEqual(['debit', 'credit']);
    const csv2 = ['Date,Narration,Amount,Debit/Credit', '05/05/2026,A,10.00,Debit'].join('\n');
    expect(parseStatement(csv2).transactions[0]?.direction).toBe('debit');
  });

  it('does not take the balance column as the amount', () => {
    const csv = ['Date,Narration,Balance,Amount', '05/05/2026,A,"1,000.00",-50.00'].join('\n');
    expect(parseStatement(csv).transactions[0]).toMatchObject({ amount: 5000, direction: 'debit' });
  });
});

describe('parseStatement: skipped rows', () => {
  const rowsOf = (...lines: string[]) => [HDFC_HEADER, ...lines].join('\n');

  it('skips and counts rows with an unparseable date', () => {
    const result = parseStatement(
      rowsOf('not a date,A,1,x,10.00,,0', '31/02/26,B,1,x,10.00,,0', '05/05/26,OK,1,x,10.00,,0'),
    );
    expect(result.transactions).toHaveLength(1);
    expect(result.skippedRows).toBe(2);
  });

  it('skips and counts rows with an unparseable amount', () => {
    const result = parseStatement(rowsOf('05/05/26,A,1,x,abc,,0', '05/05/26,B,1,x,1.234,,0', '05/05/26,OK,1,x,10.00,,0'));
    expect(result.transactions).toHaveLength(1);
    expect(result.skippedRows).toBe(2);
  });

  it('skips rows with no amount, a zero amount, or both amounts filled', () => {
    const result = parseStatement(
      rowsOf('05/05/26,A,1,x,,,0', '05/05/26,B,1,x,0.00,0.00,0', '05/05/26,C,1,x,10.00,20.00,0'),
    );
    expect(result.transactions).toHaveLength(0);
    expect(result.skippedRows).toBe(3);
  });

  it('uses the non-zero side when the other side is 0.00', () => {
    const result = parseStatement(rowsOf('05/05/26,A,1,x,0.00,500.00,0'));
    expect(result.transactions[0]).toMatchObject({ amount: 50000, direction: 'credit' });
  });

  it('skips rows too short to reach the date or amount cell', () => {
    const result = parseStatement(rowsOf('05/05/26', '05/05/26,SHORT', '05/05/26,OK,1,x,10.00,,0'));
    expect(result.transactions).toHaveLength(1);
    expect(result.skippedRows).toBe(2);
  });

  it('counts footer lines and repeated header rows as skipped', () => {
    const result = parseStatement(
      rowsOf('05/05/26,OK,1,x,10.00,,0', HDFC_HEADER, 'STATEMENT SUMMARY,,,,,,', 'Opening Balance,Debits,Credits,Closing Bal'),
    );
    expect(result.transactions).toHaveLength(1);
    expect(result.skippedRows).toBe(3);
  });

  it('keeps all good rows when many are bad', () => {
    const lines = Array.from({ length: 50 }, (_, i) =>
      i % 2 === 0 ? `05/05/26,GOOD ${i},1,x,10.00,,0` : `bad,BAD ${i},1,x,10.00,,0`,
    );
    const result = parseStatement(rowsOf(...lines));
    expect(result.transactions).toHaveLength(25);
    expect(result.skippedRows).toBe(25);
  });
});

describe('parseStatement: date formats', () => {
  it.each([
    ['05/05/2026', '2026-05-05'],
    ['05/05/26', '2026-05-05'],
    ['05-05-2026', '2026-05-05'],
    ['05-May-2026', '2026-05-05'],
    ['05 May 2026', '2026-05-05'],
    ['2026-05-05', '2026-05-05'],
  ])('reads %j as %s', (raw, iso) => {
    const result = parseStatement(['Date,Narration,Debit', `${raw},X,10.00`].join('\n'));
    expect(result.transactions[0]?.date).toBe(iso);
  });
});

describe('parseStatement: needs mapping', () => {
  it('returns headers and raw rows when no amount column can be identified', () => {
    const csv = ['Date,Narration,Reference', '05/05/26,NETFLIX,123', '06/05/26,SPOTIFY,456'].join('\n');
    const result = parseStatement(csv);
    expect(result.needsMapping).toBe(true);
    expect(result.transactions).toEqual([]);
    expect(result.headers).toEqual(['Date', 'Narration', 'Reference']);
    expect(result.rawRows).toEqual([
      ['05/05/26', 'NETFLIX', '123'],
      ['06/05/26', 'SPOTIFY', '456'],
    ]);
  });

  it('excludes the preamble and header from rawRows', () => {
    const csv = ['Some bank', '', 'Date,Narration,Reference', '05/05/26,NETFLIX,123'].join('\n');
    const result = parseStatement(csv);
    expect(result.needsMapping).toBe(true);
    expect(result.rawRows).toEqual([['05/05/26', 'NETFLIX', '123']]);
  });

  it('needs mapping when the date column name is not recognised', () => {
    const csv = ['Posting Date,Narration,Debit', '05/05/26,NETFLIX,10.00'].join('\n');
    // "Posting Date" has a date-like header but is not a recognised date column.
    expect(parseStatement(csv).needsMapping).toBe(true);
  });

  it('needs mapping when there is no header row, with generic column names', () => {
    const csv = ['05/05/26,NETFLIX,649.00', '06/05/26,SPOTIFY,119.00,extra'].join('\n');
    const result = parseStatement(csv);
    expect(result.needsMapping).toBe(true);
    expect(result.headers).toEqual(['Column 1', 'Column 2', 'Column 3', 'Column 4']);
    expect(result.rawRows).toHaveLength(2);
  });

  it('needs mapping when the narration column is missing', () => {
    const csv = ['Date,Memo,Debit', '05/05/26,NETFLIX,10.00'].join('\n');
    // No narration-like header, so no header row is found.
    expect(parseStatement(csv).needsMapping).toBe(true);
  });
});

describe('parseStatement: empty and degenerate input', () => {
  it('returns an empty result for empty or whitespace-only text', () => {
    for (const text of ['', '   ', '\n\n', ',,,\n,,']) {
      expect(parseStatement(text)).toEqual({ transactions: [], skippedRows: 0, needsMapping: false });
    }
  });

  it('returns no transactions for a header-only file', () => {
    expect(parseStatement(HDFC_HEADER)).toEqual({ transactions: [], skippedRows: 0, needsMapping: false });
  });

  it('never throws on arbitrary text', () => {
    expect(() => parseStatement('\u0000\u0001"unterminated, quote\n"')).not.toThrow();
    expect(() => parseStatement('{"json": true}')).not.toThrow();
  });
});

describe('parseStatement: bundled sample statement', () => {
  const text = readFileSync(new URL('../data/sample-statement.csv', import.meta.url), 'utf8');
  const result = parseStatement(text);
  const dataLines = text.split(/\r?\n/).filter((line) => /^\d{2}\/\d{2}\/\d{2},/.test(line));

  it('finds the header after the preamble and needs no mapping', () => {
    expect(result.needsMapping).toBe(false);
    expect(result.skippedRows).toBe(0);
  });

  it('parses every data row', () => {
    expect(result.transactions).toHaveLength(dataLines.length);
    expect(dataLines.length).toBeGreaterThan(100);
  });

  it('reads the first rows correctly', () => {
    expect(result.transactions[0]).toEqual({
      date: '2026-05-01',
      narration: 'NEFT CR-ACME TECH PVT LTD-SALARY',
      amount: 8500000,
      direction: 'credit',
    });
    expect(result.transactions[1]).toEqual({
      date: '2026-05-02',
      narration: 'UPI-PHARMEASY-242995371@ybl',
      amount: 127600,
      direction: 'debit',
    });
  });

  it('classifies salary rows as credits and the rest as debits', () => {
    const credits = result.transactions.filter((t) => t.direction === 'credit');
    expect(credits).toHaveLength(6);
    expect(credits.every((t) => t.narration.includes('SALARY'))).toBe(true);
  });
});

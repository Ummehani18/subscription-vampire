import { readFileSync } from 'node:fs';
import Papa from 'papaparse';
import { describe, expect, it } from 'vitest';
import { parseAmount } from '../src/core/amounts';
import { parseDate } from '../src/core/dates';
import { parseStatement } from '../src/core/parseStatement';
import type { Transaction } from '../src/core/types';

const read = (relative: string): string =>
  readFileSync(new URL(relative, import.meta.url), 'utf8');

const SAMPLE = read('../data/sample-statement.csv'); // HDFC-style
const SBI = read('./fixtures/sbi-style.csv');
const ICICI = read('./fixtures/icici-style.csv');

/**
 * Independent cross-check that does not use parseStatement: read the balance
 * column straight from the CSV and return how much it moved on each row, with
 * the row's date. For every row after the first, the movement must equal the
 * parsed transaction (+ for credit, - for debit).
 */
function balanceMovements(
  text: string,
  dateHeader: RegExp,
  balanceHeader: RegExp,
): Array<{ date: string; delta: number }> {
  const rows = Papa.parse<string[]>(text, { header: false, skipEmptyLines: 'greedy' }).data;
  const headerIndex = rows.findIndex((r) => r.some((c) => dateHeader.test(c.trim())) && r.some((c) => balanceHeader.test(c.trim())));
  const header = (rows[headerIndex] ?? []).map((c) => c.trim());
  const dateCol = header.findIndex((c) => dateHeader.test(c));
  const balanceCol = header.findIndex((c) => balanceHeader.test(c));
  const out: Array<{ date: string; delta: number }> = [];
  let previous: number | null = null;
  for (const row of rows.slice(headerIndex + 1)) {
    const date = parseDate(row[dateCol] ?? '');
    const balance = parseAmount(row[balanceCol] ?? '');
    if (date === null || balance === null) continue;
    if (previous !== null) out.push({ date, delta: balance - previous });
    previous = balance;
  }
  return out;
}

const signed = (t: Transaction): number => (t.direction === 'credit' ? t.amount : -t.amount);

function expectStructurallyValid(transactions: Transaction[]): void {
  for (const t of transactions) {
    expect(t.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Number.isSafeInteger(t.amount)).toBe(true);
    expect(t.amount).toBeGreaterThan(0);
    expect(['debit', 'credit']).toContain(t.direction);
    expect(t.narration.length).toBeGreaterThan(0);
    expect(t.narration).toBe(t.narration.trim());
  }
}

const dates = (ts: Transaction[]): string[] => ts.map((t) => t.date);
const amounts = (ts: Transaction[]): number[] => ts.map((t) => t.amount);
const matching = (ts: Transaction[], pattern: RegExp): Transaction[] =>
  ts.filter((t) => pattern.test(t.narration));

describe('layout 1: HDFC-style (data/sample-statement.csv)', () => {
  const result = parseStatement(SAMPLE);
  const tx = result.transactions;

  it('finds the header after the 3-line preamble without asking for mapping', () => {
    expect(result.needsMapping).toBe(false);
    expect(result.headers).toBeUndefined();
    expect(result.rawRows).toBeUndefined();
  });

  it('parses all 119 data rows and skips none', () => {
    expect(tx).toHaveLength(119);
    expect(result.skippedRows).toBe(0);
  });

  it('returns structurally valid transactions in file order', () => {
    expectStructurallyValid(tx);
    expect(dates(tx)).toEqual([...dates(tx)].sort());
    expect(tx[0]?.date).toBe('2026-05-01');
    expect(tx.at(-1)?.date).toBe('2026-10-26');
  });

  it('classifies 6 salary rows as credits and every other row as a debit', () => {
    const credits = tx.filter((t) => t.direction === 'credit');
    expect(credits).toHaveLength(6);
    expect(credits.every((t) => /NEFT CR.*SALARY/.test(t.narration))).toBe(true);
    expect(credits.every((t) => t.amount === 8500000)).toBe(true);
    expect(tx.filter((t) => t.direction === 'debit')).toHaveLength(113);
  });

  it('reads the expected recurring rows from the data/README.md table', () => {
    const netflix = matching(tx, /NETFLIX/);
    expect(netflix).toHaveLength(6);
    expect(amounts(netflix)).toEqual(Array(6).fill(64900));
    expect(dates(netflix)).toEqual([
      '2026-05-05', '2026-06-05', '2026-07-05', '2026-08-05', '2026-09-05', '2026-10-05',
    ]);

    const spotify = matching(tx, /SPOTIFY/);
    expect(amounts(spotify)).toEqual([11900, 11900, 11900, 11900, 13900, 13900]);

    const jio = matching(tx, /JIO PREPAID/);
    expect(jio).toHaveLength(7);
    expect(dates(jio)).toEqual([
      '2026-05-02', '2026-05-30', '2026-06-27', '2026-07-25', '2026-08-22', '2026-09-19', '2026-10-17',
    ]);

    expect(matching(tx, /GOOGLE ONE/)).toHaveLength(6);
    expect(matching(tx, /CULT FIT/)).toHaveLength(6);
    expect(amounts(matching(tx, /CHATGPT/))).toEqual(Array(6).fill(195000));
    expect(matching(tx, /YOUTUBE PREMIUM/)).toHaveLength(6);
    expect(amounts(matching(tx, /LANDLORD/))).toEqual(Array(6).fill(1800000));
  });

  it('reads DD/MM/YY dates with the 20xx pivot and uses "Date", not "Value Dt"', () => {
    expect(tx.every((t) => t.date.startsWith('2026-'))).toBe(true);
  });

  it('matches the running balance column row by row (independent check)', () => {
    const movements = balanceMovements(SAMPLE, /^Date$/, /^Closing Balance$/);
    expect(movements).toHaveLength(tx.length - 1);
    movements.forEach((m, i) => {
      const t = tx[i + 1] as Transaction;
      expect({ date: m.date, delta: m.delta }).toEqual({ date: t.date, delta: signed(t) });
    });
  });
});

describe('layout 2: SBI-style (tests/fixtures/sbi-style.csv)', () => {
  const result = parseStatement(SBI);
  const tx = result.transactions;

  it('finds the header after the 6-line preamble without asking for mapping', () => {
    expect(result.needsMapping).toBe(false);
    expect(result.headers).toBeUndefined();
    expect(result.rawRows).toBeUndefined();
  });

  it('parses 56 transactions and skips only the END OF STATEMENT footer', () => {
    expect(tx).toHaveLength(56);
    expect(result.skippedRows).toBe(1);
    expect(tx.some((t) => /END OF STATEMENT/i.test(t.narration))).toBe(false);
  });

  it('returns structurally valid transactions in file order', () => {
    expectStructurallyValid(tx);
    expect(dates(tx)).toEqual([...dates(tx)].sort());
    expect(tx[0]).toMatchObject({ date: '2026-05-01', amount: 7250000, direction: 'credit' });
    expect(tx[0]?.narration).toContain('ACME TECH PVT LTD SALARY');
    expect(tx.at(-1)).toMatchObject({ date: '2026-10-25', amount: 127500, direction: 'debit' });
    expect(tx.at(-1)?.narration).toContain('BESCOM ELECTRICITY');
  });

  it('reads separate Debit and Credit columns: 8 credits, 48 debits', () => {
    const credits = tx.filter((t) => t.direction === 'credit');
    expect(credits).toHaveLength(8);
    expect(credits.map((t) => t.amount).sort((a, b) => a - b)).toEqual([
      31200, // interest
      ...Array(6).fill(7250000), // salary
      12500000, // bonus
    ]);
    expect(tx.filter((t) => t.direction === 'debit')).toHaveLength(48);
  });

  it('reads quoted Indian-grouped amounts such as "1,25,000.00" and "15,000.00"', () => {
    expect(tx.find((t) => /BONUS/.test(t.narration))).toMatchObject({
      date: '2026-08-15',
      amount: 12500000,
      direction: 'credit',
    });
    expect(amounts(matching(tx, /LANDLORD SURESH/))).toEqual(Array(6).fill(1500000));
    expect(tx.find((t) => /ATM WDL/.test(t.narration))?.amount).toBe(500000);
  });

  it('reads DD MMM YYYY dates from "Txn Date"', () => {
    const netflix = matching(tx, /NETFLIX/);
    expect(dates(netflix)).toEqual([
      '2026-05-05', '2026-06-05', '2026-07-05', '2026-08-05', '2026-09-05', '2026-10-05',
    ]);
    expect(amounts(netflix)).toEqual(Array(6).fill(64900));
  });

  it('reads the recurring and price-drop patterns', () => {
    expect(amounts(matching(tx, /JIOHOTSTAR/))).toEqual([29900, 29900, 29900, 29900, 14900, 14900]);
    expect(amounts(matching(tx, /BHARTI AIRTEL/))).toEqual(Array(6).fill(59900));
    expect(amounts(matching(tx, /GOOGLE ONE/))).toEqual(Array(6).fill(13000));
    expect(amounts(matching(tx, /BESCOM/))).toEqual([132000, 88000, 110500, 149000, 96000, 127500]);
  });

  it('keeps both same-day Swiggy charges as separate transactions', () => {
    const sameDay = tx.filter((t) => t.date === '2026-05-09');
    expect(sameDay.map((t) => t.amount)).toEqual([41200, 38900]);
  });

  it('matches the running balance column row by row (independent check)', () => {
    const movements = balanceMovements(SBI, /^Txn Date$/, /^Balance$/);
    expect(movements).toHaveLength(tx.length - 1);
    movements.forEach((m, i) => {
      const t = tx[i + 1] as Transaction;
      expect({ date: m.date, delta: m.delta }).toEqual({ date: t.date, delta: signed(t) });
    });
  });
});

describe('layout 3: ICICI-style (tests/fixtures/icici-style.csv)', () => {
  const result = parseStatement(ICICI);
  const tx = result.transactions;

  it('finds the header after the preamble without asking for mapping', () => {
    expect(result.needsMapping).toBe(false);
    expect(result.headers).toBeUndefined();
    expect(result.rawRows).toBeUndefined();
  });

  it('parses 57 transactions and skips only the 2 "Legends" footer lines', () => {
    expect(tx).toHaveLength(57);
    expect(result.skippedRows).toBe(2);
    expect(tx.some((t) => /Legends|Unified Payments/i.test(t.narration))).toBe(false);
  });

  it('returns structurally valid transactions in file order', () => {
    expectStructurallyValid(tx);
    expect(dates(tx)).toEqual([...dates(tx)].sort());
    expect(tx[0]).toMatchObject({ date: '2026-05-01', amount: 6800000, direction: 'credit' });
    expect(tx.at(-1)).toMatchObject({ date: '2026-10-29', amount: 34000, direction: 'debit' });
    expect(tx.at(-1)?.narration).toContain('UBER INDIA');
  });

  it('reads "Withdrawal Amount (INR )" and "Deposit Amount (INR )": 7 credits, 50 debits', () => {
    const credits = tx.filter((t) => t.direction === 'credit');
    expect(credits).toHaveLength(7);
    expect(credits.map((t) => t.amount).sort((a, b) => a - b)).toEqual([
      41100, // interest
      ...Array(6).fill(6800000), // salary
    ]);
    expect(tx.filter((t) => t.direction === 'debit')).toHaveLength(50);
  });

  it('reads DD-MM-YYYY dates and uses "Transaction Date" (not S No. or Balance)', () => {
    expect(tx[1]).toMatchObject({ date: '2026-05-02', amount: 29900, direction: 'debit' });
    expect(tx[1]?.narration).toContain('JIO PREPAID RECHARGE');
  });

  it('reads the every-28-days Jio recharge dates', () => {
    const jio = matching(tx, /JIO PREPAID/);
    expect(dates(jio)).toEqual([
      '2026-05-02', '2026-05-30', '2026-06-27', '2026-07-25', '2026-08-22', '2026-09-19', '2026-10-17',
    ]);
    expect(amounts(jio)).toEqual(Array(7).fill(29900));
  });

  it('reads the price-hike and amount-variance patterns', () => {
    expect(amounts(matching(tx, /Spotify India/))).toEqual([11900, 11900, 11900, 11900, 13900, 13900]);
    expect(amounts(matching(tx, /CHATGPT/))).toEqual([195000, 196200, 193800, 195000, 197100, 194400]);
    expect(amounts(matching(tx, /YouTube Premium/))).toEqual(Array(6).fill(12900));
    expect(amounts(matching(tx, /HOUSE RENT/))).toEqual(Array(6).fill(2000000));
  });

  it('reads the lapsed patterns (Sony LIV x3, weekly milk x5)', () => {
    const sony = matching(tx, /SONYLIV/);
    expect(dates(sony)).toEqual(['2026-05-15', '2026-06-15', '2026-07-15']);
    const milk = matching(tx, /FRESH MILK/);
    expect(dates(milk)).toEqual(['2026-05-05', '2026-05-12', '2026-05-19', '2026-05-26', '2026-06-02']);
    expect(amounts(milk)).toEqual(Array(5).fill(21000));
  });

  it('keeps both same-day, same-amount Zomato charges as separate transactions', () => {
    const sameDay = tx.filter((t) => t.date === '2026-05-18');
    expect(sameDay).toHaveLength(2);
    expect(amounts(sameDay)).toEqual([64000, 64000]);
  });

  it('matches the running balance column row by row (independent check)', () => {
    const movements = balanceMovements(ICICI, /^Transaction Date$/, /^Balance \(INR \)$/);
    expect(movements).toHaveLength(tx.length - 1);
    movements.forEach((m, i) => {
      const t = tx[i + 1] as Transaction;
      expect({ date: m.date, delta: m.delta }).toEqual({ date: t.date, delta: signed(t) });
    });
  });
});

describe('all three layouts', () => {
  const layouts = [
    ['HDFC-style', SAMPLE],
    ['SBI-style', SBI],
    ['ICICI-style', ICICI],
  ] as const;

  it.each(layouts)('%s is parsed without mapping and never throws', (_name, text) => {
    const result = parseStatement(text);
    expect(result.needsMapping).toBe(false);
    expect(result.transactions.length).toBeGreaterThan(50);
  });

  it.each(layouts)('%s parses identically with CRLF line endings and a BOM', (_name, text) => {
    const original = parseStatement(text);
    const variant = parseStatement(`\uFEFF${text.replace(/\r?\n/g, '\r\n')}`);
    expect(variant).toEqual(original);
  });

  it.each(layouts)('%s: every transaction and skipped row accounts for every non-blank data row', (_name, text) => {
    const result = parseStatement(text);
    const rows = Papa.parse<string[]>(text, { header: false, skipEmptyLines: 'greedy' }).data;
    const headerIndex = rows.findIndex((r) => r.some((c) => /date/i.test(c)) && r.some((c) => /narration|description|remarks/i.test(c)));
    expect(result.transactions.length + result.skippedRows).toBe(rows.length - headerIndex - 1);
  });
});

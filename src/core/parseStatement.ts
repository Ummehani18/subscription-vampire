import Papa from 'papaparse';
import { parseAmount, parseSignedAmount } from './amounts';
import { parseDate } from './dates';
import type { ParseResult, Transaction } from './types';

// Header detection: a row with a date-like AND a narration-like cell.
const DATE_LIKE = /date/i;
const NARRATION = /narration|description|particulars|details|remarks/i;

// Column detection.
const DATE_COLUMN = /^(txn|transaction|value)?\s*date/i;
const VALUE_DATE = /^value/i;
const DEBIT_COLUMN = /withdrawal|debit|dr\b/i;
const CREDIT_COLUMN = /deposit|credit|cr\b/i;
const INDICATOR_COLUMN = /^(dr\s*[/\\]\s*cr|cr\s*[/\\]\s*dr|debit\s*[/\\]\s*credit|credit\s*[/\\]\s*debit|dr\s+or\s+cr)$/i;
const AMOUNT_COLUMN = /amount|amt/i;
const BALANCE_COLUMN = /balance/i;

// Cell values.
const DR_MARKER = /^(?:dr|debit|d)\.?$/i;
const CR_MARKER = /^(?:cr|credit|c)\.?$/i;
const TRAILING_MARKER = /(dr|cr)\.?\s*$/i;

type AmountSource =
  | { kind: 'split'; debit: number; credit: number } // -1 when that column is absent
  | { kind: 'single'; amount: number; indicator: number; flip?: boolean };

interface Columns {
  date: number;
  narration: number;
  amount: AmountSource;
}

function cell(row: string[], index: number): string {
  return index < 0 ? '' : (row[index] ?? '').trim();
}

function isHeaderRow(row: string[]): boolean {
  const cells = row.map((c) => c.trim());
  return cells.some((c) => DATE_LIKE.test(c)) && cells.some((c) => NARRATION.test(c));
}

function findDateColumn(headers: string[]): number {
  const matches = headers
    .map((header, index) => ({ header, index }))
    .filter(({ header }) => DATE_COLUMN.test(header));
  // Prefer "Date" / "Txn Date" over "Value Date".
  const preferred = matches.find(({ header }) => !VALUE_DATE.test(header)) ?? matches[0];
  return preferred ? preferred.index : -1;
}

function detectColumns(headers: string[]): Columns | null {
  const date = findDateColumn(headers);
  const narration = headers.findIndex((h) => NARRATION.test(h));
  if (date < 0 || narration < 0) return null;

  const isIndicator = (h: string): boolean => INDICATOR_COLUMN.test(h);
  const debit = headers.findIndex((h) => !isIndicator(h) && !BALANCE_COLUMN.test(h) && DEBIT_COLUMN.test(h));
  const credit = headers.findIndex((h) => !isIndicator(h) && !BALANCE_COLUMN.test(h) && CREDIT_COLUMN.test(h));

  if (debit >= 0 || credit >= 0) {
    return { date, narration, amount: { kind: 'split', debit, credit } };
  }

  const amount = headers.findIndex((h) => AMOUNT_COLUMN.test(h) && !BALANCE_COLUMN.test(h));
  if (amount < 0) return null;
  const indicator = headers.findIndex((h) => isIndicator(h.trim()));
  return { date, narration, amount: { kind: 'single', amount, indicator } };
}

function readAmount(
  row: string[],
  source: AmountSource,
): { amount: number; direction: 'debit' | 'credit' } | null {
  if (source.kind === 'split') {
    const debit = source.debit >= 0 ? parseAmount(cell(row, source.debit)) : null;
    const credit = source.credit >= 0 ? parseAmount(cell(row, source.credit)) : null;
    const hasDebit = debit !== null && debit > 0;
    const hasCredit = credit !== null && credit > 0;
    if (hasDebit && !hasCredit) return { amount: debit, direction: 'debit' };
    if (hasCredit && !hasDebit) return { amount: credit, direction: 'credit' };
    return null; // both empty/zero, both filled, or unreadable
  }

  const raw = cell(row, source.amount);
  const signed = parseSignedAmount(raw);
  if (signed === null || signed === 0) return null;
  const amount = Math.abs(signed);

  // Direction priority: Dr/Cr indicator column, then a Dr/Cr marker in the cell, then the sign.
  if (source.indicator >= 0) {
    const value = cell(row, source.indicator);
    if (DR_MARKER.test(value)) return { amount, direction: 'debit' };
    if (CR_MARKER.test(value)) return { amount, direction: 'credit' };
    return null;
  }
  const marker = TRAILING_MARKER.exec(raw)?.[1]?.toLowerCase();
  if (marker === 'dr') return { amount, direction: 'debit' };
  if (marker === 'cr') return { amount, direction: 'credit' };
  const isNegative = signed < 0;
  const isDebit = source.flip ? !isNegative : isNegative;
  return { amount, direction: isDebit ? 'debit' : 'credit' };
}

function parseRow(row: string[], columns: Columns): Transaction | null {
  const date = parseDate(cell(row, columns.date));
  if (date === null) return null;
  const parsed = readAmount(row, columns.amount);
  if (parsed === null) return null;
  return {
    date,
    narration: cell(row, columns.narration),
    amount: parsed.amount,
    direction: parsed.direction,
  };
}

/**
 * Parses statement CSV text into Transactions. Never throws on bad content:
 * unreadable rows are skipped and counted, and undetectable columns are
 * reported with `needsMapping: true` (plus `headers` and `rawRows` for the
 * column mapper; `rawRows` excludes the header row and any preamble).
 *
 * Direction rules: separate withdrawal/deposit columns by which is filled; a
 * single amount column by a Dr/Cr indicator column, else a trailing Dr/Cr in
 * the cell, else the sign (negative = debit, positive = credit).
 */
export function parseStatement(text: string): ParseResult {
  const withoutBom = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows = Papa.parse<string[]>(withoutBom, {
    header: false,
    skipEmptyLines: 'greedy',
    delimiter: ',',
  }).data;

  if (rows.length === 0) {
    return { transactions: [], skippedRows: 0, needsMapping: false };
  }

  const headerIndex = rows.findIndex(isHeaderRow);
  if (headerIndex < 0) {
    const width = Math.max(...rows.map((r) => r.length));
    return {
      transactions: [],
      skippedRows: 0,
      needsMapping: true,
      headers: Array.from({ length: width }, (_, i) => `Column ${i + 1}`),
      rawRows: rows,
    };
  }

  const headers = (rows[headerIndex] ?? []).map((h) => h.trim());
  const dataRows = rows.slice(headerIndex + 1);
  const columns = detectColumns(headers);
  if (columns === null) {
    return { transactions: [], skippedRows: 0, needsMapping: true, headers, rawRows: dataRows };
  }

  const transactions: Transaction[] = [];
  let skippedRows = 0;
  for (const row of dataRows) {
    const transaction = parseRow(row, columns);
    if (transaction) transactions.push(transaction);
    else skippedRows += 1;
  }
  return { transactions, skippedRows, needsMapping: false };
}

/** Zero-based column indexes chosen by the user in the column mapper. */
export interface ColumnMapping {
  date: number;
  narration: number;
  /** A single amount column, read as signed: negative = debit, positive = credit. */
  amount: number;
  /** When true the sign is reversed: positive = debit, negative = credit. */
  flipSign: boolean;
}

function isValidIndex(index: number, width: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < width;
}

/**
 * Parses rows using columns the user picked manually (the `needsMapping` path).
 * `rawRows` and `headers` are the values returned by `parseStatement`; `rawRows`
 * excludes the header row.
 *
 * The amount column is read as a signed amount (negative = debit). With
 * `flipSign` the sign is reversed, which is also how a debit-only column
 * (all positive) is mapped. A trailing `Dr`/`Cr` in the cell is an explicit
 * direction and wins over the sign, so `flipSign` does not affect it.
 *
 * Unreadable rows are skipped and counted; blank rows are ignored. If the
 * mapping is invalid (index out of range, not an integer, or one column used
 * for two roles) nothing is parsed and `needsMapping: true` is returned again
 * with the same `headers` and `rawRows`. Never throws.
 */
export function applyMapping(
  rawRows: string[][],
  headers: string[],
  mapping: ColumnMapping,
): ParseResult {
  const { date, narration, amount, flipSign } = mapping;
  const indexes = [date, narration, amount];
  const valid =
    indexes.every((i) => isValidIndex(i, headers.length)) && new Set(indexes).size === indexes.length;
  if (!valid) {
    return { transactions: [], skippedRows: 0, needsMapping: true, headers, rawRows };
  }

  const columns: Columns = {
    date,
    narration,
    amount: { kind: 'single', amount, indicator: -1, flip: flipSign },
  };
  const transactions: Transaction[] = [];
  let skippedRows = 0;
  for (const row of rawRows) {
    if (row.every((c) => c.trim() === '')) continue;
    const transaction = parseRow(row, columns);
    if (transaction) transactions.push(transaction);
    else skippedRows += 1;
  }
  return { transactions, skippedRows, needsMapping: false };
}

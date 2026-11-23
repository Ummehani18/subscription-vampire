import { applyMapping, type ColumnMapping } from '../core/parseStatement';
import type { Transaction } from '../core/types';

export interface PreviewRow {
  raw: string[];
  /** How the row reads under the mapping, or null if it would be skipped. */
  transaction: Transaction | null;
}

/**
 * The first `limit` non-blank rows as they would be parsed with `mapping`, using
 * `applyMapping` itself so the preview never disagrees with the real result.
 * Returns null when the mapping cannot be used (a column missing or used twice).
 */
export function previewRows(
  rawRows: string[][],
  headers: string[],
  mapping: ColumnMapping,
  limit = 5,
): PreviewRow[] | null {
  if (applyMapping([], headers, mapping).needsMapping) return null;
  return rawRows
    .filter((row) => row.some((cell) => cell.trim() !== ''))
    .slice(0, limit)
    .map((raw) => ({ raw, transaction: applyMapping([raw], headers, mapping).transactions[0] ?? null }));
}

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applyMapping, parseStatement } from '../../src/core/parseStatement';
import { appReducer, initialState, type AppState } from '../../src/ui/appState';

const SAMPLE = readFileSync(new URL('../../data/sample-statement.csv', import.meta.url), 'utf8');

/** A statement whose date column ("Posting Date") is not detected, so it needs mapping. */
const UNDETECTED = [
  'Posting Date,Narration,Debit,Balance',
  '05/05/26,NACH-NETFLIX COM-1111111,649.00,9000.00',
  '05/06/26,NACH-NETFLIX COM-2222222,649.00,8351.00',
  '05/07/26,NACH-NETFLIX COM-3333333,649.00,7702.00',
  'not a date,BROKEN ROW,1.00,7701.00',
].join('\n');

const parsed = (text: string) => appReducer(initialState, { type: 'statementParsed', result: parseStatement(text) });

describe('appReducer: upload', () => {
  it('starts on the upload screen with nothing loaded', () => {
    expect(initialState).toMatchObject({ stage: 'upload', busy: false, uploadError: null, mapping: null, skippedRows: 0 });
    expect(initialState.transactions).toEqual([]);
    expect(initialState.vampires).toEqual([]);
  });

  it('readStarted marks the app busy and clears a previous error', () => {
    const withError = appReducer(initialState, { type: 'fileRejected', error: 'not-csv' });
    expect(appReducer(withError, { type: 'readStarted' })).toMatchObject({ busy: true, uploadError: null, stage: 'upload' });
  });

  it.each(['not-csv', 'empty', 'too-large', 'unreadable'] as const)(
    'fileRejected (%s) stays on the upload screen with the error, and the app stays usable',
    (error) => {
      const busy = appReducer(initialState, { type: 'readStarted' });
      const rejected = appReducer(busy, { type: 'fileRejected', error });
      expect(rejected).toMatchObject({ stage: 'upload', busy: false, uploadError: error });
      // A following good file still works.
      const next = appReducer(appReducer(rejected, { type: 'readStarted' }), {
        type: 'statementParsed',
        result: parseStatement(SAMPLE),
      });
      expect(next.stage).toBe('dashboard');
      expect(next.uploadError).toBeNull();
    },
  );
});

describe('appReducer: detected statements go straight to the dashboard', () => {
  it('the sample statement (Req 1.6) is analysed with no skipped rows', () => {
    const state = parsed(SAMPLE);
    expect(state.stage).toBe('dashboard');
    expect(state.busy).toBe(false);
    expect(state.transactions).toHaveLength(119);
    expect(state.skippedRows).toBe(0);
    expect(state.vampires).toHaveLength(8);
    expect(state.decisions).toEqual({});
    expect([...state.counted]).toEqual([]);
  });

  it('keeps the skipped-row count for the "N rows skipped" notice', () => {
    const withBadRow = SAMPLE.replace('02/05/26,"UPI-PHARMEASY', 'xx/05/26,"UPI-PHARMEASY');
    const state = parsed(withBadRow);
    expect(state.stage).toBe('dashboard');
    expect(state.skippedRows).toBe(1);
    expect(state.transactions).toHaveLength(118);
  });
});

describe('appReducer: column mapping (Req 1.5)', () => {
  it('a statement with undetected columns goes to the mapper with its headers and rows', () => {
    const state = parsed(UNDETECTED);
    expect(state.stage).toBe('mapping');
    expect(state.mapping).toEqual({
      headers: ['Posting Date', 'Narration', 'Debit', 'Balance'],
      rawRows: expect.any(Array),
      problem: false,
    });
    expect(state.mapping?.rawRows).toHaveLength(4);
  });

  it('an unusable mapping keeps the mapper open and flags the problem', () => {
    const mapping = parsed(UNDETECTED);
    const { headers, rawRows } = mapping.mapping as NonNullable<AppState['mapping']>;
    const result = applyMapping(rawRows, headers, { date: 0, narration: 0, amount: 2, flipSign: false });
    const next = appReducer(mapping, { type: 'mappingApplied', result });
    expect(next.stage).toBe('mapping');
    expect(next.mapping?.problem).toBe(true);
    expect(next.mapping?.headers).toEqual(headers);
  });

  it('a usable mapping with "Flip sign" reads the positive Debit column as money out and analyses it', () => {
    const mapping = parsed(UNDETECTED);
    const { headers, rawRows } = mapping.mapping as NonNullable<AppState['mapping']>;
    const result = applyMapping(rawRows, headers, { date: 0, narration: 1, amount: 2, flipSign: true });
    const next = appReducer(mapping, { type: 'mappingApplied', result });
    expect(next.stage).toBe('dashboard');
    expect(next.mapping).toBeNull();
    expect(next.transactions.map((t) => t.direction)).toEqual(['debit', 'debit', 'debit']);
    expect(next.skippedRows).toBe(1);
    expect(next.vampires.map((v) => v.key)).toEqual(['NETFLIX']);
  });

  it('without "Flip sign" the same rows are money in, so nothing is detected', () => {
    const mapping = parsed(UNDETECTED);
    const { headers, rawRows } = mapping.mapping as NonNullable<AppState['mapping']>;
    const result = applyMapping(rawRows, headers, { date: 0, narration: 1, amount: 2, flipSign: false });
    const next = appReducer(mapping, { type: 'mappingApplied', result });
    expect(next.transactions.map((t) => t.direction)).toEqual(['credit', 'credit', 'credit']);
    expect(next.vampires).toEqual([]);
  });

  it('ignores mappingApplied outside the mapping screen', () => {
    const result = parseStatement(SAMPLE);
    expect(appReducer(initialState, { type: 'mappingApplied', result })).toBe(initialState);
  });
});

describe('appReducer: purity', () => {
  it('does not modify the previous state', () => {
    const before = parsed(UNDETECTED);
    const snapshot = JSON.stringify(before);
    const { headers, rawRows } = before.mapping as NonNullable<AppState['mapping']>;
    appReducer(before, { type: 'mappingApplied', result: applyMapping(rawRows, headers, { date: 0, narration: 1, amount: 2, flipSign: true }) });
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import Papa from 'papaparse';

describe('scaffold smoke tests', () => {
  it('runs example tests', () => {
    expect(1 + 1).toBe(2);
  });

  it('runs fast-check property tests: addition is commutative', () => {
    fc.assert(fc.property(fc.integer(), fc.integer(), (a, b) => a + b === b + a));
  });

  it('has papaparse available', () => {
    const result = Papa.parse<string[]>('a,b\n1,2', { header: false });
    expect(result.data).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
});

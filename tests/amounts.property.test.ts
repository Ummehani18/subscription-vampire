import { describe, it } from 'vitest';
import fc from 'fast-check';
import { formatINR, parseAmount } from '../src/core/amounts';

// Renderers build strings from integer arithmetic only (no floats), and are
// independent of the implementation under test, except `indianFormatted`
// which deliberately uses `formatINR`.
function split(paise: number): { rupees: string; fraction: string } {
  return {
    rupees: String(Math.floor(paise / 100)),
    fraction: String(paise % 100).padStart(2, '0'),
  };
}

function groupWestern(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function groupIndian(digits: string): string {
  if (digits.length <= 3) return digits;
  const head = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${head},${digits.slice(-3)}`;
}

type Renderer = (paise: number) => string;

const plain: Renderer = (p) => {
  const { rupees, fraction } = split(p);
  return `${rupees}.${fraction}`;
};

const plainNoDecimals: Renderer = (p) => {
  // Only whole-rupee amounts can be written without decimals; others keep them.
  const { rupees, fraction } = split(p);
  return fraction === '00' ? rupees : `${rupees}.${fraction}`;
};

const westernGrouped: Renderer = (p) => {
  const { rupees, fraction } = split(p);
  return `${groupWestern(rupees)}.${fraction}`;
};

const indianGrouped: Renderer = (p) => {
  const { rupees, fraction } = split(p);
  return `${groupIndian(rupees)}.${fraction}`;
};

const indianFormatted: Renderer = (p) => formatINR(p);

const withSymbol = (symbol: string, base: Renderer): Renderer => {
  return (p) => `${symbol}${base(p)}`;
};

const renderers: Array<[string, Renderer]> = [
  ['plain', plain],
  ['plain, whole rupees without decimals', plainNoDecimals],
  ['western comma grouping', westernGrouped],
  ['indian grouping', indianGrouped],
  ['formatINR output', indianFormatted],
  ['₹ prefix, plain', withSymbol('₹', plain)],
  ['₹ prefix, indian grouping', withSymbol('₹', indianGrouped)],
  ['₹ prefix with space, western grouping', withSymbol('₹ ', westernGrouped)],
  ['Rs. prefix, indian grouping', withSymbol('Rs. ', indianGrouped)],
  ['Rs prefix, western grouping', withSymbol('Rs ', westernGrouped)],
  ['INR prefix, indian grouping', withSymbol('INR ', indianGrouped)],
];

// Any non-negative integer paise parseAmount can hold, biased toward the
// small and typical values where off-by-one and float errors show up.
const paiseArb = fc.oneof(
  { arbitrary: fc.integer({ min: 0, max: 1000 }), weight: 2 },
  { arbitrary: fc.integer({ min: 0, max: 100_000_000 }), weight: 4 },
  { arbitrary: fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }), weight: 3 },
  { arbitrary: fc.constantFrom(0, 1, 99, 100, 101, 99_999, 100_000, Number.MAX_SAFE_INTEGER), weight: 1 },
);

describe('P1: parseAmount round trip', () => {
  for (const [name, render] of renderers) {
    it(`parseAmount(format(x)) == x for any non-negative integer paise x (${name})`, () => {
      fc.assert(
        fc.property(paiseArb, (paise) => parseAmount(render(paise)) === paise),
        { numRuns: 1000 },
      );
    });
  }

  it('parseAmount(format(x)) == x with any format chosen at random and padded with spaces', () => {
    const spaces = fc.constantFrom('', ' ', '  ');
    fc.assert(
      fc.property(
        paiseArb,
        fc.constantFrom(...renderers.map(([, render]) => render)),
        spaces,
        spaces,
        (paise, render, left, right) => parseAmount(`${left}${render(paise)}${right}`) === paise,
      ),
      { numRuns: 2000 },
    );
  });
});

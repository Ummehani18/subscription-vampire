import fc from 'fast-check';
import { describe, it } from 'vitest';
import { normalizeMerchant } from '../src/core/normalizeMerchant';
import { BANK_CODES } from '../src/core/normalizeMerchant';
import { MERCHANT_ALIASES } from '../src/data/merchantAliases';

const keyOf = (narration: string): string => normalizeMerchant(narration).key;

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

/**
 * Words the normaliser strips by design (bank prefixes, Dr/Cr markers, IFSC bank
 * codes), so a generated merchant never consists of them.
 */
const RESERVED = new Set([
  'UPI', 'ACH', 'NACH', 'ECS', 'POS', 'AUTOPAY', 'IMPS', 'NEFT', 'BIL', 'INFT', 'DEBIT', 'CREDIT',
  'TO', 'BY', 'TRANSFER', 'D', 'DR', 'CR',
  ...BANK_CODES,
]);

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

/** A letters-only merchant word, 2-10 letters, not a reserved word. */
const merchantWord = fc
  .array(fc.constantFrom(...LETTERS), { minLength: 2, maxLength: 10 })
  .map((letters) => letters.join(''))
  .filter((word) => !RESERVED.has(word));

/** Real merchant names: every alias canonical name plus the unknown merchants in the fixtures. */
const KNOWN_NAMES = MERCHANT_ALIASES.map((alias) => alias.canonical);
const FIXTURE_UNKNOWN_NAMES = [
  'LANDLORD RAMESH', 'LANDLORD SURESH', 'HOUSE RENT', 'SWIGGY', 'ZOMATO', 'AMAZON PAY', 'UBER INDIA',
  'BIGBASKET', 'BLINKIT', 'IRCTC', 'DECATHLON', 'PHARMEASY', 'BESCOM ELECTRICITY', 'FRIEND ARJUN',
  'FRESH MILK DAIRY', 'SPOTIFY INDIA', 'JIO PREPAID RECHARGE', 'BHARTI AIRTEL LTD', 'TATA 1MG', 'FITNESS 365',
];

/** A merchant: a real name, or 1-3 generated words, in a random letter case. */
const merchant = fc
  .tuple(
    fc.oneof(
      { arbitrary: fc.constantFrom(...KNOWN_NAMES, ...FIXTURE_UNKNOWN_NAMES), weight: 1 },
      { arbitrary: fc.array(merchantWord, { minLength: 1, maxLength: 3 }).map((w) => w.join(' ')), weight: 2 },
    ),
    fc.constantFrom<'upper' | 'lower' | 'asIs'>('upper', 'lower', 'asIs'),
  )
  .map(([name, letterCase]) =>
    letterCase === 'upper' ? name.toUpperCase() : letterCase === 'lower' ? name.toLowerCase() : name,
  );

/** A reference number: a run of 6-18 digits. */
const reference = fc
  .array(fc.constantFrom(...'0123456789'.split('')), { minLength: 6, maxLength: 18 })
  .map((digits) => digits.join(''));

/** Narration layouts seen in the HDFC, SBI and ICICI statements, with `${m}` the merchant and `${r}` the reference. */
type Template = (m: string, r: string) => string;
const TEMPLATES: Template[] = [
  (m, r) => `UPI-${m}-${r}@ybl`,
  (m, r) => `UPI-${m}-${r}`,
  (m, r) => `NACH-${m}-${r}`,
  (m, r) => `ACH D- ${m}-${r}`,
  (m, r) => `AUTOPAY ${m}-${r}`,
  (m, r) => `ECS ${m} ${r}`,
  (m, r) => `POS ${m} ${r}`,
  (m, r) => `DEBIT-ACH D- ${m}-${r}`,
  (m, r) => `TO TRANSFER-UPI/DR/${r}/${m}/YESB/shop@ybl/Order`,
  (m, r) => `UPI/${r}/${m}/shop@okaxis/YES BANK`,
  (m, r) => `BIL/INFT/${r}/${m}`,
  (m, r) => `ACH/${m}/ICIC0000001/${r}`,
  (m, r) => `${m} ${r}`,
  (m, r) => `${m}-${r}`,
  (m, r) => `${m}*${r}`,
  (m, r) => `${m}${r}`,
  (m, r) => `${r} ${m}`,
];
const template = fc.integer({ min: 0, max: TEMPLATES.length - 1 }).map((i) => TEMPLATES[i] as Template);

/** Bank-narration-like text built from the pieces the normaliser deals with. */
const NARRATION_TOKENS = [
  'UPI-', 'UPI/', 'ACH D- ', 'ACH/', 'NACH-', 'ECS ', 'POS ', 'AUTOPAY ', 'IMPS-', 'NEFT ', 'NEFT CR-', 'BIL/INFT/',
  'TO TRANSFER-', 'BY TRANSFER-', 'DEBIT-', '/DR/', '/CR/', ' DR', ' CR',
  '-', '/', '*', ' ', '  ', '.', ',', ':', '(', ')', '+', '&', '_', '@', '"', '#',
  '@ybl', '9876@oksbi', 'spotify@ybl', 'SBIN0000000', 'ICIC0000001',
  '05/05/26', '05-05-2026', '2026-05-05', '5 MAY 26', '05-MAY-2026',
  '1', '7', '12', '99', '365', '12345', '123456', '4123001047290',
  'ZEE5', '1MG', 'ZEE 5', 'MICROSOFT 365', 'JIO', 'JIOHOTSTAR', 'HOTSTAR', 'AMAZON PAY', 'AMAZON PRIME',
  'NETFLIX', 'VI', 'VODAFONE IDEA', 'GOOGLE', 'ONE', 'CULT', 'FIT', 'A', 'D', 'MART', 'STORE', 'NAME',
];
const narrationLike = fc
  .array(
    fc.oneof(
      { arbitrary: fc.constantFrom(...NARRATION_TOKENS), weight: 3 },
      { arbitrary: merchantWord, weight: 1 },
      { arbitrary: merchant, weight: 1 },
    ),
    { maxLength: 12 },
  )
  .map((parts) => parts.join(''));

// ---------------------------------------------------------------------------
// P4
// ---------------------------------------------------------------------------

describe('P4: normalizeMerchant is idempotent', () => {
  const idempotent = (narration: string): boolean => {
    const key = keyOf(narration);
    return keyOf(key) === key;
  };

  it('normalizeMerchant is idempotent: normalize(normalize(x).key).key == normalize(x).key for bank-narration-like text', () => {
    fc.assert(fc.property(narrationLike, idempotent), { numRuns: 5000 });
  });

  it('normalizeMerchant is idempotent for the fixture narration layouts', () => {
    fc.assert(fc.property(template, merchant, reference, (t, m, r) => idempotent(t(m, r))), { numRuns: 3000 });
  });

  it('normalizeMerchant is idempotent for arbitrary strings', () => {
    fc.assert(fc.property(fc.string({ maxLength: 60 }), idempotent), { numRuns: 3000 });
  });

  it('normalizeMerchant is idempotent for arbitrary Unicode strings', () => {
    fc.assert(fc.property(fc.string({ unit: 'binary', maxLength: 40 }), idempotent), { numRuns: 2000 });
  });
});

// ---------------------------------------------------------------------------
// P5
// ---------------------------------------------------------------------------

describe('P5: normalizeMerchant ignores reference numbers', () => {
  it('normalizeMerchant ignores reference numbers: the same merchant with different 6+ digit references yields the same key', () => {
    const distinctReferences = fc.tuple(reference, reference).filter(([a, b]) => a !== b);
    fc.assert(
      fc.property(template, merchant, distinctReferences, (t, m, [r1, r2]) => {
        const k1 = keyOf(t(m, r1));
        const k2 = keyOf(t(m, r2));
        // The merchant must actually produce a key, so the property is not passing on empty keys.
        return k1 !== '' && k1 === k2;
      }),
      { numRuns: 5000 },
    );
  });

  it('normalizeMerchant ignores reference numbers: two references in one narration can both change', () => {
    const twoReferences = fc.tuple(reference, reference, reference, reference);
    fc.assert(
      fc.property(merchant, twoReferences, (m, [a1, b1, a2, b2]) => {
        const narration = (a: string, b: string): string => `TO TRANSFER-UPI/DR/${a}/${m}/YESB/${b}@ybl/Order`;
        const k1 = keyOf(narration(a1, b1));
        return k1 !== '' && k1 === keyOf(narration(a2, b2));
      }),
      { numRuns: 2000 },
    );
  });
});

import { describe, expect, it } from 'vitest';
import { formatINR, parseAmount, parseSignedAmount } from '../src/core/amounts';

describe('parseAmount', () => {
  it.each([
    ['1276.00', 127600],
    ['299', 29900],
    ['0', 0],
    ['0.00', 0],
    ['0.5', 50],
    ['.75', 75],
    ['1,23,456.78', 12345678],
    ['1,234.56', 123456],
    ['85000.00', 8500000],
    ['  649.00  ', 64900],
  ])('parses plain and grouped number %j -> %d paise', (input, expected) => {
    expect(parseAmount(input)).toBe(expected);
  });

  it.each([
    ['₹1,950.00', 195000],
    ['₹ 1,950', 195000],
    ['Rs. 1,23,456.78', 12345678],
    ['Rs 130', 13000],
    ['rs.130', 13000],
    ['INR 18,000.00', 1800000],
    ['inr18000', 1800000],
  ])('strips currency marker in %j -> %d paise', (input, expected) => {
    expect(parseAmount(input)).toBe(expected);
  });

  it.each([
    ['1,200.00 Dr', 120000],
    ['1,200.00Dr', 120000],
    ['500.50 CR', 50050],
    ['500.50 cr.', 50050],
    ['₹ 2,000 Dr', 200000],
  ])('accepts trailing Dr/Cr in %j -> %d paise', (input, expected) => {
    expect(parseAmount(input)).toBe(expected);
  });

  it('returns the absolute value for negatives and parentheses', () => {
    expect(parseAmount('-1,234.50')).toBe(123450);
    expect(parseAmount('\u2212200')).toBe(20000);
    expect(parseAmount('(1,234.50)')).toBe(123450);
    expect(parseAmount('-₹99')).toBe(9900);
  });

  it('avoids floating-point error', () => {
    // 0.1 + 0.2 style traps: 1.15 * 100 = 114.99999999999999 in floats
    expect(parseAmount('1.15')).toBe(115);
    expect(parseAmount('19.99')).toBe(1999);
    expect(parseAmount('4.35')).toBe(435);
    expect(parseAmount('1.005')).toBeNull();
  });

  it('handles large values exactly', () => {
    expect(parseAmount('1,00,00,00,000.00')).toBe(100000000000);
    expect(parseAmount('90071992547409.91')).toBe(Number.MAX_SAFE_INTEGER);
    expect(parseAmount('90071992547409.92')).toBeNull(); // beyond safe integer paise
    expect(parseAmount('999999999999999.00')).toBeNull(); // 15 integer digits
  });

  it.each([
    '',
    '   ',
    'abc',
    '₹',
    'Rs.',
    'Dr',
    '1.2.3',
    '1,,234',
    ',123',
    '123,',
    '12 34',
    '1e5',
    '1.234',
    '--5',
    '(5',
    'NaN',
  ])('returns null for invalid input %j', (input) => {
    expect(parseAmount(input)).toBeNull();
  });
});

describe('parseSignedAmount', () => {
  it('returns positive paise for unsigned input', () => {
    expect(parseSignedAmount('1,234.50')).toBe(123450);
    expect(parseSignedAmount('₹649')).toBe(64900);
  });

  it('returns negative paise for a leading minus', () => {
    expect(parseSignedAmount('-1,234.50')).toBe(-123450);
    expect(parseSignedAmount('\u2212200')).toBe(-20000);
    expect(parseSignedAmount('-₹99')).toBe(-9900);
    expect(parseSignedAmount('₹-99')).toBe(-9900);
    expect(parseSignedAmount('- 50')).toBe(-5000);
  });

  it('returns negative paise for parentheses', () => {
    expect(parseSignedAmount('(1,234.50)')).toBe(-123450);
    expect(parseSignedAmount('(₹500)')).toBe(-50000);
  });

  it('does not let a Dr/Cr marker change the sign', () => {
    expect(parseSignedAmount('500 Dr')).toBe(50000);
    expect(parseSignedAmount('500 Cr')).toBe(50000);
    expect(parseSignedAmount('-500 Dr')).toBe(-50000);
  });

  it('never returns negative zero', () => {
    expect(Object.is(parseSignedAmount('-0.00'), 0)).toBe(true);
    expect(Object.is(parseSignedAmount('(0)'), 0)).toBe(true);
  });

  it('returns null for invalid input', () => {
    expect(parseSignedAmount('')).toBeNull();
    expect(parseSignedAmount('abc')).toBeNull();
    expect(parseSignedAmount('1.234')).toBeNull();
  });
});

describe('formatINR', () => {
  it.each([
    [0, '₹0.00'],
    [5, '₹0.05'],
    [99, '₹0.99'],
    [100, '₹1.00'],
    [64900, '₹649.00'],
    [99900, '₹999.00'],
    [100000, '₹1,000.00'],
    [195000, '₹1,950.00'],
    [1800000, '₹18,000.00'],
    [12345678, '₹1,23,456.78'],
    [1000000000, '₹1,00,00,000.00'],
    [123456789012, '₹1,23,45,67,890.12'],
  ])('formats %d paise as %s', (paise, expected) => {
    expect(formatINR(paise)).toBe(expected);
  });

  it('formats negative values with a leading minus', () => {
    expect(formatINR(-123450)).toBe('-₹1,234.50');
    expect(formatINR(-5)).toBe('-₹0.05');
  });

  it('throws RangeError for non-integer or unsafe input', () => {
    expect(() => formatINR(1.5)).toThrow(RangeError);
    expect(() => formatINR(Number.NaN)).toThrow(RangeError);
    expect(() => formatINR(Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(() => formatINR(Number.MAX_SAFE_INTEGER + 1)).toThrow(RangeError);
  });

  it('output can be parsed back to the same paise', () => {
    for (const p of [0, 1, 99, 100, 64900, 12345678, 123456789012]) {
      expect(parseAmount(formatINR(p))).toBe(p);
    }
  });
});

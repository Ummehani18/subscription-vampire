import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Reads the palette from src/index.css so the check follows the real tokens.
const css = readFileSync(new URL('../../src/index.css', import.meta.url), 'utf8');
const palette = Object.fromEntries(
  [...css.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6});/gi)].map((m) => [m[1] as string, (m[2] as string).toLowerCase()]),
);

/** WCAG 2.x relative luminance and contrast ratio. */
function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

// Every text colour / background pair the Task 7 screens use.
const TEXT_PAIRS: Array<[string, string]> = [
  ['bone', 'bg'],
  ['bone', 'surface'],
  ['bone', 'surface-2'],
  ['bone', 'blood'], // primary button label
  ['muted', 'bg'],
  ['muted', 'surface'],
  ['muted', 'surface-2'],
  ['blood-bright', 'bg'], // error text
  ['blood-bright', 'surface'],
  ['gold', 'surface'], // skipped-rows notice
  ['garlic', 'surface'], // privacy badge
  // Task 8 dashboard: badges sit on bg, card text on surface.
  ['gold', 'bg'], // price hike, possible duplicate
  ['garlic', 'bg'], // price drop, staked
  ['blood-bright', 'surface-2'],
];

describe('theme text contrast (WCAG AA, 4.5:1 for normal text)', () => {
  it('reads all nine palette tokens from src/index.css', () => {
    expect(Object.keys(palette).sort()).toEqual(
      ['bg', 'blood', 'blood-bright', 'bone', 'garlic', 'gold', 'muted', 'surface', 'surface-2'],
    );
  });

  it.each(TEXT_PAIRS)('%s text on %s meets 4.5:1', (text, background) => {
    expect(contrast(palette[text] as string, palette[background] as string)).toBeGreaterThanOrEqual(4.5);
  });

  it('blood (#C1121F) is not dark-background text colour: it fails 4.5:1 on bg', () => {
    // Documents why the UI uses blood only for fills and borders, and blood-bright for text.
    expect(contrast(palette.blood as string, palette.bg as string)).toBeLessThan(4.5);
  });
});

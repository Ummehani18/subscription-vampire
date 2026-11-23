import { describe, expect, it } from 'vitest';
import { parseDate } from '../src/core/dates';
import { CANCEL_GUIDES, VERIFY_NOTE, genericGuide, guideFor } from '../src/data/cancelGuides';
import { MERCHANT_ALIASES } from '../src/data/merchantAliases';

const CANONICAL = new Set(MERCHANT_ALIASES.map((a) => a.canonical));

/** Each guide must point at the provider's own help site. */
const PROVIDER_HOSTS: Record<string, string> = {
  Netflix: 'help.netflix.com',
  Spotify: 'support.spotify.com',
  'YouTube Premium': 'support.google.com',
  ChatGPT: 'help.openai.com',
  'Sony LIV': 'help.sonyliv.com',
};

describe('CANCEL_GUIDES data (Req 7.1, design: cancelGuides.ts)', () => {
  const entries = Object.entries(CANCEL_GUIDES);

  it('lists the verified merchants', () => {
    expect(Object.keys(CANCEL_GUIDES).sort()).toEqual(Object.keys(PROVIDER_HOSTS).sort());
  });

  it.each(entries)('%s is keyed by a canonical merchant name from the alias table', (merchant) => {
    expect(CANONICAL.has(merchant)).toBe(true);
  });

  it.each(entries)('%s has short, non-empty steps', (_merchant, guide) => {
    expect(guide.steps.length).toBeGreaterThanOrEqual(2);
    for (const step of guide.steps) {
      expect(step.trim()).toBe(step);
      expect(step.length).toBeGreaterThan(5);
      expect(step.length).toBeLessThanOrEqual(140);
    }
  });

  it.each(entries)('%s carries a valid lastVerified date', (_merchant, guide) => {
    expect(guide.lastVerified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(parseDate(guide.lastVerified)).toBe(guide.lastVerified);
  });

  it.each(entries)("%s links to the provider's own help page over https", (merchant, guide) => {
    const url = new URL(guide.url ?? '');
    expect(url.protocol).toBe('https:');
    expect(url.hostname).toBe(PROVIDER_HOSTS[merchant]);
  });
});

describe('genericGuide and the verify note (Req 7.2, 7.3)', () => {
  it('covers the four generic steps from Req 7.2', () => {
    const text = genericGuide.steps.join(' ').toLowerCase();
    expect(text).toMatch(/app or website/);
    expect(text).toMatch(/revoke the upi autopay mandate/);
    expect(text).toMatch(/card e-mandate/);
    expect(text).toMatch(/contact your bank/);
  });

  it('uses the exact note from Req 7.3', () => {
    expect(VERIFY_NOTE).toBe('Verify in your app, steps may have changed');
  });
});

describe('guideFor', () => {
  it('returns the verified guide for a known merchant', () => {
    expect(guideFor('Netflix')).toEqual({ kind: 'merchant', guide: CANCEL_GUIDES.Netflix });
    expect(guideFor('Sony LIV').kind).toBe('merchant');
  });

  it('falls back to the generic steps for a merchant without a verified guide', () => {
    expect(guideFor('Landlord Ramesh')).toEqual({ kind: 'generic', steps: genericGuide.steps });
    expect(guideFor('Jio').kind).toBe('generic');
    expect(guideFor('').kind).toBe('generic');
  });

  it('matches the merchant name exactly', () => {
    expect(guideFor('netflix').kind).toBe('generic');
    expect(guideFor('Netflix ').kind).toBe('generic');
  });

  it('never treats object prototype names as guides', () => {
    for (const name of ['constructor', 'toString', '__proto__', 'hasOwnProperty', 'valueOf']) {
      expect(guideFor(name)).toEqual({ kind: 'generic', steps: genericGuide.steps });
    }
  });
});

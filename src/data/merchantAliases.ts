export interface MerchantAlias {
  /** Display name. Its uppercase form becomes the merchant key. */
  canonical: string;
  /** 'ott-video' | 'music' | 'cloud' | 'fitness' | 'telecom' | 'other' */
  category: string;
  /**
   * Tested against the cleaned, uppercased narration (prefixes, handles, dates and
   * long digit runs already removed). Every alias must match its own uppercased
   * canonical name, so that normalising a key returns the same key.
   */
  patterns: RegExp[];
}

/**
 * Known subscription merchants, from the approved design list. Order matters:
 * the first alias that matches wins, so specific aliases come before generic
 * ones (JioHotstar before Jio). Single common words are anchored to the start
 * of the narration so they do not match unrelated merchants.
 *
 * Deliberately not aliased: plain Amazon / Amazon Pay (only Amazon Prime),
 * plain Zomato and Swiggy (only Zomato Gold and Swiggy One), plain Google,
 * and bare YouTube.
 */
export const MERCHANT_ALIASES: readonly MerchantAlias[] = [
  { canonical: 'Netflix', category: 'ott-video', patterns: [/\bNETFLIX\b/] },
  { canonical: 'Amazon Prime', category: 'ott-video', patterns: [/\bAMAZON\s*PRIME\b/, /\bPRIME\s*VIDEO\b/] },
  // Before Jio, so "JIOHOTSTAR" is not read as Jio.
  {
    canonical: 'JioHotstar',
    category: 'ott-video',
    patterns: [/\bJIO\s*HOTSTAR\b/, /\bDISNEY\+?\s*HOTSTAR\b/, /\bHOTSTAR\b/],
  },
  { canonical: 'Sony LIV', category: 'ott-video', patterns: [/\bSONY\s*LIV\b/] },
  { canonical: 'Zee5', category: 'ott-video', patterns: [/\bZEE\s*5\b/] },
  { canonical: 'Spotify', category: 'music', patterns: [/\bSPOTIFY\b/] },
  { canonical: 'YouTube Premium', category: 'music', patterns: [/\bYOUTUBE\s*PREMIUM\b/, /\bGOOGLE\s*YOUTUBE\b/] },
  { canonical: 'Google One', category: 'cloud', patterns: [/\bGOOGLE\s*ONE\b/, /\bGOOGLE\s*STORAGE\b/] },
  { canonical: 'Apple iCloud', category: 'cloud', patterns: [/\bICLOUD\b/] },
  { canonical: 'Microsoft 365', category: 'other', patterns: [/\bMICROSOFT\s*365\b/, /\bOFFICE\s*365\b/] },
  { canonical: 'ChatGPT', category: 'other', patterns: [/\bCHATGPT\b/, /\bOPENAI\b/] },
  { canonical: 'Anthropic', category: 'other', patterns: [/\bANTHROPIC\b/] },
  { canonical: 'Notion', category: 'other', patterns: [/^NOTION\b/] },
  { canonical: 'Canva', category: 'other', patterns: [/^CANVA\b/] },
  { canonical: 'Adobe', category: 'other', patterns: [/^ADOBE\b/] },
  { canonical: 'LinkedIn', category: 'other', patterns: [/^LINKEDIN\b/] },
  { canonical: 'Audible', category: 'other', patterns: [/^AUDIBLE\b/] },
  { canonical: 'Zomato Gold', category: 'other', patterns: [/\bZOMATO\s*GOLD\b/] },
  { canonical: 'Swiggy One', category: 'other', patterns: [/\bSWIGGY\s*ONE\b/] },
  { canonical: 'Cult.fit', category: 'fitness', patterns: [/\bCULT[\s.]*FIT\b/] },
  { canonical: 'Jio', category: 'telecom', patterns: [/\bJIO\b/] },
  { canonical: 'Airtel', category: 'telecom', patterns: [/\bAIRTEL\b/] },
  {
    canonical: 'Vi',
    category: 'telecom',
    patterns: [/\bVODAFONE\s*IDEA\b/, /\bVI\s+(?:PREPAID|POSTPAID|RECHARGE)\b/, /^VI$/],
  },
];

import { describe, expect, it } from 'vitest';
import { MERCHANT_ALIASES } from '../src/data/merchantAliases';
import { normalizeMerchant } from '../src/core/normalizeMerchant';

const key = (narration: string): string => normalizeMerchant(narration).key;

describe('normalizeMerchant: known aliases from the three statement layouts', () => {
  it.each([
    // HDFC-style (data/sample-statement.csv)
    ['NACH-NETFLIX COM-5942859575', 'NETFLIX', 'Netflix'],
    ['ACH D- GOOGLE ONE-1810111', 'GOOGLE ONE', 'Google One'],
    ['UPI-SPOTIFY INDIA-spotify@ybl-798935572', 'SPOTIFY', 'Spotify'],
    ['AUTOPAY CULT FIT-2215279', 'CULT.FIT', 'Cult.fit'],
    ['POS OPENAI *CHATGPT SUBSCR SAN FRANCISCO', 'CHATGPT', 'ChatGPT'],
    ['UPI-YOUTUBE PREMIUM-google@okaxis-981836553', 'YOUTUBE PREMIUM', 'YouTube Premium'],
    ['UPI-JIO PREPAID RECHARGE-jio@paytm-996197331', 'JIO', 'Jio'],
    // SBI-style
    ['TO TRANSFER-UPI/DR/412300314187/NETFLIX/YESB/netflix@ybl/UPI MANDATE', 'NETFLIX', 'Netflix'],
    ['TO TRANSFER-UPI/DR/412300418916/GOOGLE ONE/UTIB/googleone@okaxis/Payment', 'GOOGLE ONE', 'Google One'],
    ['DEBIT-ACH D- JIOHOTSTAR-412301256748', 'JIOHOTSTAR', 'JioHotstar'],
    ['DEBIT-ECS BHARTI AIRTEL LTD-412301361477', 'AIRTEL', 'Airtel'],
    // ICICI-style
    ['UPI/412823959187/Spotify India/spotify@ybl/YES BANK', 'SPOTIFY', 'Spotify'],
    ['UPI/412824482832/YouTube Premium/googleplay@okaxis/AXIS BANK', 'YOUTUBE PREMIUM', 'YouTube Premium'],
    ['POS/OPENAI *CHATGPT SUBSCR/SAN FRANCISCO', 'CHATGPT', 'ChatGPT'],
    ['BIL/INFT/412826263/JIO PREPAID RECHARGE', 'JIO', 'Jio'],
    ['ACH/SONYLIV/ICIC0000001/41282699', 'SONY LIV', 'Sony LIV'],
  ])('%j -> key %s', (narration, expectedKey, display) => {
    const result = normalizeMerchant(narration);
    expect(result.key).toBe(expectedKey);
    expect(result.display).toBe(display);
    expect(result.known).toBe(true);
  });

  it('assigns the approved categories', () => {
    const category = (n: string): string => normalizeMerchant(n).category;
    expect(category('NACH-NETFLIX COM-5942859575')).toBe('ott-video');
    expect(category('UPI-SPOTIFY INDIA-spotify@ybl-798935572')).toBe('music');
    expect(category('UPI-YOUTUBE PREMIUM-google@okaxis-981836553')).toBe('music');
    expect(category('ACH D- GOOGLE ONE-1810111')).toBe('cloud');
    expect(category('AUTOPAY CULT FIT-2215279')).toBe('fitness');
    expect(category('UPI-JIO PREPAID RECHARGE-jio@paytm-996197331')).toBe('telecom');
    expect(category('DEBIT-ECS BHARTI AIRTEL LTD-412301361477')).toBe('telecom');
  });

  it('puts Spotify and YouTube Premium in the same category', () => {
    expect(normalizeMerchant('SPOTIFY').category).toBe(normalizeMerchant('YOUTUBE PREMIUM').category);
  });
});

describe('normalizeMerchant: unknown merchants', () => {
  it.each([
    // HDFC-style
    ['UPI-LANDLORD RAMESH-9876@oksbi-RENT', 'LANDLORD RAMESH', 'Landlord Ramesh'],
    ['UPI-SWIGGY-334298814@ybl', 'SWIGGY', 'Swiggy'],
    ['UPI-ZOMATO-339701014@ybl', 'ZOMATO', 'Zomato'],
    ['UPI-AMAZON PAY-680557051@ybl', 'AMAZON PAY', 'Amazon Pay'],
    ['UPI-UBER INDIA-366746013@ybl', 'UBER INDIA', 'Uber India'],
    ['UPI-BESCOM ELECTRICITY-BESCOM@okhdfc', 'BESCOM ELECTRICITY', 'Bescom Electricity'],
    ['UPI-FRIEND ARJUN-864623112@okicici', 'FRIEND ARJUN', 'Friend Arjun'],
    ['UPI-BIGBASKET-499858816@ybl', 'BIGBASKET', 'Bigbasket'],
    // SBI-style
    ['TO TRANSFER-UPI/DR/412300209458/LANDLORD SURESH/SBIN/landlord@sbi/RENT', 'LANDLORD SURESH', 'Landlord Suresh'],
    ['TO TRANSFER-UPI/DR/412305026992/AMAZON PAY/YESB/amazonpay@apl/Shopping', 'AMAZON PAY', 'Amazon Pay'],
    ['BY TRANSFER-NEFT*SBIN0000000*N412300104729*ACME TECH PVT LTD SALARY', 'ACME TECH', 'Acme Tech'],
    // ICICI-style
    ['UPI/412823854458/HOUSE RENT/landlord@okicici/ICICI BANK', 'HOUSE RENT', 'House Rent'],
    ['UPI/412827310515/FRESH MILK DAIRY/freshmilk@ybl/YES BANK', 'FRESH MILK', 'Fresh Milk'],
    ['UPI/412828043618/SWIGGY/swiggy@ybl/YES BANK', 'SWIGGY', 'Swiggy'],
  ])('%j -> key %s', (narration, expectedKey, display) => {
    const result = normalizeMerchant(narration);
    expect(result.key).toBe(expectedKey);
    expect(result.display).toBe(display);
    expect(result.known).toBe(false);
    expect(result.category).toBe('other');
  });

  it('uses the first two words of the first meaningful segment', () => {
    expect(key('UPI-SOME LONG MERCHANT NAME HERE-123')).toBe('SOME LONG');
    expect(key('POS UNKNOWN SHOP LONDON')).toBe('UNKNOWN SHOP');
  });
});

describe('normalizeMerchant: reference numbers and short tokens', () => {
  it('gives the same key for the same merchant with different reference numbers', () => {
    const keys = [
      'UPI-LANDLORD RAMESH-1111111111@oksbi-RENT',
      'UPI-LANDLORD RAMESH-9876543210@oksbi-RENT',
      'UPI-LANDLORD RAMESH-2@oksbi-RENT',
    ].map(key);
    expect(new Set(keys)).toEqual(new Set(['LANDLORD RAMESH']));

    expect(key('ACH D- GOOGLE ONE-1810111')).toBe(key('ACH D- GOOGLE ONE-4455413'));
    expect(key('UPI-UBER INDIA 123456')).toBe(key('UPI-UBER INDIA 9999999999'));
  });

  it('strips digit runs of 6 or more digits', () => {
    expect(key('UPI-SHOP NAME 123456')).toBe('SHOP NAME');
    expect(key('UPI-SHOP NAME 1234567890123')).toBe('SHOP NAME');
    expect(key('SHOP123456 STORE')).toBe('SHOP STORE');
    expect(key('UPI-4123001047290-DEMO STORE')).toBe('DEMO STORE');
  });

  it('keeps digit runs of 5 digits or fewer', () => {
    expect(key('UPI-SHOP 12345')).toBe('SHOP 12345');
    expect(key('UPI-SHOP NO 99')).toBe('SHOP NO');
    expect(key('UPI-STORE 7')).toBe('STORE 7');
  });

  it('keeps short meaningful tokens such as Zee5, 365 and 1mg', () => {
    expect(normalizeMerchant('UPI-ZEE5-1234567').key).toBe('ZEE5');
    expect(normalizeMerchant('UPI-zee 5-1234567').key).toBe('ZEE5');
    expect(normalizeMerchant('NACH-MICROSOFT 365-9876543').key).toBe('MICROSOFT 365');
    expect(normalizeMerchant('Microsoft365 Personal').key).toBe('MICROSOFT 365');
    expect(key('UPI-1MG-4455667788')).toBe('1MG');
    expect(key('UPI-TATA 1MG-4455667788')).toBe('TATA 1MG');
    expect(key('UPI-1MG HEALTH-4455667788')).toBe('1MG HEALTH');
  });

  it('removes a UPI handle as one token, including digits attached to it', () => {
    expect(key('UPI-LANDLORD RAMESH-9876@oksbi-RENT')).toBe('LANDLORD RAMESH');
    expect(key('UPI-SOME SHOP-some.shop_1@ybl')).toBe('SOME SHOP');
    expect(key('UPI-SOME SHOP-12@okaxis')).toBe('SOME SHOP');
  });

  it('strips dates in numeric, month-name and ISO form', () => {
    expect(key('UPI-CORNER STORE-05/05/2026')).toBe('CORNER STORE');
    expect(key('UPI-CORNER STORE 05-05-26')).toBe('CORNER STORE');
    expect(key('CORNER STORE 05-MAY-2026')).toBe('CORNER STORE');
    expect(key('CORNER STORE 5 May 26')).toBe('CORNER STORE');
    expect(key('CORNER STORE 2026-05-05')).toBe('CORNER STORE');
  });

  it('strips full month names and any spacing in month-name dates', () => {
    expect(key('CORNER STORE 5 SEPT 2026')).toBe('CORNER STORE');
    expect(key('CORNER STORE 05 DECEMBER 2026')).toBe('CORNER STORE');
    expect(key('CORNER STORE 05  MAY  26')).toBe('CORNER STORE');
  });

  it('does not read a merchant word that starts with a month abbreviation as a date (P4 counterexample)', () => {
    expect(key('12 DECATHLON05')).toBe('12 DECATHLON05');
    expect(key('UPI-DECATHLON-175006691@ybl')).toBe('DECATHLON');
    expect(key('5 MAYUR 26 SWEETS')).toBe('5 MAYUR');
    expect(key('3 MARKET 2026')).toBe('3 MARKET');
  });

  it('strips IFSC codes', () => {
    expect(key('ACH/DEMO LENDER/ICIC0000001/55')).toBe('DEMO LENDER');
    expect(key('NEFT-SBIN0000000-DEMO PAYEE')).toBe('DEMO PAYEE');
    expect(key('NEFT-HDFC0CAGSBK-DEMO PAYEE')).toBe('DEMO PAYEE');
  });

  it('keeps a 4-letter merchant glued to a reference that starts with 0 (P5 counterexample)', () => {
    expect(key('AAAA0000000')).toBe('AAAA');
    expect(key('AAAA000000')).toBe('AAAA');
    expect(key('UPI-ABCD0123456')).toBe('ABCD');
  });
});

describe('normalizeMerchant: short tokens survive next to stripped references (Task 4.2)', () => {
  it('keeps 365 in an unknown merchant, where no alias can hide a stripping mistake', () => {
    expect(key('UPI-FITNESS 365-4455667788')).toBe('FITNESS 365');
    expect(key('NACH-365 DAYS GYM-9876543')).toBe('365 DAYS');
  });

  it('keeps ZEE5, 365 and 1MG when a 6+ digit reference and a UPI handle are in the same narration', () => {
    expect(normalizeMerchant('UPI/412823854458/ZEE5/9876@oksbi/YES BANK')).toMatchObject({
      key: 'ZEE5',
      known: true,
    });
    expect(key('UPI/412823854458/FITNESS 365/9876@oksbi/YES BANK')).toBe('FITNESS 365');
    expect(key('UPI/412823854458/TATA 1MG/9876@oksbi/YES BANK')).toBe('TATA 1MG');
  });

  it('strips a 6-digit run glued to a short token but keeps the short token', () => {
    expect(key('UPI-TATA 1MG123456')).toBe('TATA 1MG');
    expect(key('UPI-FITNESS 365 123456')).toBe('FITNESS 365');
  });

  it('JioHotstar and Jio stay in different categories', () => {
    expect(normalizeMerchant('DEBIT-ACH D- JIOHOTSTAR-412301256748').category).toBe('ott-video');
    expect(normalizeMerchant('BIL/INFT/412826263/JIO PREPAID RECHARGE').category).toBe('telecom');
  });
});

describe('normalizeMerchant: prefixes', () => {
  it.each([
    ['UPI-DEMO STORE', 'DEMO STORE'],
    ['UPI/DEMO STORE', 'DEMO STORE'],
    ['ACH D- DEMO STORE', 'DEMO STORE'],
    ['ACH/DEMO STORE', 'DEMO STORE'],
    ['NACH-DEMO STORE', 'DEMO STORE'],
    ['NACH DEMO STORE', 'DEMO STORE'],
    ['ECS DEMO STORE', 'DEMO STORE'],
    ['POS DEMO STORE', 'DEMO STORE'],
    ['AUTOPAY DEMO STORE', 'DEMO STORE'],
    ['IMPS-DEMO STORE', 'DEMO STORE'],
    ['NEFT-DEMO STORE', 'DEMO STORE'],
    ['NEFT CR-DEMO STORE', 'DEMO STORE'],
    ['TO TRANSFER-UPI/DR/DEMO STORE', 'DEMO STORE'],
    ['BY TRANSFER-DEMO STORE', 'DEMO STORE'],
    ['DEBIT-ECS DEMO STORE', 'DEMO STORE'],
    ['BIL/INFT/DEMO STORE', 'DEMO STORE'],
    ['UPI-AUTOPAY-NACH-DEMO STORE', 'DEMO STORE'],
  ])('%j -> %s', (narration, expected) => {
    expect(key(narration)).toBe(expected);
  });

  it('does not strip a prefix that is only the start of a longer word', () => {
    expect(key('POSTMAN COURIERS')).toBe('POSTMAN COURIERS');
    expect(key('UPIWORKS LABS')).toBe('UPIWORKS LABS');
    expect(key('ECSTASY SALON')).toBe('ECSTASY SALON');
    expect(key('NACHOS HUT')).toBe('NACHOS HUT');
    expect(key('ACH DMART')).toBe('DMART');
    expect(key('ACH DMART STORES')).toBe('DMART STORES');
  });

  it('keeps a leading single letter D when it is part of the merchant', () => {
    expect(key('UPI-D MART-1234')).toBe('D MART');
  });
});

describe('normalizeMerchant: case, whitespace and punctuation', () => {
  it('ignores letter case', () => {
    expect(normalizeMerchant('upi-netflix com-1')).toEqual(normalizeMerchant('UPI-NETFLIX COM-1'));
    expect(key('upi-corner store-1')).toBe('CORNER STORE');
    expect(key('Corner Store')).toBe('CORNER STORE');
  });

  it('collapses and trims whitespace, tabs and newlines', () => {
    expect(key('   UPI-CORNER     STORE   ')).toBe('CORNER STORE');
    expect(key('CORNER\t\tSTORE\n')).toBe('CORNER STORE');
  });

  it('trims punctuation around words', () => {
    expect(key('***CORNER STORE***')).toBe('CORNER STORE');
    expect(key('..CORNER, STORE.')).toBe('CORNER STORE');
    expect(key('"CORNER STORE"')).toBe('CORNER STORE');
    expect(key('UPI--CORNER STORE--')).toBe('CORNER STORE');
  });

  it('keeps punctuation inside a word', () => {
    expect(key('H&M STORE')).toBe('H&M STORE');
    expect(key('CULT.GYM CLUB')).toBe('CULT.GYM CLUB');
  });

  it('ignores direction markers and bank-only segments before the merchant', () => {
    expect(key('UPI/DR/412300209458/DEMO STORE')).toBe('DEMO STORE');
    expect(key('NEFT CR/DEMO STORE')).toBe('DEMO STORE');
  });
});

describe('normalizeMerchant: alias matching rules', () => {
  it('matches known names whatever the surrounding text', () => {
    expect(key('some text NETFLIX more text')).toBe('NETFLIX');
    expect(key('netflix.com')).toBe('NETFLIX');
  });

  it('checks specific aliases first: JioHotstar before Jio', () => {
    expect(key('ACH D- JIOHOTSTAR-1234567')).toBe('JIOHOTSTAR');
    expect(key('JIO HOTSTAR SUBSCRIPTION')).toBe('JIOHOTSTAR');
    expect(key('DISNEY+ HOTSTAR')).toBe('JIOHOTSTAR');
    expect(key('HOTSTAR')).toBe('JIOHOTSTAR');
    expect(key('JIO PREPAID RECHARGE')).toBe('JIO');
  });

  it('does not treat Amazon Pay or plain Amazon as Amazon Prime', () => {
    expect(normalizeMerchant('UPI-AMAZON PAY-680557051@ybl').known).toBe(false);
    expect(normalizeMerchant('AMAZON SELLER SERVICES').known).toBe(false);
    expect(key('AMAZON PRIME MEMBERSHIP')).toBe('AMAZON PRIME');
    expect(key('PRIME VIDEO')).toBe('AMAZON PRIME');
  });

  it('does not alias plain Zomato or Swiggy, only Zomato Gold and Swiggy One', () => {
    expect(normalizeMerchant('UPI-ZOMATO-339701014@ybl').known).toBe(false);
    expect(normalizeMerchant('UPI-SWIGGY-334298814@ybl').known).toBe(false);
    expect(key('ZOMATO GOLD MEMBERSHIP')).toBe('ZOMATO GOLD');
    expect(key('SWIGGY ONE')).toBe('SWIGGY ONE');
  });

  it('does not match an alias inside a longer word', () => {
    expect(normalizeMerchant('JIOMART GROCERIES').known).toBe(false);
    expect(normalizeMerchant('AIRTELX SERVICES').known).toBe(false);
    expect(normalizeMerchant('NETFLIXISH CAFE').known).toBe(false);
  });

  it('anchors start-anchored aliases to the first meaningful segment, after references and markers', () => {
    expect(key('12/CR/LINKEDIN+UPI-')).toBe('LINKEDIN');
    expect(key('UPI/412823854458/NOTION LABS/x@ybl')).toBe('NOTION');
    expect(normalizeMerchant('UPI/SHOP/NOTION LABS').known).toBe(false);
  });

  it('anchors common single words to the start of the narration', () => {
    expect(key('NOTION LABS INC')).toBe('NOTION');
    expect(key('UPI-CANVA PTY-12')).toBe('CANVA');
    expect(key('ADOBE *ACROBAT')).toBe('ADOBE');
    expect(key('LINKEDIN PREMIUM')).toBe('LINKEDIN');
    expect(normalizeMerchant('MY NOTION OF FUN').known).toBe(false);
    expect(normalizeMerchant('BIG ADOBE HOMES').known).toBe(false);
  });

  it('maps the other approved services', () => {
    expect(key('GOOGLE STORAGE')).toBe('GOOGLE ONE');
    expect(key('GOOGLE YOUTUBE')).toBe('YOUTUBE PREMIUM');
    expect(key('APPLE ICLOUD STORAGE')).toBe('APPLE ICLOUD');
    expect(key('OFFICE 365 HOME')).toBe('MICROSOFT 365');
    expect(key('OPENAI')).toBe('CHATGPT');
    expect(key('ANTHROPIC PBC')).toBe('ANTHROPIC');
    expect(key('AUDIBLE')).toBe('AUDIBLE');
    expect(key('SONY LIV')).toBe('SONY LIV');
    expect(key('VODAFONE IDEA')).toBe('VI');
    expect(key('VI POSTPAID')).toBe('VI');
    expect(key('VI')).toBe('VI');
  });

  it('does not treat Google or YouTube on their own as a subscription', () => {
    expect(normalizeMerchant('GOOGLE PLAY').known).toBe(false);
    expect(normalizeMerchant('YOUTUBE ADS').known).toBe(false);
    expect(normalizeMerchant('VIVEK STORES').known).toBe(false);
  });

  it('keeps the first alias in table order when two names appear', () => {
    expect(key('NETFLIX AND SPOTIFY')).toBe('NETFLIX');
    expect(key('SPOTIFY AND NETFLIX')).toBe('NETFLIX');
  });
});

describe('normalizeMerchant: degenerate input', () => {
  it.each(['', '   ', '\n\t', 'UPI-', 'UPI/DR/', '---', '***', 'UPI-123456789', '412300104729', '@ybl', 'a@b', 'DR', 'NEFT CR'])(
    'returns an empty key for %j',
    (narration) => {
      expect(normalizeMerchant(narration)).toEqual({ key: '', display: '', category: 'other', known: false });
    },
  );

  it('ignores a lone letter or lone short number as the merchant', () => {
    expect(key('UPI-A-DEMO STORE')).toBe('DEMO STORE');
    expect(key('UPI-12345-DEMO STORE')).toBe('DEMO STORE');
  });

  it('never throws on odd text', () => {
    for (const text of ['\u0000', '😀 PIZZA', 'ΑΒΓ', '((((', '@@@@', 'UPI-\u200b-']) {
      expect(() => normalizeMerchant(text)).not.toThrow();
    }
  });
});

describe('normalizeMerchant: idempotence on the key', () => {
  const samples = [
    'NACH-NETFLIX COM-5942859575',
    'UPI-LANDLORD RAMESH-9876@oksbi-RENT',
    'TO TRANSFER-UPI/DR/412300209458/LANDLORD SURESH/SBIN/landlord@sbi/RENT',
    'UPI/412827310515/FRESH MILK DAIRY/freshmilk@ybl/YES BANK',
    'BY TRANSFER-NEFT*SBIN0000000*N412300104729*ACME TECH PVT LTD SALARY',
    'POS OPENAI *CHATGPT SUBSCR SAN FRANCISCO',
    'UPI-TATA 1MG-4455667788',
    'UPI-D MART-1234',
    'UPI-SOME LONG MERCHANT NAME HERE-123',
    '***corner, store.***',
    'ACH DMART STORES',
    '',
    // Found while fuzzing: a prefix behind leading punctuation, and a key made of short numbers.
    '+ACH D',
    '3 05/05/26 0 05/05/26 A',
    // P4 counterexamples: a start-anchored alias behind a meaningless segment, and a
    // month-like merchant word whose match changed when whitespace was collapsed.
    '12/CR/LINKEDIN+UPI-',
    '12  DECATHLON05-05-2026',
  ];

  it.each(samples)('normalising the key of %j returns the same key', (narration) => {
    const first = normalizeMerchant(narration);
    const second = normalizeMerchant(first.key);
    expect(second.key).toBe(first.key);
    expect(second.known).toBe(first.known);
    expect(second.display).toBe(first.display);
  });
});

describe('merchantAliases table', () => {
  it('has 23 aliases with unique canonical names', () => {
    expect(MERCHANT_ALIASES).toHaveLength(23);
    const names = MERCHANT_ALIASES.map((a) => a.canonical.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });

  it('every alias has at least one pattern and a category', () => {
    for (const alias of MERCHANT_ALIASES) {
      expect(alias.patterns.length).toBeGreaterThan(0);
      expect(alias.category).not.toBe('');
    }
  });

  it('every alias maps its own canonical name to itself (and not to another alias)', () => {
    for (const alias of MERCHANT_ALIASES) {
      const result = normalizeMerchant(alias.canonical);
      expect(result.display).toBe(alias.canonical);
      expect(result.key).toBe(alias.canonical.toUpperCase());
      expect(result.category).toBe(alias.category);
      expect(result.known).toBe(true);
    }
  });

  it('every alias key is a fixed point of normalizeMerchant', () => {
    for (const alias of MERCHANT_ALIASES) {
      const key = alias.canonical.toUpperCase();
      expect(normalizeMerchant(key).key).toBe(key);
    }
  });

  it('lists JioHotstar before Jio', () => {
    const names = MERCHANT_ALIASES.map((a) => a.canonical);
    expect(names.indexOf('JioHotstar')).toBeLessThan(names.indexOf('Jio'));
  });

  it('does not alias the non-subscription merchants in the fixtures', () => {
    const nonAliases = [
      'SWIGGY', 'ZOMATO', 'BIGBASKET', 'BLINKIT', 'AMAZON PAY', 'UBER INDIA', 'IRCTC', 'DECATHLON',
      'PHARMEASY', 'BESCOM ELECTRICITY', 'FRIEND ARJUN', 'LANDLORD RAMESH', 'HOUSE RENT', 'FRESH MILK DAIRY',
      'ATM WDL', 'ACME TECH PVT LTD', 'CREDIT INTEREST',
    ];
    for (const name of nonAliases) {
      expect(normalizeMerchant(`UPI-${name}-1234567@ybl`).known).toBe(false);
    }
  });
});

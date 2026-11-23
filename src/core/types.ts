/** Integer paise (rupees * 100). Never a float. */
export type Paise = number;

export interface Transaction {
  /** 'YYYY-MM-DD' */
  date: string;
  /** Raw narration text from the statement. */
  narration: string;
  /** Always positive; direction says whether it is a debit or a credit. */
  amount: Paise;
  direction: 'debit' | 'credit';
}

export type Cadence = 'weekly' | 'every28days' | 'monthly' | 'quarterly' | 'yearly';

export interface PriceChange {
  /** Last amount of the previous run of similar amounts. */
  from: Paise;
  /** The vampire's current amount. */
  to: Paise;
  direction: 'hike' | 'drop';
}

/** 'subscription' = merchant matched the alias table; 'other' = it did not. */
export type Tier = 'subscription' | 'other';

export interface Vampire {
  /** Display name. */
  merchant: string;
  /** Uppercase canonical string, e.g. 'NETFLIX'. */
  key: string;
  /** e.g. 'ott-video', 'music', 'fitness', 'cloud', 'telecom', 'other'. */
  category: string;
  tier: Tier;
  cadence: Cadence;
  /** Amount of the latest charge. Drives annualDrain, the card and the Blood Meter. */
  currentAmount: Paise;
  occurrences: number;
  /** 'YYYY-MM-DD' */
  lastChargeDate: string;
  /** 'YYYY-MM-DD' */
  nextExpectedDate: string;
  annualDrain: Paise;
  /** 0..1 */
  confidence: number;
  possiblyCancelled: boolean;
  priceChange?: PriceChange;
  /** 'YYYY-MM-DD' strings. */
  transactionDates: string[];
}

export type Decision = 'undecided' | 'keep' | 'stake' | 'dismiss';

export interface ParseResult {
  transactions: Transaction[];
  skippedRows: number;
  /** True if columns could not be detected. */
  needsMapping: boolean;
  /** For the column mapper. */
  headers?: string[];
  rawRows?: string[][];
}

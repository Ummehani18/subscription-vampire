import { detectRecurring } from '../core/detectRecurring';
import type { Decision, ParseResult, Transaction, Vampire } from '../core/types';
import type { UploadError } from './fileIntake';

export type Stage = 'upload' | 'mapping' | 'dashboard';

export interface MappingState {
  headers: string[];
  rawRows: string[][];
  /** True after the user applied a mapping that could not be used. */
  problem: boolean;
}

/** The single app state held by `useReducer` in App.tsx (design: UI components, State). */
export interface AppState {
  stage: Stage;
  /** A file is being read. */
  busy: boolean;
  uploadError: UploadError | null;
  mapping: MappingState | null;
  transactions: Transaction[];
  vampires: Vampire[];
  decisions: Record<string, Decision>;
  counted: ReadonlySet<string>;
  skippedRows: number;
}

/** Decisions the user can make on a card (Req 6). 'undecided' is reached through Undo. */
export type CardDecision = Exclude<Decision, 'undecided'>;

export type AppAction =
  | { type: 'readStarted' }
  | { type: 'fileRejected'; error: UploadError }
  | { type: 'statementParsed'; result: ParseResult }
  | { type: 'mappingApplied'; result: ParseResult }
  | { type: 'decide'; key: string; decision: CardDecision }
  | { type: 'count'; key: string }
  | { type: 'undo'; key: string }
  | { type: 'reset' };

export const initialState: AppState = {
  stage: 'upload',
  busy: false,
  uploadError: null,
  mapping: null,
  transactions: [],
  vampires: [],
  decisions: {},
  counted: new Set(),
  skippedRows: 0,
};

/** Analyses parsed transactions and moves to the dashboard with fresh decisions. */
function toDashboard(result: ParseResult): AppState {
  return {
    ...initialState,
    stage: 'dashboard',
    transactions: result.transactions,
    vampires: detectRecurring(result.transactions),
    counted: new Set(),
    skippedRows: result.skippedRows,
  };
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'readStarted':
      return { ...state, busy: true, uploadError: null };
    case 'fileRejected':
      return { ...initialState, uploadError: action.error, counted: new Set() };
    case 'statementParsed':
      if (action.result.needsMapping) {
        return {
          ...initialState,
          stage: 'mapping',
          counted: new Set(),
          mapping: { headers: action.result.headers ?? [], rawRows: action.result.rawRows ?? [], problem: false },
        };
      }
      return toDashboard(action.result);
    case 'mappingApplied':
      if (state.stage !== 'mapping' || state.mapping === null) return state;
      if (action.result.needsMapping) return { ...state, mapping: { ...state.mapping, problem: true } };
      return toDashboard(action.result);
    case 'decide': {
      const vampire = findVampire(state, action.key);
      if (!vampire) return state;
      // Uncounted Other recurring payments offer only "Count it" and "Dismiss" (Req 5.6).
      if (action.decision !== 'dismiss' && !isCountedTier(vampire, state.counted)) return state;
      return { ...state, decisions: { ...state.decisions, [action.key]: action.decision } };
    }
    case 'count': {
      const vampire = findVampire(state, action.key);
      if (!vampire || vampire.tier !== 'other' || state.counted.has(action.key)) return state;
      return { ...state, counted: new Set([...state.counted, action.key]) };
    }
    case 'undo': {
      const vampire = findVampire(state, action.key);
      if (!vampire) return state;
      // Undo steps back one change on the card: first the decision, then "Count it" (Req 6.4).
      if ((state.decisions[action.key] ?? 'undecided') !== 'undecided') {
        const { [action.key]: _removed, ...rest } = state.decisions;
        return { ...state, decisions: rest };
      }
      if (vampire.tier === 'other' && state.counted.has(action.key)) {
        const counted = new Set(state.counted);
        counted.delete(action.key);
        return { ...state, counted };
      }
      return state;
    }
    case 'reset':
      // "Clear all data" (Req 9.3): back to the initial state, with a fresh Set.
      return { ...initialState, counted: new Set() };
  }
}

function findVampire(state: AppState, key: string): Vampire | undefined {
  return state.stage === 'dashboard' ? state.vampires.find((v) => v.key === key) : undefined;
}

/** Subscriptions are always counted; Other recurring payments once the user clicks "Count it". */
export function isCountedTier(vampire: Vampire, counted: ReadonlySet<string>): boolean {
  return vampire.tier === 'subscription' || counted.has(vampire.key);
}

/** Whether Undo has something to step back on this card. */
export function canUndo(vampire: Vampire, decisions: Readonly<Record<string, Decision>>, counted: ReadonlySet<string>): boolean {
  return (decisions[vampire.key] ?? 'undecided') !== 'undecided' || (vampire.tier === 'other' && counted.has(vampire.key));
}

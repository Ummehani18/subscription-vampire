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

export type AppAction =
  | { type: 'readStarted' }
  | { type: 'fileRejected'; error: UploadError }
  | { type: 'statementParsed'; result: ParseResult }
  | { type: 'mappingApplied'; result: ParseResult };

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
  }
}

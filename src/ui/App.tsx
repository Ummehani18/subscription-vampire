import { useReducer } from 'react';
import { applyMapping, parseStatement, type ColumnMapping } from '../core/parseStatement';
import sampleStatement from '../../data/sample-statement.csv?raw';
import { appReducer, initialState } from './appState';
import ColumnMapper from './components/ColumnMapper';
import PrivacyBadge from './components/PrivacyBadge';
import SkippedRowsNotice from './components/SkippedRowsNotice';
import UploadZone from './components/UploadZone';
import { readStatementFile } from './fileIntake';

function BatIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 64 32" className="h-6 w-12 text-blood-bright" fill="currentColor">
      <path d="M32 10c-2 0-3-3-3-5-2 2-2 5-1 7-6-6-16-8-28-4 6 2 10 6 11 12 3-3 7-3 10 0 2-4 5-6 8-6s6 2 8 6c3-3 7-3 10 0 1-6 5-10 11-12-12-4-22-2-28 4 1-2 1-5-1-7 0 2-1 5-3 5Z" />
    </svg>
  );
}

export default function App() {
  const [state, dispatch] = useReducer(appReducer, initialState);

  const handleFile = async (file: File) => {
    dispatch({ type: 'readStarted' });
    const read = await readStatementFile(file);
    if (read.ok) dispatch({ type: 'statementParsed', result: parseStatement(read.text) });
    else dispatch({ type: 'fileRejected', error: read.error });
  };

  const handleSample = () => {
    // The sample is bundled into the app, so loading it makes no network request.
    dispatch({ type: 'statementParsed', result: parseStatement(sampleStatement) });
  };

  const handleMapping = (mapping: ColumnMapping) => {
    if (!state.mapping) return;
    dispatch({ type: 'mappingApplied', result: applyMapping(state.mapping.rawRows, state.mapping.headers, mapping) });
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-8 px-4 py-6 sm:px-6">
      <header className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <BatIcon />
          <div>
            <h1 className="font-heading text-3xl font-bold text-bone">Subscription Vampire</h1>
            <p className="text-sm text-muted">Find the recurring charges silently draining your account.</p>
          </div>
        </div>
        <PrivacyBadge />
      </header>

      <main className="flex flex-col gap-6">
        {state.stage === 'upload' && (
          <UploadZone onFile={handleFile} onSample={handleSample} busy={state.busy} error={state.uploadError} />
        )}

        {state.stage === 'mapping' && state.mapping && (
          <ColumnMapper
            headers={state.mapping.headers}
            rawRows={state.mapping.rawRows}
            problem={state.mapping.problem}
            onApply={handleMapping}
          />
        )}

        {state.stage === 'dashboard' && (
          // Placeholder until Task 8 (Dashboard) renders the Blood Meter and vampire list.
          <section aria-labelledby="dashboard-heading" className="flex flex-col gap-4">
            <h2 id="dashboard-heading" className="font-heading text-2xl text-bone">
              Statement read
            </h2>
            <SkippedRowsNotice count={state.skippedRows} />
            <p className="text-bone">
              {state.transactions.length} {state.transactions.length === 1 ? 'transaction' : 'transactions'} read,{' '}
              {state.vampires.length} recurring {state.vampires.length === 1 ? 'charge' : 'charges'} found.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}

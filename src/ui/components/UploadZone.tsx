import { useId, useState, type ChangeEvent, type DragEvent } from 'react';
import { UPLOAD_ERROR_MESSAGES, type UploadError } from '../fileIntake';

interface Props {
  onFile: (file: File) => void;
  onSample: () => void;
  busy: boolean;
  error: UploadError | null;
}

/** Drag and drop, a file picker, and "Try with sample data" (Req 1.1, 1.2, 1.6). */
export default function UploadZone({ onFile, onSample, busy, error }: Props) {
  const inputId = useId();
  const hintId = useId();
  const errorId = useId();
  const [dragging, setDragging] = useState(false);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Clear the value so choosing the same file again still fires a change.
    event.target.value = '';
    if (file) onFile(file);
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file && !busy) onFile(file);
  };

  return (
    <section aria-labelledby={`${inputId}-heading`} className="flex flex-col gap-4">
      <h2 id={`${inputId}-heading`} className="font-heading text-2xl text-bone">
        Upload a statement
      </h2>

      <label
        htmlFor={inputId}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed px-4 py-10 text-center transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-blood-bright ${
          dragging ? 'border-blood-bright bg-surface-2' : 'border-muted/60 bg-surface'
        }`}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-10 w-10 text-blood-bright" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 16V4m0 0-4 4m4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" strokeLinecap="round" />
        </svg>
        <span className="text-lg text-bone">Drop your bank statement CSV here</span>
        <span id={hintId} className="text-sm text-muted">
          or press Enter to choose a .csv file (up to 10 MB)
        </span>
        <span className="rounded-md border border-muted px-4 py-2 text-bone">Choose a CSV file</span>
        <input
          id={inputId}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={handleChange}
          disabled={busy}
          aria-describedby={error ? `${hintId} ${errorId}` : hintId}
          aria-invalid={error ? true : undefined}
        />
      </label>

      {error && (
        <p id={errorId} role="alert" className="rounded-md border border-blood-bright/60 bg-surface px-4 py-3 text-blood-bright">
          {UPLOAD_ERROR_MESSAGES[error]}
        </p>
      )}

      {busy && (
        <p role="status" className="text-muted">
          Reading your statement…
        </p>
      )}

      <div className="flex flex-col items-center gap-2">
        <span className="text-sm text-muted">No statement to hand?</span>
        <button
          type="button"
          onClick={onSample}
          disabled={busy}
          className="candle-glow rounded-md bg-blood px-5 py-2.5 font-semibold text-bone hover:brightness-110 disabled:opacity-60"
        >
          Try with sample data
        </button>
      </div>
    </section>
  );
}

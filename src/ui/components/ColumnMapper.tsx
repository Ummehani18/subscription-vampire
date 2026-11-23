import { useId, useState, type FormEvent } from 'react';
import { formatINR } from '../../core/amounts';
import type { ColumnMapping } from '../../core/parseStatement';
import { previewRows } from '../mappingPreview';

interface Props {
  headers: string[];
  rawRows: string[][];
  /** The last mapping applied could not be used. */
  problem: boolean;
  onApply: (mapping: ColumnMapping) => void;
}

const NOT_CHOSEN = -1;
const FIELDS = [
  { field: 'date', label: 'Date column' },
  { field: 'narration', label: 'Narration (description) column' },
  { field: 'amount', label: 'Amount column' },
] as const;

/**
 * Manual column mapping when the columns cannot be detected (Req 1.5): three
 * dropdowns, a "Flip sign" toggle, and a preview of how the first rows will read.
 */
export default function ColumnMapper({ headers, rawRows, problem, onApply }: Props) {
  const idPrefix = useId();
  const [mapping, setMapping] = useState<ColumnMapping>({
    date: NOT_CHOSEN,
    narration: NOT_CHOSEN,
    amount: NOT_CHOSEN,
    flipSign: false,
  });
  const [submitted, setSubmitted] = useState(false);

  const tooFewColumns = headers.length < 3;
  const preview = previewRows(rawRows, headers, mapping);
  const showProblem = problem || (submitted && preview === null);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (preview !== null) onApply(mapping);
  };

  return (
    <section aria-labelledby={`${idPrefix}-heading`} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h2 id={`${idPrefix}-heading`} className="font-heading text-2xl text-bone">
          Match your columns
        </h2>
        <p className="text-muted">
          We couldn't recognise this statement's columns. Pick which column holds each value.
        </p>
      </div>

      {tooFewColumns ? (
        <p role="alert" className="rounded-md border border-blood-bright/60 bg-surface px-4 py-3 text-blood-bright">
          This file has fewer than three columns, so it can't be read as a statement. Try exporting it again as a CSV.
        </p>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          {FIELDS.map(({ field, label }) => (
            <div key={field} className="flex flex-col gap-1">
              <label htmlFor={`${idPrefix}-${field}`} className="text-bone">
                {label}
              </label>
              <select
                id={`${idPrefix}-${field}`}
                value={mapping[field]}
                onChange={(event) => setMapping({ ...mapping, [field]: Number(event.target.value) })}
                className="w-full rounded-md border border-muted bg-surface-2 px-3 py-2 text-bone"
              >
                <option value={NOT_CHOSEN}>Choose a column</option>
                {headers.map((header, index) => (
                  <option key={index} value={index}>
                    {header || `Column ${index + 1}`}
                  </option>
                ))}
              </select>
            </div>
          ))}

          <div className="flex items-start gap-3">
            <input
              id={`${idPrefix}-flip`}
              type="checkbox"
              checked={mapping.flipSign}
              onChange={(event) => setMapping({ ...mapping, flipSign: event.target.checked })}
              aria-describedby={`${idPrefix}-flip-hint`}
              className="mt-1 h-5 w-5 accent-blood"
            />
            <div className="flex flex-col">
              <label htmlFor={`${idPrefix}-flip`} className="text-bone">
                Flip sign
              </label>
              <span id={`${idPrefix}-flip-hint`} className="text-sm text-muted">
                Normally a negative amount is money out. Turn this on if money out is shown as a positive number.
              </span>
            </div>
          </div>

          {showProblem && (
            <p role="alert" className="rounded-md border border-blood-bright/60 bg-surface px-4 py-3 text-blood-bright">
              Choose a different column for the date, the narration and the amount.
            </p>
          )}

          {preview !== null && preview.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-bone">Preview of the first rows</h3>
              <div className="overflow-x-auto rounded-md border border-surface-2">
                <table className="w-full min-w-[20rem] text-left text-sm">
                  <thead className="bg-surface-2 text-muted">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-medium">Date</th>
                      <th scope="col" className="px-3 py-2 font-medium">Narration</th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">Amount</th>
                      <th scope="col" className="px-3 py-2 font-medium">Read as</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map(({ raw, transaction }, index) => (
                      <tr key={index} className="border-t border-surface-2 bg-surface">
                        <td className="px-3 py-2 text-bone">{transaction?.date ?? raw[mapping.date] ?? ''}</td>
                        <td className="max-w-[12rem] break-words px-3 py-2 text-bone">{raw[mapping.narration] ?? ''}</td>
                        <td className="px-3 py-2 text-right text-bone">
                          {transaction ? formatINR(transaction.amount) : (raw[mapping.amount] ?? '')}
                        </td>
                        <td className={`px-3 py-2 ${transaction ? 'text-bone' : 'text-gold'}`}>
                          {transaction ? (transaction.direction === 'debit' ? 'Money out' : 'Money in') : 'Will be skipped'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <button
            type="submit"
            className="candle-glow self-start rounded-md bg-blood px-5 py-2.5 font-semibold text-bone hover:brightness-110"
          >
            Use these columns
          </button>
        </form>
      )}
    </section>
  );
}

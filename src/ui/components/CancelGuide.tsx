import { VERIFY_NOTE, guideFor } from '../../data/cancelGuides';
import { formatShortDate } from '../dashboardModel';

interface Props {
  merchant: string;
  id?: string;
}

/** Merchant steps with "last verified" (Req 7.1), or the generic steps (Req 7.2), always with the verify note (Req 7.3). */
export default function CancelGuide({ merchant, id }: Props) {
  const resolved = guideFor(merchant);
  const steps = resolved.kind === 'merchant' ? resolved.guide.steps : resolved.steps;

  return (
    <div id={id} className="flex flex-col gap-2 rounded-md border border-surface-2 bg-bg/60 p-3 text-sm">
      <ol className="list-decimal space-y-1 pl-5 text-bone">
        {steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      {resolved.kind === 'merchant' && (
        <p className="text-muted">
          Last verified: {formatShortDate(resolved.guide.lastVerified)}
          {resolved.guide.url && (
            <>
              {' · '}
              <a href={resolved.guide.url} target="_blank" rel="noopener noreferrer" className="text-bone underline underline-offset-2">
                {merchant} help page<span className="sr-only"> (opens in a new tab)</span>
              </a>
            </>
          )}
        </p>
      )}
      {resolved.kind === 'generic' && <p className="text-muted">General steps: we don't have a checked guide for this merchant.</p>}
      <p className="font-medium text-gold">{VERIFY_NOTE}.</p>
    </div>
  );
}

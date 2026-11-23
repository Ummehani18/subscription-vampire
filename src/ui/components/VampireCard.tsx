import { useState } from 'react';
import { formatINR } from '../../core/amounts';
import type { CardDecision } from '../appState';
import { CADENCE_LABELS, formatShortDate, type CardAction, type CardModel } from '../dashboardModel';
import CancelGuide from './CancelGuide';

interface Props {
  card: CardModel;
  onDecide: (key: string, decision: CardDecision) => void;
  onCount: (key: string) => void;
  onUndo: (key: string) => void;
}

const ACTION_LABELS: Readonly<Record<CardAction, string>> = {
  keep: 'Keep',
  stake: 'Stake it',
  dismiss: 'Dismiss',
  count: 'Count it',
};

const DECISION_LABELS = { keep: 'Kept', stake: 'Staked', dismiss: 'Dismissed' } as const;

function Badge({ text, tone }: { text: string; tone: 'gold' | 'garlic' | 'muted' | 'blood' }) {
  const tones = {
    gold: 'border-gold/60 text-gold',
    garlic: 'border-garlic/60 text-garlic',
    muted: 'border-muted/60 text-muted',
    blood: 'border-blood-bright/60 text-blood-bright',
  } as const;
  return <span className={`rounded-full border bg-bg px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>{text}</span>;
}

function FangIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6 shrink-0 text-blood-bright" fill="currentColor">
      <path d="M4 5h16c0 3-1 5-3 6l-1.5 7-2-6h-3l-2 6L7 11C5 10 4 8 4 5Z" />
    </svg>
  );
}

/** One vampire: amount, cadence, dates, text badges and the decision buttons (design: VampireCard). */
export default function VampireCard({ card, onDecide, onCount, onUndo }: Props) {
  const { vampire, decision } = card;
  const staked = decision === 'stake';
  const headingId = `vampire-${vampire.key.replace(/[^A-Z0-9]+/gi, '-')}`;
  const guideId = `${headingId}-guide`;
  const [guideOpen, setGuideOpen] = useState(false);

  return (
    <article
      aria-labelledby={headingId}
      className={`flex flex-col gap-3 rounded-xl border bg-surface p-4 ${staked ? 'border-garlic/70' : 'border-surface-2'}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <FangIcon />
          <h3 id={headingId} className={`text-lg font-semibold text-bone ${staked ? 'line-through decoration-garlic decoration-2' : ''}`}>
            {vampire.merchant}
          </h3>
        </div>
        <p className={`text-xl font-bold ${staked ? 'text-garlic line-through decoration-2' : 'text-bone'}`}>
          {formatINR(vampire.currentAmount)}
        </p>
      </div>

      <ul className="flex flex-wrap gap-2" aria-label="Details">
        <li>
          <Badge text={CADENCE_LABELS[vampire.cadence]} tone="muted" />
        </li>
        {vampire.priceChange && (
          <li>
            <Badge
              text={`${vampire.priceChange.direction === 'hike' ? 'Price hike' : 'Price drop'}: ${formatINR(vampire.priceChange.from)} → ${formatINR(vampire.priceChange.to)}`}
              tone={vampire.priceChange.direction === 'hike' ? 'gold' : 'garlic'}
            />
          </li>
        )}
        {card.duplicate && (
          <li>
            <Badge text="Possible duplicate" tone="gold" />
          </li>
        )}
        {vampire.possiblyCancelled && (
          <li>
            <Badge text="Possibly cancelled" tone="muted" />
          </li>
        )}
        {decision !== 'undecided' && (
          <li>
            <Badge text={DECISION_LABELS[decision]} tone={staked ? 'garlic' : 'muted'} />
          </li>
        )}
      </ul>

      <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-muted">A year</dt>
          <dd className="text-bone">{formatINR(vampire.annualDrain)}</dd>
        </div>
        <div>
          <dt className="text-muted">Last charge</dt>
          <dd className="text-bone">{formatShortDate(vampire.lastChargeDate)}</dd>
        </div>
        <div>
          <dt className="text-muted">Next expected</dt>
          <dd className="text-bone">{formatShortDate(vampire.nextExpectedDate)}</dd>
        </div>
      </dl>

      <div role="group" aria-label={`Decision for ${vampire.merchant}`} className="flex flex-wrap gap-2">
        {card.actions.map((action) => {
          const pressed = action !== 'count' && decision === action;
          const primary = action === 'stake' || action === 'count';
          return (
            <button
              key={action}
              type="button"
              aria-pressed={action === 'count' ? undefined : pressed}
              onClick={() => (action === 'count' ? onCount(vampire.key) : onDecide(vampire.key, action))}
              className={`rounded-md px-4 py-2 text-sm font-semibold ${
                primary ? 'bg-blood text-bone hover:brightness-110' : 'border border-muted text-bone hover:bg-surface-2'
              } ${pressed ? 'ring-2 ring-garlic' : ''}`}
            >
              {ACTION_LABELS[action]}
            </button>
          );
        })}
        {card.canUndo && (
          <button
            type="button"
            onClick={() => onUndo(vampire.key)}
            className="rounded-md px-4 py-2 text-sm font-semibold text-muted underline underline-offset-4 hover:text-bone"
          >
            Undo
          </button>
        )}
      </div>

      {staked ? (
        // Staked: the guide is expanded automatically (design: VampireCard).
        <section aria-labelledby={`${guideId}-heading`} className="flex flex-col gap-2">
          <h4 id={`${guideId}-heading`} className="font-semibold text-garlic">
            How to cancel
          </h4>
          <CancelGuide merchant={vampire.merchant} id={guideId} />
        </section>
      ) : (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            aria-expanded={guideOpen}
            aria-controls={guideId}
            onClick={() => setGuideOpen((open) => !open)}
            className="self-start text-sm font-semibold text-bone underline underline-offset-4 hover:text-blood-bright"
          >
            How to cancel
          </button>
          {guideOpen && <CancelGuide merchant={vampire.merchant} id={guideId} />}
        </div>
      )}
    </article>
  );
}

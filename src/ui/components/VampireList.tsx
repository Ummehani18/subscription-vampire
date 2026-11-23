import type { CardDecision } from '../appState';
import type { CardModel } from '../dashboardModel';
import VampireCard from './VampireCard';

interface Props {
  subscriptions: CardModel[];
  other: CardModel[];
  dismissed: CardModel[];
  onDecide: (key: string, decision: CardDecision) => void;
  onCount: (key: string) => void;
  onUndo: (key: string) => void;
}

/**
 * Subscriptions first, then "Other recurring payments (n)" and "Dismissed (n)",
 * both collapsed by default (Req 5.6, 6.3). Native <details> keeps the
 * collapsed sections keyboard-operable and announces their state.
 */
export default function VampireList({ subscriptions, other, dismissed, ...handlers }: Props) {
  const cards = (list: CardModel[]) => (
    <ul className="flex flex-col gap-3">
      {list.map((card) => (
        <li key={card.vampire.key}>
          <VampireCard card={card} {...handlers} />
        </li>
      ))}
    </ul>
  );

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="subscriptions-heading" className="flex flex-col gap-3">
        <h2 id="subscriptions-heading" className="font-heading text-2xl text-bone">
          Subscriptions ({subscriptions.length})
        </h2>
        {subscriptions.length > 0 ? cards(subscriptions) : <p className="text-muted">No subscriptions left to review.</p>}
      </section>

      {other.length > 0 && (
        <details className="group rounded-xl border border-surface-2 bg-bg/40 p-4">
          <summary className="cursor-pointer font-heading text-xl text-bone">Other recurring payments ({other.length})</summary>
          <p className="mt-2 text-sm text-muted">
            Regular payments that are not known subscriptions, such as rent. They are left out of the Blood Meter until you
            click "Count it".
          </p>
          <div className="mt-3">{cards(other)}</div>
        </details>
      )}

      {dismissed.length > 0 && (
        <details className="rounded-xl border border-surface-2 bg-bg/40 p-4">
          <summary className="cursor-pointer font-heading text-xl text-bone">Dismissed ({dismissed.length})</summary>
          <div className="mt-3">{cards(dismissed)}</div>
        </details>
      )}
    </div>
  );
}

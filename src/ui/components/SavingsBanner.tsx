import { formatINR } from '../../core/amounts';
import type { Paise } from '../../core/types';

interface Props {
  stakedCount: number;
  savedPerYear: Paise;
}

/** "You staked N vampires and saved ₹X a year" (design: SavingsBanner). Always shows "Saved per year" (Req 6.1). */
export default function SavingsBanner({ stakedCount, savedPerYear }: Props) {
  return (
    <section aria-label="Savings" aria-live="polite" className="rounded-xl border border-garlic/50 bg-surface px-5 py-4">
      <p className="text-bone">
        Saved per year: <strong className="text-garlic">{formatINR(savedPerYear)}</strong>
      </p>
      {stakedCount > 0 && (
        <p className="text-garlic">
          You staked {stakedCount} {stakedCount === 1 ? 'vampire' : 'vampires'} and saved {formatINR(savedPerYear)} a year.
        </p>
      )}
    </section>
  );
}

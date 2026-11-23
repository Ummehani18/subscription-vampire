import type { Decision, Vampire } from '../../core/types';
import type { CardDecision } from '../appState';
import { buildDashboard } from '../dashboardModel';
import BloodMeter from './BloodMeter';
import { hasStaked } from '../stakeList';
import EmptyState from './EmptyState';
import ExportButton from './ExportButton';
import SavingsBanner from './SavingsBanner';
import SkippedRowsNotice from './SkippedRowsNotice';
import VampireList from './VampireList';

interface Props {
  vampires: Vampire[];
  decisions: Readonly<Record<string, Decision>>;
  counted: ReadonlySet<string>;
  skippedRows: number;
  onDecide: (key: string, decision: CardDecision) => void;
  onCount: (key: string) => void;
  onUndo: (key: string) => void;
  onExport: () => void;
}

export default function Dashboard({ vampires, decisions, counted, skippedRows, onExport, ...handlers }: Props) {
  if (vampires.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <SkippedRowsNotice count={skippedRows} />
        <EmptyState />
      </div>
    );
  }

  const model = buildDashboard(vampires, decisions, counted);
  const { toReview } = model.totals;
  return (
    <div className="flex flex-col gap-6">
      <SkippedRowsNotice count={skippedRows} />
      <BloodMeter yearlyDrain={model.totals.yearlyDrain} monthlyDrain={model.totals.monthlyDrain} fill={model.meterFill} />
      <p aria-live="polite" className="text-bone">
        {toReview === 0
          ? 'Every vampire has been reviewed.'
          : `${toReview} ${toReview === 1 ? 'vampire is' : 'vampires are'} feeding on you and waiting for review.`}
      </p>
      <SavingsBanner stakedCount={model.stakedCount} savedPerYear={model.totals.savedPerYear} />
      <ExportButton disabled={!hasStaked(vampires, decisions)} onExport={onExport} />
      <VampireList subscriptions={model.subscriptions} other={model.other} dismissed={model.dismissed} {...handlers} />
    </div>
  );
}

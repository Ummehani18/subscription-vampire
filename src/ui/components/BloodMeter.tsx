import type { CSSProperties } from 'react';
import { formatINR } from '../../core/amounts';
import type { Paise } from '../../core/types';

interface Props {
  yearlyDrain: Paise;
  monthlyDrain: Paise;
  /** 0-1: the share of the drain still being paid; it drops as vampires are staked. */
  fill: number;
}

const RADIUS = 52;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Circular gauge of the yearly drain with the monthly equivalent (Req 5.1). The
 * numbers are visible text, and the gauge has its own label, so screen readers
 * get both. The fill animates on load and on change; prefers-reduced-motion
 * turns that off (index.css).
 */
export default function BloodMeter({ yearlyDrain, monthlyDrain, fill }: Props) {
  const clamped = Math.min(1, Math.max(0, fill));
  const percent = Math.round(clamped * 100);
  const offset = CIRCUMFERENCE * (1 - clamped);

  return (
    <section aria-labelledby="blood-meter-heading" className="flex flex-col items-center gap-4 rounded-xl bg-surface p-6 sm:flex-row sm:gap-8">
      <svg
        viewBox="0 0 120 120"
        className="h-36 w-36 shrink-0 -rotate-90"
        role="img"
        aria-label={`Blood Meter ${percent}% full: ${formatINR(yearlyDrain)} a year is still being drained.`}
      >
        <circle cx="60" cy="60" r={RADIUS} fill="none" stroke="var(--surface-2)" strokeWidth="12" />
        <circle
          cx="60"
          cy="60"
          r={RADIUS}
          fill="none"
          stroke="var(--blood)"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          className="blood-meter-fill"
          style={{ '--meter-empty': `${CIRCUMFERENCE}` } as CSSProperties}
        />
      </svg>
      <div className="flex flex-col items-center gap-1 text-center sm:items-start sm:text-left">
        <h2 id="blood-meter-heading" className="font-heading text-xl text-bone">
          Blood Meter
        </h2>
        <p className="text-3xl font-bold text-bone">
          {formatINR(yearlyDrain)} <span className="text-base font-normal text-muted">a year</span>
        </p>
        <p className="text-bone">
          {formatINR(monthlyDrain)} <span className="text-muted">a month</span>
        </p>
      </div>
    </section>
  );
}

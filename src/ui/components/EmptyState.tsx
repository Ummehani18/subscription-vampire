/** Shown when no vampire of either tier was detected (Req 5.5). */
export default function EmptyState() {
  return (
    <section aria-labelledby="empty-heading" className="flex flex-col items-center gap-3 rounded-xl bg-surface px-6 py-10 text-center">
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-10 w-10 text-garlic" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 3c3 3 6 4 8 4 0 7-3 12-8 14-5-2-8-7-8-14 2 0 5-1 8-4Z" strokeLinejoin="round" />
        <path d="m9 12 2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <h2 id="empty-heading" className="font-heading text-2xl text-bone">
        No vampires found
      </h2>
      <p className="max-w-md text-muted">
        We didn't find any recurring charges in this statement. Nothing is feeding on you here.
      </p>
    </section>
  );
}

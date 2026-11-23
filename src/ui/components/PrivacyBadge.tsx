/** Shown on every screen (Req 9.2). */
export default function PrivacyBadge() {
  return (
    <p className="inline-flex items-center gap-2 rounded-full border border-garlic/40 bg-surface px-3 py-1 text-sm text-garlic">
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="5" y="11" width="14" height="10" rx="2" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </svg>
      Your statement never leaves this browser.
    </p>
  );
}

interface Props {
  count: number;
}

/** "N rows skipped" after parsing (Req 2.3). Renders nothing when no row was skipped. */
export default function SkippedRowsNotice({ count }: Props) {
  if (count <= 0) return null;
  return (
    <p role="status" className="rounded-md border border-gold/50 bg-surface px-4 py-3 text-sm text-gold">
      {count} {count === 1 ? 'row' : 'rows'} skipped because the date or amount could not be read.
    </p>
  );
}

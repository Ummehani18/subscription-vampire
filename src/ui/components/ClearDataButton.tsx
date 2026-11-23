interface Props {
  onClear: () => void;
}

/** "Clear all data": back to the upload screen with nothing kept (Req 9.3). */
export default function ClearDataButton({ onClear }: Props) {
  return (
    <button
      type="button"
      onClick={onClear}
      className="self-start rounded-md border border-blood-bright/70 px-4 py-2 font-semibold text-blood-bright hover:bg-surface-2"
    >
      Clear all data
    </button>
  );
}

import { useId } from 'react';

interface Props {
  disabled: boolean;
  onExport: () => void;
}

/** "Export Stake List", disabled until a vampire is staked (Req 8). */
export default function ExportButton({ disabled, onExport }: Props) {
  const hintId = useId();
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={onExport}
        disabled={disabled}
        aria-describedby={hintId}
        className="self-start rounded-md border border-garlic px-4 py-2 font-semibold text-garlic hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        Export Stake List
      </button>
      <span id={hintId} className="text-sm text-muted">
        {disabled
          ? 'Stake a vampire to export your Stake List.'
          : 'Downloads stake-list.md to this device. Nothing is uploaded.'}
      </span>
    </div>
  );
}

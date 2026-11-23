/** Browser hooks used for a download, passed in so this module can be tested without a DOM. */
export interface DownloadDeps {
  createObjectURL: (blob: Blob) => string;
  /** Starts the download of `url` saved as `filename`. */
  click: (url: string, filename: string) => void;
}

/** Saves `text` as a local file through an object URL. Returns the URL so it can be revoked later. */
export function downloadText(text: string, filename: string, type: string, deps: DownloadDeps): string {
  const url = deps.createObjectURL(new Blob([text], { type }));
  deps.click(url, filename);
  return url;
}

/** Revokes every object URL (Req 9.3 "Clear all data"). */
export function revokeAll(urls: readonly string[], revoke: (url: string) => void): void {
  for (const url of urls) revoke(url);
}

/** The real browser implementation of DownloadDeps. */
export const browserDownloadDeps: DownloadDeps = {
  createObjectURL: (blob) => URL.createObjectURL(blob),
  click: (url, filename) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    document.body.append(link);
    link.click();
    link.remove();
  },
};

/** Today's local date as 'YYYY-MM-DD', for the export heading. */
export function todayIso(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

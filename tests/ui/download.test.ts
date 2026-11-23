import { describe, expect, it, vi } from 'vitest';
import { downloadText, revokeAll, todayIso, type DownloadDeps } from '../../src/ui/download';

describe('downloadText', () => {
  it('creates a Blob with the text and type, starts the download, and returns the object URL', async () => {
    let created: Blob | undefined;
    const deps: DownloadDeps = {
      createObjectURL: vi.fn((blob: Blob) => {
        created = blob;
        return 'blob:local/1';
      }),
      click: vi.fn(),
    };
    const url = downloadText('# Stake List\n', 'stake-list.md', 'text/markdown;charset=utf-8', deps);
    expect(url).toBe('blob:local/1');
    expect(deps.click).toHaveBeenCalledWith('blob:local/1', 'stake-list.md');
    expect(created?.type).toBe('text/markdown;charset=utf-8');
    expect(await created?.text()).toBe('# Stake List\n');
  });
});

describe('revokeAll', () => {
  it('revokes every URL', () => {
    const revoke = vi.fn();
    revokeAll(['blob:a', 'blob:b'], revoke);
    expect(revoke.mock.calls).toEqual([['blob:a'], ['blob:b']]);
  });

  it('does nothing for no URLs', () => {
    const revoke = vi.fn();
    revokeAll([], revoke);
    expect(revoke).not.toHaveBeenCalled();
  });
});

describe('todayIso', () => {
  it('formats a local date as YYYY-MM-DD', () => {
    expect(todayIso(new Date(2026, 10, 22, 23, 30))).toBe('2026-11-22');
    expect(todayIso(new Date(2027, 0, 5))).toBe('2027-01-05');
  });
});

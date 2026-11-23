import { describe, expect, it, vi } from 'vitest';
import { MAX_FILE_BYTES } from '../../src/core/parseStatement';
import { UPLOAD_ERROR_MESSAGES, readStatementFile, type StatementFile } from '../../src/ui/fileIntake';

/** A stand-in for a browser File; `text` is a spy so tests can check whether it was read. */
function fakeFile(name: string, content: string, size = new TextEncoder().encode(content).length) {
  const text = vi.fn(async () => content);
  const file: StatementFile = { name, size, text };
  return { file, text };
}

const CSV = 'Date,Narration,Debit\n05/05/26,NETFLIX,649.00\n';

describe('readStatementFile: accepted files', () => {
  it('reads a .csv file and returns its text', async () => {
    const { file, text } = fakeFile('statement.csv', CSV);
    expect(await readStatementFile(file)).toEqual({ ok: true, text: CSV });
    expect(text).toHaveBeenCalledTimes(1);
  });

  it('accepts an upper-case extension and a file of exactly 10 MB', async () => {
    expect((await readStatementFile(fakeFile('STATEMENT.CSV', CSV).file)).ok).toBe(true);
    expect((await readStatementFile(fakeFile('big.csv', CSV, MAX_FILE_BYTES).file)).ok).toBe(true);
  });
});

describe('readStatementFile: rejected files (Req 1.2)', () => {
  it('rejects a non-CSV file without reading it', async () => {
    const { file, text } = fakeFile('statement.pdf', CSV);
    expect(await readStatementFile(file)).toEqual({ ok: false, error: 'not-csv' });
    expect(text).not.toHaveBeenCalled();
  });

  it('rejects an 11 MB file without reading it', async () => {
    const { file, text } = fakeFile('statement.csv', CSV, 11 * 1024 * 1024);
    expect(await readStatementFile(file)).toEqual({ ok: false, error: 'too-large' });
    expect(text).not.toHaveBeenCalled();
  });

  it('rejects a 0-byte file without reading it', async () => {
    const { file, text } = fakeFile('statement.csv', '', 0);
    expect(await readStatementFile(file)).toEqual({ ok: false, error: 'empty' });
    expect(text).not.toHaveBeenCalled();
  });

  it('rejects a file that only holds whitespace or a BOM, after reading it', async () => {
    const blank = fakeFile('statement.csv', '  \r\n\t ');
    expect(await readStatementFile(blank.file)).toEqual({ ok: false, error: 'empty' });
    expect(blank.text).toHaveBeenCalledTimes(1);
    expect(await readStatementFile(fakeFile('statement.csv', '\uFEFF').file)).toEqual({ ok: false, error: 'empty' });
  });

  it('reports an unreadable file instead of throwing', async () => {
    const file: StatementFile = { name: 'statement.csv', size: 10, text: () => Promise.reject(new Error('denied')) };
    await expect(readStatementFile(file)).resolves.toEqual({ ok: false, error: 'unreadable' });
  });

  it('has a clear message for every error', () => {
    expect(Object.keys(UPLOAD_ERROR_MESSAGES).sort()).toEqual(['empty', 'not-csv', 'too-large', 'unreadable']);
    expect(UPLOAD_ERROR_MESSAGES['not-csv']).toMatch(/isn't a CSV/);
    expect(UPLOAD_ERROR_MESSAGES.empty).toMatch(/empty/);
    expect(UPLOAD_ERROR_MESSAGES['too-large']).toMatch(/10 MB/);
  });
});

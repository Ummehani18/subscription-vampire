import { validateFile, type FileValidationError } from '../core/parseStatement';

/** Why an uploaded file was not accepted. */
export type UploadError = FileValidationError | 'unreadable';

/** The parts of a browser `File` this module needs, so it can be tested without a DOM. */
export interface StatementFile {
  name: string;
  size: number;
  text(): Promise<string>;
}

export type ReadResult = { ok: true; text: string } | { ok: false; error: UploadError };

export const UPLOAD_ERROR_MESSAGES: Readonly<Record<UploadError, string>> = {
  'not-csv': "That file isn't a CSV. Export your statement as a .csv file and try again.",
  empty: 'That file is empty. Choose a statement that has transactions in it.',
  'too-large': 'That file is larger than 10 MB. Export a shorter date range and try again.',
  unreadable: "That file couldn't be read. Try exporting it again.",
};

/**
 * Validates and reads a statement file locally (Req 1.1, 1.2). The name and size
 * are checked before anything is read, so a non-CSV or oversized file is never
 * loaded into memory. Never throws.
 */
export async function readStatementFile(file: StatementFile): Promise<ReadResult> {
  // With no text yet, validateFile reports 'empty' for any file that passes the name
  // and size checks; a non-zero size means the content still has to be read.
  const precheck = validateFile(file.name, file.size, '');
  if (precheck !== null && !(precheck === 'empty' && file.size > 0)) return { ok: false, error: precheck };

  let text: string;
  try {
    text = await file.text();
  } catch {
    return { ok: false, error: 'unreadable' };
  }
  const error = validateFile(file.name, file.size, text);
  return error === null ? { ok: true, text } : { ok: false, error };
}

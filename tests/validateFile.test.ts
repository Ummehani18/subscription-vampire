import { describe, expect, it } from 'vitest';
import { MAX_FILE_BYTES, parseStatement, validateFile } from '../src/core/parseStatement';

const CSV = 'Date,Narration,Debit\n05/05/26,NETFLIX,649.00\n';

describe('validateFile: accepted files', () => {
  it('accepts a normal .csv file', () => {
    expect(validateFile('statement.csv', CSV.length, CSV)).toBeNull();
  });

  it('matches the extension case-insensitively and ignores surrounding spaces in the name', () => {
    expect(validateFile('STATEMENT.CSV', CSV.length, CSV)).toBeNull();
    expect(validateFile('Statement.Csv', CSV.length, CSV)).toBeNull();
    expect(validateFile('  statement.csv  ', CSV.length, CSV)).toBeNull();
  });

  it('accepts names with extra dots, spaces and parentheses', () => {
    expect(validateFile('hdfc.may.2026 (1).csv', CSV.length, CSV)).toBeNull();
  });

  it('accepts a file of exactly 10 MB', () => {
    expect(MAX_FILE_BYTES).toBe(10 * 1024 * 1024);
    expect(validateFile('a.csv', MAX_FILE_BYTES, CSV)).toBeNull();
  });

  it('accepts content that is not a valid statement (parsing handles that)', () => {
    expect(validateFile('notes.csv', 5, 'hello')).toBeNull();
  });

  it('accepts a file that starts with a BOM and has content', () => {
    expect(validateFile('a.csv', CSV.length + 3, `\uFEFF${CSV}`)).toBeNull();
  });
});

describe('validateFile: not-csv', () => {
  it.each([
    'statement.txt',
    'statement.xls',
    'statement.xlsx',
    'statement.pdf',
    'statement.csv.txt',
    'statement.csvx',
    'statement',
    'csv',
    '.csvfile',
    'statement.csv.',
    '',
  ])('rejects the name %j', (name) => {
    expect(validateFile(name, CSV.length, CSV)).toBe('not-csv');
  });

  it('accepts a file whose whole name is just the extension', () => {
    expect(validateFile('.csv', CSV.length, CSV)).toBeNull();
  });

  it('reports not-csv before empty and before too-large', () => {
    expect(validateFile('a.txt', 0, '')).toBe('not-csv');
    expect(validateFile('a.pdf', MAX_FILE_BYTES + 1, CSV)).toBe('not-csv');
  });
});

describe('validateFile: empty', () => {
  it('rejects zero-length content', () => {
    expect(validateFile('a.csv', 0, '')).toBe('empty');
  });

  it('rejects whitespace-only content', () => {
    expect(validateFile('a.csv', 4, '  \n\t')).toBe('empty');
    expect(validateFile('a.csv', 4, '\r\n\r\n')).toBe('empty');
  });

  it('rejects a BOM-only file', () => {
    expect(validateFile('a.csv', 3, '\uFEFF')).toBe('empty');
    expect(validateFile('a.csv', 5, '\uFEFF \n')).toBe('empty');
  });

  it('rejects size 0 even if text was somehow passed', () => {
    expect(validateFile('a.csv', 0, CSV)).toBe('empty');
  });

  it('does not call a header-only file empty', () => {
    expect(validateFile('a.csv', 30, 'Date,Narration,Debit')).toBeNull();
  });
});

describe('validateFile: too-large', () => {
  it('rejects a file one byte over 10 MB', () => {
    expect(validateFile('a.csv', MAX_FILE_BYTES + 1, CSV)).toBe('too-large');
  });

  it('rejects much larger files', () => {
    expect(validateFile('a.csv', 11 * 1024 * 1024, CSV)).toBe('too-large');
    expect(validateFile('a.csv', Number.MAX_SAFE_INTEGER, CSV)).toBe('too-large');
  });

  it('decides on the reported size without needing the text', () => {
    expect(validateFile('a.csv', MAX_FILE_BYTES + 1, '')).toBe('too-large');
  });

  it('reports too-large before empty', () => {
    expect(validateFile('a.csv', MAX_FILE_BYTES + 1, '   ')).toBe('too-large');
  });
});

describe('validateFile: before parsing', () => {
  it('lets valid files through to parseStatement', () => {
    expect(validateFile('a.csv', CSV.length, CSV)).toBeNull();
    expect(parseStatement(CSV).transactions).toHaveLength(1);
  });

  it('never throws', () => {
    expect(() => validateFile('', Number.NaN, '')).not.toThrow();
    expect(() => validateFile('a.csv', -1, '\u0000')).not.toThrow();
  });
});

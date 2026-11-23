import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import App from '../../src/ui/App';
import ColumnMapper from '../../src/ui/components/ColumnMapper';
import PrivacyBadge from '../../src/ui/components/PrivacyBadge';
import SkippedRowsNotice from '../../src/ui/components/SkippedRowsNotice';
import UploadZone from '../../src/ui/components/UploadZone';
import { UPLOAD_ERROR_MESSAGES } from '../../src/ui/fileIntake';

// Static rendering only: these check markup, text and accessibility attributes.
// Clicks, drag and drop and keyboard use need a browser (see the Task 7 manual checklist).
const noop = () => undefined;
const render = (element: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(element);

describe('App shell (7.1)', () => {
  const html = render(createElement(App));

  it('starts on the upload screen with the title and the privacy badge', () => {
    expect(html).toContain('<h1');
    expect(html).toContain('Subscription Vampire');
    expect(html).toContain('Your statement never leaves this browser.');
    expect(html).toContain('Drop your bank statement CSV here');
  });

  it('uses header and main landmarks', () => {
    expect(html).toContain('<header');
    expect(html).toContain('<main');
  });

  it('hides decorative icons from screen readers', () => {
    const svgs = html.match(/<svg[^>]*>/g) ?? [];
    expect(svgs.length).toBeGreaterThan(0);
    for (const svg of svgs) expect(svg).toContain('aria-hidden="true"');
  });
});

describe('PrivacyBadge (7.1)', () => {
  it('shows the privacy promise as text', () => {
    expect(render(createElement(PrivacyBadge))).toContain('Your statement never leaves this browser.');
  });
});

describe('UploadZone (7.2)', () => {
  const props = { onFile: noop, onSample: noop, busy: false, error: null };

  it('has a labelled, keyboard-focusable CSV file input and a sample-data button', () => {
    const html = render(createElement(UploadZone, props));
    const input = html.match(/<input[^>]*>/)?.[0] ?? '';
    expect(input).toContain('type="file"');
    expect(input).toContain('accept=".csv,text/csv"');
    expect(input).not.toContain('tabindex="-1"');
    const id = /id="([^"]+)"/.exec(input)?.[1];
    expect(html).toContain(`for="${id}"`);
    expect(html).toMatch(/<button type="button"[^>]*>Try with sample data<\/button>/);
  });

  it.each(['not-csv', 'empty', 'too-large', 'unreadable'] as const)('shows the %s error as an alert linked to the input', (error) => {
    const html = render(createElement(UploadZone, { ...props, error }));
    const alert = /<p id="([^"]+)" role="alert"[^>]*>([^<]*)<\/p>/.exec(html);
    expect(alert?.[2]).toBe(UPLOAD_ERROR_MESSAGES[error].replace("'", '&#x27;'));
    const input = html.match(/<input[^>]*>/)?.[0] ?? '';
    expect(input).toContain('aria-invalid="true"');
    expect(input).toContain(alert?.[1]);
  });

  it('shows no alert without an error', () => {
    expect(render(createElement(UploadZone, props))).not.toContain('role="alert"');
  });

  it('shows a reading status and disables the controls while busy', () => {
    const html = render(createElement(UploadZone, { ...props, busy: true }));
    expect(html).toContain('Reading your statement');
    expect(html.match(/<input[^>]*>/)?.[0]).toContain('disabled');
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Try with sample data/);
  });
});

describe('SkippedRowsNotice (7.2)', () => {
  it('shows "N rows skipped" as a status message', () => {
    const html = render(createElement(SkippedRowsNotice, { count: 3 }));
    expect(html).toContain('role="status"');
    expect(html).toContain('3 rows skipped');
  });

  it('uses the singular for one row', () => {
    expect(render(createElement(SkippedRowsNotice, { count: 1 }))).toContain('1 row skipped');
  });

  it('renders nothing when no row was skipped', () => {
    expect(render(createElement(SkippedRowsNotice, { count: 0 }))).toBe('');
  });
});

describe('ColumnMapper (7.3)', () => {
  const headers = ['Posting Date', 'Details', 'Amount', ''];
  const rawRows = [['05/05/2026', 'NETFLIX', '649.00', 'x']];
  const props = { headers, rawRows, problem: false, onApply: noop };

  it('has three labelled dropdowns listing every column, plus a "Choose a column" default', () => {
    const html = render(createElement(ColumnMapper, props));
    const selects = html.match(/<select[^>]*>/g) ?? [];
    expect(selects).toHaveLength(3);
    for (const select of selects) {
      const id = /id="([^"]+)"/.exec(select)?.[1];
      expect(html).toContain(`for="${id}"`);
    }
    for (const label of ['Date column', 'Narration (description) column', 'Amount column']) expect(html).toContain(label);
    expect(html.match(/Choose a column/g)).toHaveLength(3);
    expect(html).toContain('>Posting Date</option>');
    expect(html).toContain('>Column 4</option>'); // blank header gets a name
  });

  it('has a labelled "Flip sign" checkbox with an explanation', () => {
    const html = render(createElement(ColumnMapper, props));
    const checkbox = html.match(/<input[^>]*type="checkbox"[^>]*>/)?.[0] ?? '';
    const id = /id="([^"]+)"/.exec(checkbox)?.[1];
    expect(html).toMatch(new RegExp(`<label for="${id}"[^>]*>Flip sign</label>`));
    expect(checkbox).toContain('aria-describedby');
    expect(html).toContain('money out is shown as a positive number');
  });

  it('shows an alert when the last mapping could not be used', () => {
    expect(render(createElement(ColumnMapper, { ...props, problem: true }))).toContain('role="alert"');
    expect(render(createElement(ColumnMapper, props))).not.toContain('role="alert"');
  });

  it('explains when a file has fewer than three columns and offers no form', () => {
    const html = render(createElement(ColumnMapper, { ...props, headers: ['A', 'B'] }));
    expect(html).toContain('fewer than three columns');
    expect(html).not.toContain('<select');
  });
});

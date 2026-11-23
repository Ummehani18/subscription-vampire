import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { detectRecurring } from '../../src/core/detectRecurring';
import { parseStatement } from '../../src/core/parseStatement';
import type { Decision, Vampire } from '../../src/core/types';
import { CANCEL_GUIDES, VERIFY_NOTE, genericGuide } from '../../src/data/cancelGuides';
import { appReducer, initialState, type AppState } from '../../src/ui/appState';
import CancelGuide from '../../src/ui/components/CancelGuide';
import ClearDataButton from '../../src/ui/components/ClearDataButton';
import Dashboard from '../../src/ui/components/Dashboard';
import ExportButton from '../../src/ui/components/ExportButton';

// Static rendering: markup and accessibility attributes. Opening the toggle,
// downloading and clearing need a browser (see the Task 9 manual checklist).
const SAMPLE_TEXT = readFileSync(new URL('../../data/sample-statement.csv', import.meta.url), 'utf8');
const SAMPLE = detectRecurring(parseStatement(SAMPLE_TEXT).transactions);
const noop = () => undefined;

function renderDashboard(vampires: Vampire[], decisions: Record<string, Decision> = {}, counted = new Set<string>()) {
  return renderToStaticMarkup(
    createElement(Dashboard, { vampires, decisions, counted, skippedRows: 0, onDecide: noop, onCount: noop, onUndo: noop, onExport: noop }),
  );
}
const card = (html: string, merchant: string) =>
  (html.match(/<article[\s\S]*?<\/article>/g) ?? []).find((a) => a.includes(`>${merchant}</h3>`)) ?? '';
const decode = (html: string) => html.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&');

describe('CancelGuide (9.1)', () => {
  it('shows the verified steps, the last-verified date, a help-page link and the verify note for a known merchant', () => {
    const html = decode(renderToStaticMarkup(createElement(CancelGuide, { merchant: 'Netflix' })));
    for (const step of CANCEL_GUIDES.Netflix?.steps ?? []) expect(html).toContain(step);
    expect(html).toContain('Last verified: 22 Nov 2026');
    expect(html).toContain(`href="${CANCEL_GUIDES.Netflix?.url}"`);
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('(opens in a new tab)');
    expect(html).toContain(`${VERIFY_NOTE}.`);
  });

  it('shows the generic steps and the verify note for an unknown merchant, without a verified date', () => {
    const html = decode(renderToStaticMarkup(createElement(CancelGuide, { merchant: 'Landlord Ramesh' })));
    for (const step of genericGuide.steps) expect(html).toContain(step);
    expect(html).not.toContain('Last verified');
    expect(html).toContain(`${VERIFY_NOTE}.`);
  });

  it('uses an ordered list for the steps', () => {
    expect(renderToStaticMarkup(createElement(CancelGuide, { merchant: 'Spotify' }))).toMatch(/<ol[^>]*>(<li>[^<]+<\/li>)+<\/ol>/);
  });
});

describe('"How to cancel" on VampireCard (deferred from Task 8)', () => {
  it('unstaked cards have a collapsed "How to cancel" toggle that controls the guide', () => {
    const netflix = card(renderDashboard(SAMPLE), 'Netflix');
    const button = /<button type="button" aria-expanded="false" aria-controls="([^"]+)"[^>]*>How to cancel<\/button>/.exec(netflix);
    expect(button).not.toBeNull();
    expect(netflix).not.toContain(`id="${button?.[1]}"`); // guide hidden until opened
    expect(netflix).not.toContain(CANCEL_GUIDES.Netflix?.steps[0]);
  });

  it('a staked card shows the guide expanded, with no toggle', () => {
    const netflix = decode(card(renderDashboard(SAMPLE, { NETFLIX: 'stake' }), 'Netflix'));
    expect(netflix).not.toContain('aria-expanded');
    expect(netflix).toMatch(/<h4[^>]*>How to cancel<\/h4>/);
    for (const step of CANCEL_GUIDES.Netflix?.steps ?? []) expect(netflix).toContain(step);
    expect(netflix).toContain('Last verified: 22 Nov 2026');
    expect(netflix).toContain(VERIFY_NOTE);
  });

  it('a staked merchant without a verified guide shows the generic steps', () => {
    const html = decode(renderDashboard(SAMPLE, { JIO: 'stake' }));
    for (const step of genericGuide.steps) expect(card(html, 'Jio')).toContain(step);
  });

  it('every card, including Other recurring and dismissed cards, has a guide or a toggle', () => {
    const html = renderDashboard(SAMPLE, { NETFLIX: 'dismiss' });
    expect(card(html, 'Landlord Ramesh')).toContain('>How to cancel</button>');
    expect(card(html, 'Netflix')).toContain('>How to cancel</button>');
  });
});

describe('Export Stake List button (9.2)', () => {
  it('is disabled with an explanation when nothing is staked', () => {
    const html = renderDashboard(SAMPLE);
    expect(html).toMatch(/<button type="button" disabled=""[^>]*>Export Stake List<\/button>/);
    expect(html).toContain('Stake a vampire to export your Stake List.');
  });

  it('is enabled once a vampire is staked', () => {
    const html = renderDashboard(SAMPLE, { NETFLIX: 'stake' });
    const button = /<button[^>]*>Export Stake List<\/button>/.exec(html)?.[0] ?? '';
    expect(button).not.toBe('');
    expect(button).not.toContain('disabled=""');
    expect(html).toContain('Downloads stake-list.md to this device. Nothing is uploaded.');
  });

  it('links the button to its explanation', () => {
    const html = renderToStaticMarkup(createElement(ExportButton, { disabled: true, onExport: noop }));
    const describedBy = /aria-describedby="([^"]+)"/.exec(html)?.[1];
    expect(html).toContain(`id="${describedBy}"`);
  });

  it('is not shown on the empty state, where nothing can be staked', () => {
    expect(renderDashboard([])).not.toContain('Export Stake List');
  });
});

describe('Clear all data (9.2, Req 9.3)', () => {
  it('renders a "Clear all data" button', () => {
    expect(renderToStaticMarkup(createElement(ClearDataButton, { onClear: noop }))).toMatch(
      /<button type="button"[^>]*>Clear all data<\/button>/,
    );
  });

  it('reset returns to the upload screen with the initial state and nothing kept', () => {
    const loaded = [
      { type: 'statementParsed', result: parseStatement(SAMPLE_TEXT) },
      { type: 'count', key: 'LANDLORD RAMESH' },
      { type: 'decide', key: 'NETFLIX', decision: 'stake' },
    ] as const;
    const dashboard = loaded.reduce<AppState>((s, a) => appReducer(s, a), initialState);
    expect(dashboard.vampires.length).toBeGreaterThan(0);
    const cleared = appReducer(dashboard, { type: 'reset' });
    expect({ ...cleared, counted: [...cleared.counted] }).toEqual({ ...initialState, counted: [] });
    expect(cleared.counted).not.toBe(dashboard.counted);
  });

  it('reset also leaves the mapper', () => {
    const csv = ['Posting Date,Narration,Debit', '05/05/26,NETFLIX,649.00'].join('\n');
    const mapping = appReducer(initialState, { type: 'statementParsed', result: parseStatement(csv) });
    expect(mapping.stage).toBe('mapping');
    expect(appReducer(mapping, { type: 'reset' }).stage).toBe('upload');
  });

  it('App wires "Clear all data" to revoke export URLs and reset', () => {
    // Static check of the wiring, since clicking needs a browser.
    const app = readFileSync(new URL('../../src/ui/App.tsx', import.meta.url), 'utf8');
    const handleClear = /const handleClear = \(\) => {([\s\S]*?)\n  };/.exec(app)?.[1] ?? '';
    expect(handleClear).toContain('revokeAll(exportUrls.current, (url) => URL.revokeObjectURL(url))');
    expect(handleClear).toContain("dispatch({ type: 'reset' })");
    expect(app).toContain("{state.stage !== 'upload' && <ClearDataButton onClear={handleClear} />}");
  });
});

# Subscription Vampire

> Find the recurring charges silently draining your bank account.

Upload a bank statement CSV, see every subscription "vampire" feeding on you in a Blood Meter, and stake the ones you don't need. **Your statement never leaves your browser.**

Built for Kiroween 2026 with Kiro (specs, steering, property-based testing).

**Live demo:** _not deployed yet (add the Vercel or Netlify URL here after deploying)._

## What it does
- **Upload** a bank statement CSV (up to 10 MB), or click **Try with sample data** for a bundled synthetic statement.
- **Reads Indian bank exports:** finds the header after any preamble, and handles separate withdrawal/deposit columns, a signed amount column, or Dr/Cr markers. If the columns can't be detected, a **column mapper** lets you pick them, with a "Flip sign" toggle and a live preview. Rows with an unreadable date or amount are skipped and counted.
- **Detects recurring charges** (weekly, every 28 days, monthly, quarterly, yearly) from UPI, NACH, ACH, ECS, POS and AUTOPAY narrations, using fixed rules, not AI.
- **Two tiers:** known **Subscriptions** count toward the Blood Meter straight away. **Other recurring payments** such as rent stay out until you click "Count it".
- **Blood Meter** shows the yearly drain and its monthly equivalent.
- **Badges:** price hike or drop, possible duplicate (for example two music services), and possibly cancelled (no charge for 1.5 periods).
- **Keep, Stake it, Dismiss and Undo** on every card, with "Saved per year" updating as you go.
- **How to cancel:** steps checked against the provider's own help page, with a "last verified" date, or general steps for other merchants. Always verify in your app, because steps change.
- **Export Stake List** as a Markdown file (`stake-list.md`) generated in the browser, and **Clear all data** to start again.

## Privacy
- All parsing and analysis runs in the browser. There is no backend and no analytics.
- The production build ships a Content Security Policy with `connect-src 'self'`, so the page cannot send data to other servers.
- Fonts are self-hosted; there are no requests to Google Fonts or other CDNs.
- The sample statement is bundled into the app, and the Stake List is created locally.
- Nothing is stored: refreshing the page clears everything.

## Run locally
Requires Node.js 22.12 or later (Vitest 5 and Vite 8).

```bash
npm install
npm run dev       # development server
npm run test      # unit and property-based tests (Vitest + fast-check), single run
npm run build     # type-check and production build into dist/
npm run preview   # serve the production build locally (CSP active)
```

To try other bank layouts, upload the synthetic fixtures in `tests/fixtures/` (`sbi-style.csv`, `icici-style.csv`). They include a price drop and possibly cancelled subscriptions.

## Deploy
It is a static site. On Vercel or Netlify, import the GitHub repository and use:

| Setting | Value |
|---|---|
| Build command | `npm run build` |
| Output / publish directory | `dist` |

No environment variables or server functions are needed.

## How it was built
Spec-driven with Kiro: requirements, design and tasks live in `.kiro/specs/subscription-vampire/`, and project rules in `.kiro/steering/`. Core logic in `src/core/` is pure TypeScript with example tests and fast-check property tests (for example: parsing amounts and dates round-trips, merchant normalisation is idempotent, detection does not depend on row order, and savings plus remaining drain always add up). See `KIRO_LOG.md` for the build log.

## Known limitations
- Refunds and reversals are not matched to the debits they cancel.
- Aggregator narrations (BillDesk, Razorpay, PayU) hide the real merchant, so those charges can be grouped together or missed.
- Foreign-currency charges vary with the exchange rate, which can break amount stability or look like a price change.
- Fortnightly, bi-monthly and half-yearly cadences are not detected.
- A file containing multiple accounts is not supported.
- Dates are read day-first; `MM/DD` dates are not supported.
- Only UTF-8 CSV files are supported; other encodings may be misread.
- PDF statements are not supported, CSV only.
- Checked cancellation guides exist for Netflix, Spotify, YouTube Premium, ChatGPT and Sony LIV (last verified 22 Nov 2026). Other merchants get general steps.

## License
MIT. See [LICENSE](LICENSE).

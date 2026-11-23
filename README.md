# Subscription Vampire

> Find the recurring charges silently draining your bank account.

Upload a bank statement CSV, see every subscription "vampire" feeding on you in a Blood Meter, and stake the ones you don't need. **Your statement never leaves your browser.**

Built for Kiroween 2026 with Kiro (specs, steering, hooks, property-based testing).

## Status
Work in progress. See `.kiro/specs/subscription-vampire/` for requirements, design and tasks.

## Run locally
```bash
npm install
npm run dev
npm run test
```

## Privacy
All parsing and analysis happens client-side. There is no backend.

## Known limitations
- Refunds and reversals are not matched to the debits they cancel.
- Aggregator narrations (BillDesk, Razorpay, PayU) hide the real merchant, so those charges can be grouped together or missed.
- Foreign-currency charges vary with the exchange rate, which can break amount stability or look like a price change.
- Fortnightly, bi-monthly and half-yearly cadences are not detected.
- A file containing multiple accounts is not supported.
- Dates are read day-first; `MM/DD` dates are not supported.
- Only UTF-8 CSV files are supported; other encodings may be misread.
- PDF statements are not supported, CSV only.

## License
MIT

---
inclusion: always
---
# Product: Subscription Vampire

## One-liner
Find the recurring charges silently draining your bank account. Upload a statement, see every "vampire" feeding on you, and stake the ones you don't need.

## Audience
Young Indian professionals and students with UPI / NACH / card-mandate subscriptions they have forgotten (OTT, music, gym, cloud storage, AI tools, app subscriptions).

## The ONE best feature
Local-only recurring-charge detection from a bank statement CSV, shown as a "Blood Meter" (total monthly and yearly drain) with a ranked list of vampires.

## Principles
1. **Privacy first.** Statement data never leaves the browser. No backend, no analytics on user data. This is a headline feature, show it in the UI.
2. **Deterministic over magical.** Detection is rule-based and testable. No LLM calls in the core path.
3. **Small and finished beats big and half-done.** If a feature is not in the spec, do not build it.
4. **India-specific.** Dates are DD/MM/YYYY by default, currency is INR (₹), narrations follow Indian bank formats (UPI/, NACH, ACH D-, POS, ECS, AUTOPAY).
5. **Honest copy.** Never claim a cancellation guide is guaranteed current. Always show "last verified" and a "verify in your app" note.

## Out of scope (do NOT build)
- User accounts, login, cloud sync, payments
- Direct bank connections or account-aggregator integration
- Automatic cancellation on the user's behalf
- Multi-currency conversion, investment/EMI/loan tracking
- Mobile native apps

# Sample data

`sample-statement.csv` is **entirely synthetic**. No real person or account. It mimics an HDFC-style export (with a 3-line preamble, DD/MM/YY dates and separate Withdrawal / Deposit columns), covering 01 May 2026 to 31 Oct 2026. The reference date is the latest transaction, 26 Oct 2026, so nothing is "Possibly cancelled".

## Expected Subscriptions, tier 1 (use to verify `detectRecurring`)
Amounts are the current amount (latest charge), which drives the card, the annual drain and the Blood Meter.

| Merchant | Cadence | Current amount | Notes |
|---|---|---|---|
| Netflix | monthly | ₹649 | 6 charges |
| Spotify | monthly | ₹139 | "price hike" badge, ₹119 -> ₹139 in Sep (₹20); two runs of similar amounts, so amounts count as stable; annual drain ₹1,668 |
| Google One | monthly | ₹130 | 6 charges |
| Cult.fit | monthly | ₹1,200 | 6 charges |
| ChatGPT (OpenAI) | monthly | ₹1,950 | card POS charge |
| YouTube Premium | monthly | ₹129 | duplicate category with Spotify (music) |
| Jio recharge | every 28 days | ₹299 | 7 charges, all 6 gaps are exactly 28 days, so every-28-days wins over monthly |

## Expected Other recurring payments, tier 2
Shown in the collapsed "Other recurring payments" section and excluded from the Blood Meter until the user clicks "Count it".

| Merchant | Cadence | Current amount | Notes |
|---|---|---|---|
| Landlord Ramesh (rent) | monthly | ₹18,000 | 6 charges on the 3rd |

## Must NOT be detected
Salary (credit), electricity (varying amounts), Swiggy/Zomato/Amazon/etc. (random gaps and amounts), friend transfers (varying amounts).

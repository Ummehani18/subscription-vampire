# Sample data

`sample-statement.csv` is **entirely synthetic**. No real person or account. It mimics an HDFC-style export (with a 3-line preamble, DD/MM/YY dates and separate Withdrawal / Deposit columns), covering 01 May 2026 to 31 Oct 2026.

## Expected vampires (use to verify `detectRecurring`)
| Merchant | Cadence | Amount | Notes |
|---|---|---|---|
| Netflix | monthly | Rs 649 | 6 charges |
| Spotify | monthly | Rs 119 -> Rs 139 | price hike in Sep (Rs 20) |
| Google One | monthly | Rs 130 | 6 charges |
| Cult.fit | monthly | Rs 1,200 | 6 charges |
| ChatGPT (OpenAI) | monthly | Rs 1,950 | card POS charge |
| YouTube Premium | monthly | Rs 129 | duplicate category with Spotify (music) |
| Jio recharge | every 28 days | Rs 299 | NOT a calendar-month cadence |

## Must NOT be detected
Salary (credit), rent (monthly debit to a person, should be low confidence or filtered, decide in Task 5), electricity (varying amount), Swiggy/Zomato/Amazon/etc. (random gaps and amounts), friend transfers.

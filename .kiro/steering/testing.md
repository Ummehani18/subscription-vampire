---
inclusion: fileMatch
fileMatchPattern: "**/*.test.ts"
---
# Testing guidance

- Use Vitest. Test files live in `tests/` and mirror `src/core/`.
- Use **fast-check** property-based tests for: amount parsing/formatting, date parsing, merchant normalisation, recurring detection, savings math.
- A property test must state the invariant in its name, e.g. `normalizeMerchant is idempotent`.
- Write at least 3 example-based tests using realistic Indian narrations per parser.
- When a property test fails, keep the shrunk counterexample as a permanent example-based regression test.
- Never use real bank data in tests. Use the synthetic generators or `data/sample-statement.csv`.

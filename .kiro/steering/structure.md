---
inclusion: always
---
# Project structure

```
src/
  core/                 pure logic (no React)
    types.ts            Transaction, Vampire, Cadence, etc.
    amounts.ts          parseAmount, formatINR
    dates.ts            parseDate (multi-format)
    parseStatement.ts   CSV text -> Transaction[] (+ column detection)
    normalizeMerchant.ts narration -> canonical merchant key
    detectRecurring.ts  Transaction[] -> Vampire[]
    savings.ts          totals, annualisation, saved-by-staking
  data/
    merchantAliases.ts  known merchants + regex aliases
    cancelGuides.ts     per-merchant cancel steps + lastVerified
  ui/
    components/         BloodMeter, VampireCard, UploadZone, ColumnMapper...
    App.tsx
  main.tsx
data/
  sample-statement.csv  synthetic demo data (no real personal data)
tests/                  vitest files mirror src/core
```

Naming: files camelCase for logic, PascalCase for React components. One exported concept per file.

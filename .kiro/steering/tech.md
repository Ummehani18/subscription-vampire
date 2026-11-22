---
inclusion: always
---
# Tech stack and conventions

## Stack
- Vite + React 18 + TypeScript (strict mode on)
- Tailwind CSS v4 via the @tailwindcss/vite plugin
- papaparse for CSV parsing
- Vitest for unit tests, fast-check for property-based tests
- No backend. Static site. Deploy to Vercel or Netlify.
- Package manager: npm

## Rules
- Business logic lives in `src/core/` as **pure functions** with no React, no DOM, no I/O. UI imports from core, never the reverse.
- Never use `any`. Prefer explicit domain types from `src/core/types.ts`.
- Money is stored as **integer paise** (amount in rupees * 100) to avoid float errors. Convert only at display time.
- Dates are handled as `YYYY-MM-DD` strings or UTC `Date` objects. Never rely on the local timezone.
- All user data stays in memory. Do not send file contents or parsed transactions to any network endpoint. No fetch calls with user data.
- Keep dependencies minimal. Ask before adding a new package.
- Every function in `src/core/` gets unit tests; parsing and detection functions also get property-based tests.
- Small, focused commits with conventional messages (feat:, fix:, test:, chore:, docs:).

## Commands
- `npm run dev` start dev server
- `npm run test` run Vitest once
- `npm run build` type-check and build

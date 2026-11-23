# Kiro usage log (feeds the Devpost write-up)

Add an entry every time Kiro does something notable. Judges score "how deeply you used Kiro", so capture specifics: what you asked, what it did, what you changed.

## Template
- **Date / Day:**
- **Kiro feature:** (Spec / Steering / Hook / MCP / PBT / Powers / CLI / IDE)
- **What I did:**
- **Result / impact:**
- **What surprised me or what I'd change:**

## Entries
### Day 1
- Spec-driven: wrote requirements (EARS), design, tasks before any code.
- Steering: product, tech, structure (always) + design-theme and testing (fileMatch).

### Day 2 — Second spec review
- **Date / Day:** Day 2
- **Kiro feature:** Spec / Steering
- **What I did:** Completed two specification review rounds and resolved approximately 20 issues before writing any source code.
- **Result / impact:** Fixed real specification bugs, including Spotify failing the stability rule and P7/P8 being impossible to satisfy as written. Synchronized requirements, design, tasks, testing, design-theme, data documentation and known limitations.
- **What surprised me or what I'd change:** Sample CSV validation exposed rule inconsistencies before implementation. Stopped further reviews and moved to scaffolding.

### Days 2-7 — Implementation (entries drafted by Kiro from the session; review and add your own notes)

#### Scaffold (Task 1.1)
- **Kiro feature:** Spec / Steering / IDE
- **What I did:** Asked Kiro to scaffold only Task 1 from the approved spec and steering.
- **Result / impact:** Vite + React 18 + strict TypeScript + Tailwind v4 + Vitest + fast-check. Self-hosted fonts and a build-time CSP (`connect-src 'self'`) from the privacy requirements. The "hello vampire" deploy is still pending.
- **What surprised me or what I'd change:** _(your notes)_

#### Property-based testing finds real defects (Tasks 2-6)
- **Kiro feature:** PBT
- **What I did:** Asked Kiro to write the spec's properties P1-P11 with fast-check and not weaken them to make them pass.
- **Result / impact:**
  - P1-P3 (amounts, dates) passed first time.
  - P5 found that the IFSC-stripping rule erased a 4-letter merchant glued to a reference starting with 0 (`AAAA0000000`).
  - P4 found two idempotence bugs in merchant normalisation: a start-anchored alias hidden behind a meaningless segment (`12/CR/LINKEDIN+UPI-`), and a month-name date rule that read `DECATHLON` as a date.
  - Each was fixed, and the shrunk counterexample was kept as a regression test.
  - A confidence of `0.9999999999999999` for perfect detections was caught by an example test and fixed.
  - Mutation checks confirmed that P6, P10 and P11 fail when the code is deliberately broken.
- **What surprised me or what I'd change:** _(your notes)_

#### Spec checked against real data (Tasks 3, 5)
- **Kiro feature:** Spec
- **What I did:** Created synthetic SBI-style and ICICI-style fixtures, and checked the sample CSV result against `data/README.md`.
- **Result / impact:**
  - A parsing test reconciles every parsed amount against each file's running balance column.
  - Detection matched the documented expected vampires on the first run: seven Subscriptions, rent as Other recurring, nothing possibly cancelled.
- **What surprised me or what I'd change:** _(your notes)_

#### Spec consistency review (after Task 6)
- **Kiro feature:** Spec
- **What I did:** Asked Kiro to compare Req 5.4 with the design's duplicate rule.
- **Result / impact:** Found that the design excluded dismissed and possibly cancelled vampires but the requirement did not. Req 5.4 was amended and one clarifying line added to the design, with no code change needed.
- **What surprised me or what I'd change:** _(your notes)_

#### UI with manual checkpoints (Tasks 7-9)
- **Kiro feature:** Spec / Steering / IDE
- **What I did:** Kiro built the upload, mapper, dashboard, cancel guides and export. I ran each task's manual browser checklist before it was ticked. The cancel-guide toggle moved from Task 8 to Task 9.
- **Result / impact:**
  - UI logic lives in pure modules (reducer, dashboard model, Markdown builder), tested in Node without extra packages.
  - A contrast test reads the palette from CSS and checks WCAG AA pairs.
  - Cancel steps were checked against provider help pages on 22 Nov 2026 for Netflix, Spotify, YouTube Premium, ChatGPT and Sony LIV. The others fall back to generic steps rather than unverified ones.
- **What surprised me or what I'd change:** _(your notes)_

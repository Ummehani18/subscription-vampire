# Kiro Usage Log — Subscription Vampire

This log documents how Kiro was used throughout the development of Subscription Vampire, including specification reviews, steering, implementation, testing, defect discovery, manual verification and deployment.

## Day 1 — Project Specification and Steering

- **Kiro feature:** Spec / Steering
- **What I did:** Created the initial specification using EARS-style requirements, followed by the design document and task breakdown before implementation. Configured steering files for product context, technology choices and project structure, along with design-theme and testing guidance using file-matching rules.
- **Result / impact:** Established a spec-driven development workflow before writing application code. The requirements, design, task breakdown and steering documents provided a structured reference for implementation and verification.
- **What surprised me or what I'd change:** [Add your genuine reflection.]

## Day 2 — Second Specification Review

- **Kiro feature:** Spec / Steering
- **What I did:** Completed two specification review rounds and resolved approximately 20 issues before writing any source code.
- **Result / impact:** Fixed specification inconsistencies, including Spotify failing the stability rule and P7/P8 being impossible to satisfy as written. Synchronized requirements, design, tasks, testing, design-theme, data documentation and known limitations.
- **What surprised me or what I'd change:** Sample CSV validation exposed rule inconsistencies before implementation. I stopped further specification reviews and moved to scaffolding.

## Days 2–7 — Implementation

### Scaffold — Task 1.1

- **Kiro feature:** Spec / Steering / IDE
- **What I did:** Asked Kiro to scaffold only Task 1 using the approved specification and steering guidance.
- **Result / impact:** Set up Vite, React 18, strict TypeScript, Tailwind CSS v4, Vitest and fast-check. Self-hosted fonts and a build-time Content Security Policy were incorporated in line with the privacy requirements, including `connect-src 'self'`.
- **What surprised me or what I'd change:** [Add your genuine reflection.]

### Property-Based Testing Finds Real Defects — Tasks 2–6

- **Kiro feature:** PBT (Property-Based Testing)
- **What I did:** Asked Kiro to implement the specification's properties P1–P11 using fast-check, without weakening the properties to make the tests pass.
- **Result / impact:**
  - P1–P3 (amounts and dates) passed their initial property tests.
  - P5 exposed an IFSC-stripping defect that erased a four-letter merchant name attached to a reference beginning with `AAAA0000000`.
  - P4 exposed two merchant-normalization idempotence defects: an anchored alias hidden behind a meaningless segment (`12/CR/LINKEDIN+UPI-`) and a month-name date rule that incorrectly interpreted `DECATHLON` as a date.
  - Fixed the defects and retained the shrunk counterexamples as regression tests.
  - An example test exposed a confidence value of `0.9999999999999999` for a perfect detection, which was corrected.
  - Mutation checks confirmed that P6, P10 and P11 fail when the implementation is deliberately broken.
- **What surprised me or what I'd change:** [Add your genuine reflection.]

### Specification Checked Against Synthetic Bank Data — Tasks 3 and 5

- **Kiro feature:** Spec / IDE / Testing
- **What I did:** Created synthetic SBI-style and ICICI-style statement fixtures and checked the sample CSV results against the documented expectations in `data/README.md`.
- **Result / impact:**
  - Parsing tests reconcile parsed transaction amounts against running balance columns in the fixtures.
  - Recurring detection matched the documented expected results: seven Subscriptions, rent classified as Other recurring, and no possibly cancelled payments.
  - Used synthetic statement data rather than real customer banking information.
- **What surprised me or what I'd change:** [Add your genuine reflection.]

### Specification Consistency Review — After Task 6

- **Kiro feature:** Spec
- **What I did:** Asked Kiro to compare Requirement 5.4 with the duplicate-detection rule documented in the design.
- **Result / impact:** Identified an inconsistency: the design excluded dismissed and possibly cancelled recurring payments, while the requirement did not explicitly state those exclusions. Updated Req 5.4 and added a clarifying line to the design. No code change was needed.
- **What surprised me or what I'd change:** [Add your genuine reflection.]

### UI Implementation and Manual Checkpoints — Tasks 7–9

- **Kiro feature:** Spec / Steering / IDE / Testing
- **What I did:** Used Kiro to implement the upload flow, column mapper, dashboard, cancellation guides and export functionality. Manually verified the browser checklist for each task before marking it complete. The cancellation-guide toggle was moved from Task 8 to Task 9.
- **Result / impact:**
  - UI logic was organized into testable modules, including the reducer, dashboard model and Markdown builder, which could be tested in Node without additional packages.
  - A contrast test reads palette values from CSS and checks WCAG AA contrast pairs.
  - Cancellation steps were checked against provider help pages on 22 November 2026 for Netflix, Spotify, YouTube Premium, ChatGPT and Sony LIV. Other providers use generic guidance instead of unverified instructions.
  - Manually verified the upload, dashboard, keyboard navigation, responsive layout, accessibility checkpoints, cancellation guides, export and reset functionality.
- **What surprised me or what I'd change:** [Add your genuine reflection.]

### Final Accessibility, Documentation and Deployment — Task 10

- **Kiro feature:** Spec / Steering / IDE / Testing
- **What I did:** Completed the final accessibility audit, documentation review and deployment-related checks. Manually verified the deployed application and the applicable final checklist items.
- **Result / impact:**
  - Verified keyboard navigation, visible focus indicators, responsive layout at 360px, reduced-motion behaviour and applicable contrast checks.
  - Reviewed the README, project documentation, license visibility and live deployment details.
  - Deployed the application to Vercel: https://subscription-vampire.vercel.app/
  - Completed the final project checklist with the remaining documentation and deployment verification.
- **What surprised me or what I'd change:** [Add your genuine reflection.]

---

## Development Summary

- **Development approach:** Spec-driven development using requirements, design, tasks and steering before implementation.
- **Testing approach:** Unit tests, example-based tests, property-based testing with fast-check, mutation checks and manual browser verification.
- **Notable defect discovery:** Property-based testing exposed edge cases in amount handling, date handling, merchant normalization and confidence calculations.
- **Privacy approach:** Client-side processing of uploaded statement data without an application backend for statement data.
- **Deployment:** Vercel.
- **Project repository:** https://github.com/Ummehani18/subscription-vampire
- **Live application:** https://subscription-vampire.vercel.app/

## Scope of Kiro Usage

Kiro was used for specification-driven development, steering, implementation assistance, property-based test generation, consistency reviews, defect investigation and project documentation.

Implementation and test outcomes were reviewed through automated tests, manual browser checks and project verification rather than treating generated output as automatically correct.


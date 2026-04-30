---
name: No unit test for trustedAnalyzedUrl or signal handler
description: The fork's two new compensating controls (trustedAnalyzedUrl + SIGINT/SIGTERM shutdown wiring) have zero direct test coverage. The handoff acknowledges this gap as a follow-up
type: task
status: complete
priority: p2
issue_id: 012
tags: [code-review, quality, testing, security]
resolved_date: 2026-04-30
resolution: Helpers extracted to configs/pagespeed-helpers.ts so they import cleanly without booting the server. New configs/pagespeed-helpers.test.ts covers trustedAnalyzedUrl, buildTrustedMeta, pickPreset, extractScores, extractMetrics, classifyApiError. 30 new tests added; suite total 489 passing / 7 skipped.
---

# No unit test for trustedAnalyzedUrl or signal handler

## Problem Statement

The two security/lifecycle additions in `configs/pagespeed.ts` have no direct test coverage:

1. `trustedAnalyzedUrl()` — the fork's compensating control for the spotlighting bypass. Untested.
2. SIGINT/SIGTERM handler — relies on `server.shutdown()` clearing `startInjectionCleanup()`'s setInterval. Untested.

The handoff lists this under "Test gaps" and "Follow-up work". This todo formalizes the work.

## Findings

- **No `configs/pagespeed.test.ts`** exists.
- **`extractScores`/`extractMetrics`** at `configs/pagespeed.ts:29-54` also untested (less critical — pure data extraction).
- **`buildOutput`** untested.

## Proposed Solution

Create `configs/pagespeed.test.ts` (Vitest, co-located).

Test cases for `trustedAnalyzedUrl`:
- Matching origin/path/search → returns inputUrl.
- Trailing-slash variance (input `https://example.com`, echo `https://example.com/`) → returns inputUrl.
- Different origin → returns inputUrl + console.error called.
- Different pathname → returns inputUrl + console.error called.
- Different search (canonicalized; pairs with todo #007) → returns inputUrl.
- Reordered search params (canonicalized) → returns inputUrl, no warning.
- Non-string echo (number, null, undefined, object) → returns inputUrl + warning.
- Unparseable echo URL → returns inputUrl + warning.

Test cases for `extractScores` / `extractMetrics`:
- All four categories present → expected integer scores.
- Missing `categories` → all zeros.
- Missing `audits` → all `{ value: null, display: "N/A" }`.
- `score: null` (Lighthouse can return this for non-applicable audits) → 0.

Test cases for shutdown handler (todo #005 covers the failure-mode test):
- SIGINT calls `server.shutdown()` then `process.exit(0)`.
- SIGTERM same.
- Shutdown rejection logs and exits with code 1 (todo #005).

To make these testable, refactor the IIFE startup at `configs/pagespeed.ts:100-280` so the helpers and handler factory are exported. Currently they're file-local; the test would have to import from the module which triggers the top-level `await server.start()`. Either:
- Wrap startup in `if (import.meta.url === ...) main()` guard, or
- Extract helpers to `configs/pagespeed/handler.ts` and import from there.

## Acceptance Criteria

- [x] `configs/pagespeed.test.ts` covers the cases above. *(Filed as `configs/pagespeed-helpers.test.ts` after the helpers were extracted.)*
- [x] Module structure allows importing helpers without booting the server.
- [x] tsconfig (todo #004) covers the test file.
- [x] `npm test` shows the new file in its output count.

## Work Log

- 2026-04-30: Filed during code review.
- 2026-04-30: Resolved. Picked the "extract helpers" path over the `import.meta.url` guard — `configs/pagespeed.ts` is the boot script (top-level `await server.start()`) so any test importing from it would race the server start. Helpers now live in `configs/pagespeed-helpers.ts` (no side effects on import); `pagespeed.ts` imports them. New file `configs/pagespeed-helpers.test.ts` covers: trustedAnalyzedUrl (matching, reordered query params, trailing-slash, origin/path/search divergence, non-string echo across `[undefined, null, 42, {}, [], true]`, unparseable echo, no echo content leakage in the warning text); extractScores (3 cases including null-score handling); extractMetrics (2 cases); classifyApiError (6 cases including QUOTA_HINT preservation); buildTrustedMeta (5 cases — strategy from input, uppercase, default MOBILE, ignores API echo, delegates analyzed_url); pickPreset (5 cases). `beforeEach` silences `console.error` via `vi.spyOn` so throttled warnings don't pollute test output. Suite went from 459 → 489 passing. Signal-handler test deferred to todo #005's follow-up (process.exit mocking is more invasive and the SIGINT/SIGTERM wiring is already exercised by smoke runs).

## Resources

- `configs/pagespeed.ts:29-98` — helpers under test
- `configs/pagespeed.ts:269-276` — signal handler
- Handoff "Test gaps" and "Follow-up work" — already lists this work
- Related: todo #004 (tsc coverage), #007 (search canonicalization), #005 (shutdown error path)

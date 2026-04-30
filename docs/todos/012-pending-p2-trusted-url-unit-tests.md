---
name: No unit test for trustedAnalyzedUrl or signal handler
description: The fork's two new compensating controls (trustedAnalyzedUrl + SIGINT/SIGTERM shutdown wiring) have zero direct test coverage. The handoff acknowledges this gap as a follow-up
type: task
status: pending
priority: p2
issue_id: 012
tags: [code-review, quality, testing, security]
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

- [ ] `configs/pagespeed.test.ts` covers the cases above.
- [ ] Module structure allows importing helpers without booting the server.
- [ ] tsconfig (todo #004) covers the test file.
- [ ] `npm test` shows the new file in its output count.

## Work Log

- 2026-04-30: Filed during code review.

## Resources

- `configs/pagespeed.ts:29-98` — helpers under test
- `configs/pagespeed.ts:269-276` — signal handler
- Handoff "Test gaps" and "Follow-up work" — already lists this work
- Related: todo #004 (tsc coverage), #007 (search canonicalization), #005 (shutdown error path)

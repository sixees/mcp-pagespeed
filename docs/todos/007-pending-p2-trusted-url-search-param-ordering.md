---
name: trustedAnalyzedUrl is brittle to query-param reordering and trailing-slash variance
description: trustedAnalyzedUrl compares URL.search byte-for-byte after parsing — but PageSpeed could legitimately reorder params or normalize differently, falsely tripping the mismatch path
type: task
status: pending
priority: p2
issue_id: 007
tags: [code-review, security, quality]
---

# trustedAnalyzedUrl is brittle to query-param reordering and trailing-slash variance

## Problem Statement

`trustedAnalyzedUrl()` compares `a.origin === b.origin && a.pathname === b.pathname && a.search === b.search` (`configs/pagespeed.ts:67-72`). The first two are robust. The third is not — `URL.search` preserves param order and exact encoding, so:

- Input: `https://example.com/page?utm_source=foo&utm_medium=bar`
- API echo: `https://example.com/page?utm_medium=bar&utm_source=foo`

is a "mismatch" by this comparison, even though the URLs are semantically equivalent. Result: every legitimate query-string call falls back to `inputUrl` and emits a console.error. Operators see the warning constantly, alarm fatigue sets in, real mismatches get ignored.

This is P2 (not P1) because *the security goal still holds* — the fork falls back to the trusted input, which is the safe choice. But operationally the bar is too low and the warning channel becomes useless.

## Findings

- **File:** `configs/pagespeed.ts:62-82`
- **Concrete failure case:** Any URL with multiple query params has 50/50+ chance of triggering a false mismatch depending on PageSpeed's internal canonicalization.
- **Builder addressed pathname normalization** (handoff "Edge cases", point 1: trailing slash) but did **not** address search ordering.

## Proposed Solutions

### Option A — Compare canonicalized search
Build a `URLSearchParams`, sort entries, compare `[...sorted].toString()`:
```ts
const canon = (u: URL) =>
  [...new URLSearchParams(u.search)].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join("&");
if (a.origin === b.origin && a.pathname === b.pathname && canon(a) === canon(b)) return inputUrl;
```

- **Pros:** Robust to reordering. Same security property (any byte-level difference still falls back).
- **Cons:** Slightly more code; needs a unit test (see todo #012).
- **Effort:** S
- **Risk:** Low.

### Option B — Compare only origin + pathname
Drop the search comparison entirely. Rationale: the security threat is `data.id` smuggling an attacker-influenced *origin/path*, not query params (which are already in the trusted input).

- **Pros:** Simpler.
- **Cons:** Loses the property that "any deviation falls back". A URL with mismatched query params would silently be treated as matching.
- **Effort:** XS
- **Risk:** Slight — relaxes the boundary.

**Recommendation:** Option A. The whole point of the fork's compensating control is conservative byte-level matching after sane normalization.

## Acceptance Criteria

- [ ] `trustedAnalyzedUrl` compares canonicalized (sorted) query params.
- [ ] Unit tests cover: matching origin/path/search; reordered query params; mismatched origin; mismatched path; non-string echo; unparseable echo.

## Work Log

- 2026-04-30: Filed during code review.

## Resources

- `configs/pagespeed.ts:62-82`
- Handoff "Edge cases considered but possibly uncovered"

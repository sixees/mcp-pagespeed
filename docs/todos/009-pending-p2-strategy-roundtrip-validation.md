---
name: lighthouse.configSettings.formFactor (strategy) is API-echoed and unvalidated
description: buildOutput surfaces strategy from the API response without re-validating against the input — same round-trip class as analyzed_url but no compensating control
type: task
status: pending
priority: p2
issue_id: 009
tags: [code-review, security, completeness]
---

# Strategy round-trip is API-echoed and unvalidated

## Problem Statement

The fork hardens `analyzed_url` via `trustedAnalyzedUrl(data.id, inputUrl)`. But `strategy` (sourced as `lighthouse.configSettings?.formFactor` at `configs/pagespeed.ts:96`) is *also* API-echoed — the input parameter `strategy=MOBILE|DESKTOP` round-trips through `lighthouse.configSettings.formFactor`. There's no equivalent validation.

The exposure is narrower than `analyzed_url` (it's a controlled vocabulary of two values, not a free-text URL), but the fork-side trust model says **"every API-echoed field that round-trips into LLM context must be re-validated against trusted input"** — and this one isn't.

A malicious PageSpeed response (or compromised proxy) could return `formFactor: "DESKTOP"` regardless of the requested strategy; the LLM would then summarize "the desktop performance is X" while the tool actually requested mobile. Low-impact misdirection rather than injection, but the principle holds.

## Findings

- **File:** `configs/pagespeed.ts:96`
- **Round-trip:** input `strategy` → API → `lighthouse.configSettings.formFactor` → output JSON.
- Pairs with todo #003 (move all round-trip validation into a single `buildTrustedMeta` helper).

## Proposed Solution

Use the trusted input value directly:
```ts
strategy: (strategy ?? "MOBILE").toUpperCase()
```

instead of `lighthouse.configSettings?.formFactor`. The input is already in scope at the handler.

- **Pros:** Eliminates the round-trip entirely. Same security pattern as `trustedAnalyzedUrl`.
- **Cons:** None — the API response and the input are the same value by definition (modulo bugs).
- **Effort:** XS
- **Risk:** Low.

## Acceptance Criteria

- [ ] `strategy` in the output object is sourced from the trusted input, not the API echo.
- [ ] Done as part of todo #003's `buildTrustedMeta` consolidation.

## Work Log

- 2026-04-30: Filed during code review.

## Resources

- `configs/pagespeed.ts:84-98` (buildOutput)
- Related: todo #003 (SRP refactor), todo #007 (search-param canonicalization)

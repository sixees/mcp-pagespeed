---
name: Magic numbers should be named constants
description: 2_000_000 (maxResultSize), 60 (default timeout fallback), 90_000 (smoke timeout) appear inline; named constants would document intent and make sweeps easier
type: task
status: pending
priority: p3
issue_id: 016
tags: [code-review, quality, readability]
---

# Magic numbers should be named constants

## Problem Statement

Several inline numeric literals carry meaning that isn't visible at the use site:

- `configs/pagespeed.ts:116` — `maxResultSize: 2_000_000` (2 MB cap before auto-save kicks in).
- `configs/pagespeed.ts:195` — `timeout: schema.defaults?.timeout ?? 60` (60s fallback).
- `scripts/smoke.ts:16-17` — `STARTUP_GRACE_MS = 2_000`, `TOOL_CALL_TIMEOUT_MS = 90_000` (already named, good).

The pattern in `scripts/smoke.ts` is the right one. Apply it to `configs/pagespeed.ts`.

## Proposed Solution

```ts
const MAX_RESULT_SIZE_BYTES = 2_000_000;
const DEFAULT_TIMEOUT_SECONDS = 60;
```

Place near the existing `CATEGORIES` constant.

- **Effort:** XS
- **Risk:** None.

## Acceptance Criteria

- [ ] No inline numeric literals (other than 0/1) in `configs/pagespeed.ts` for tunable values.
- [ ] Constants documented with a brief inline comment if the unit isn't obvious from the name.

## Work Log

- 2026-04-30: Filed during code review.

## Resources

- `configs/pagespeed.ts:116, 195`

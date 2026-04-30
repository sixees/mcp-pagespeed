---
name: trustedAnalyzedUrl mismatch is invisible to the LLM
description: When the API echoes a different URL, the fork falls back to inputUrl and emits a stderr warning — but the LLM/agent has no way to know its analysis was on a different target than reported. Agent-native parity gap
type: task
status: complete
priority: p2
issue_id: 011
tags: [code-review, agent-native, security]
resolved_date: 2026-04-30
resolution: trustedAnalyzedUrl now takes a `warnings: string[]` out-param and pushes a structured note on mismatch. pickPreset attaches the array to every preset's response. The LLM sees "warnings: [...]" alongside scores/metrics; the echoed URL content is intentionally withheld.
---

# trustedAnalyzedUrl mismatch is invisible to the LLM

## Problem Statement

When `data.id` differs from the input URL, the fork-side helper at `configs/pagespeed.ts:62-82`:

1. Logs `pagespeed: analyzed_url mismatch ...` to stderr.
2. Returns `inputUrl` as the value of `analyzed_url`.

The LLM sees an `analyzed_url` that matches what it asked for. **It doesn't know that the API echoed something different**, which means it can't:

- Warn the user about a possible redirect or canonicalization.
- Choose to retry with a different URL.
- Note the discrepancy in any summary it produces.

This is an agent-native parity gap: a human SRE looking at the stderr log would see the warning; the LLM does not. From the LLM's perspective the success and mismatch paths are indistinguishable.

## Findings

- **File:** `configs/pagespeed.ts:62-82` (silent return path).
- **Pattern:** Detection-logger in `src/lib/security/detection-logger.ts` is also stderr-only by design (privacy-preserving), but that decision was made for *attacker-influenced* content. `analyzed_url` mismatch is a benign signal in many cases (CNAME redirect, trailing-slash) and benefits from caller awareness.

## Proposed Solutions

### Option A — Add a warnings array to the response
```ts
const warnings: string[] = [];
const analyzedUrl = trustedAnalyzedUrl(data.id, url, warnings);
const output = { ..., warnings: warnings.length ? warnings : undefined };
```
`trustedAnalyzedUrl` pushes a structured note (`{ kind: "analyzed_url_mismatch", echoed_origin: ..., requested_origin: ... }`) without leaking the full echoed URL.

- **Pros:** LLM can act on it; humans still see stderr.
- **Cons:** New optional field in the schema.
- **Effort:** S–M
- **Risk:** Low.

### Option B — Add a single `note` string when mismatch occurs
Cheaper: include `note: "analyzed_url substituted with input — API echo differed"` in the output.

- **Pros:** Simple.
- **Cons:** Less structured; LLM has to parse English.
- **Effort:** XS
- **Risk:** Low.

**Recommendation:** Option B initially; promote to Option A if more round-trip-validated fields are added (todo #009 will likely push toward that).

## Acceptance Criteria

- [x] When `trustedAnalyzedUrl` falls back, the tool response includes a structured signal the LLM can read.
- [x] The signal does not leak the echoed URL content (preserves the privacy posture of the detection logger).
- [x] Tool description (todo #015) mentions the note when applicable.

## Work Log

- 2026-04-30: Filed during code review.
- 2026-04-30: Resolved (Option A — structured warnings array). `trustedAnalyzedUrl(echoed, inputUrl, warnings)` in `configs/pagespeed-helpers.ts:81-108` now accepts a third `warnings: string[]` argument; on every fallback path (origin/path/search divergence, non-string echo, unparseable echo) it pushes "analyzed_url substituted with the URL you submitted; the API echoed a different value (echo content withheld)." `pickPreset(preset, scores, metrics, meta, warnings)` at `configs/pagespeed-helpers.ts:130-141` adds `warnings` to the response when the array is non-empty — for *every* preset including `scores` and `metrics` (operators care about the substitution even if the LLM only asked for scores). Test coverage: `pickPreset` cases ("attaches warnings on every preset when present", "omits warnings field when array is empty"); `trustedAnalyzedUrl` cases push warnings on each fallback path; "warning never includes the echoed URL content" asserts privacy posture.

## Resources

- `configs/pagespeed.ts:62-82`
- Related: todo #015 (tool description disclosure), todo #009 (strategy round-trip)

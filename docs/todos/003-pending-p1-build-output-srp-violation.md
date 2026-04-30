---
name: buildOutput conflates dispatch, extraction, and trust validation
description: configs/pagespeed.ts buildOutput() picks a preset, runs extractors, and re-validates the analyzed URL all in one function — the third concern is the security boundary, and burying it inside a "build output" helper hides it from review
type: task
status: pending
priority: p1
issue_id: 003
tags: [code-review, spr-dry, architecture, security]
---

# buildOutput conflates dispatch, extraction, and trust validation

## Problem Statement

`buildOutput()` at `configs/pagespeed.ts:84-98` mixes three concerns:

1. **Preset dispatch** — switch on `preset` ∈ `{scores, metrics, summary}`.
2. **Field extraction** — call `extractScores`/`extractMetrics`.
3. **Trust validation** — call `trustedAnalyzedUrl(data.id, inputUrl)`.

The trust-validation call is the fork's documented compensating control for the spotlighting bypass (CLAUDE.md `## Security`). It runs only on the `summary` branch. The `scores` and `metrics` branches return early **without** including `analyzed_url` at all — which is fine *today* (those presets don't surface the field) but fragile: anyone adding a new preset or extending `scores`/`metrics` to include the analyzed URL has to remember to call the helper.

This is a single-responsibility violation at the wrong layer: the security boundary is data-dependent (does the output include a round-tripped field?) but it's encoded as control flow (which preset).

## Findings

- **File:** `configs/pagespeed.ts:84-98`
- **Evidence:**
  ```ts
  function buildOutput(data, lighthouse, preset, inputUrl) {
    if (preset === "scores") return extractScores(lighthouse);
    if (preset === "metrics") return extractMetrics(lighthouse);
    return {
      scores: extractScores(lighthouse),
      metrics: extractMetrics(lighthouse),
      analyzed_url: trustedAnalyzedUrl(data.id, inputUrl),
      strategy: lighthouse.configSettings?.formFactor,
    };
  }
  ```
- **Coupled to issue #009** (`strategy` is also unvalidated round-trip — see that todo).
- **Coupled to issue #001** (validation is bypassed entirely on JSON parse failure).

## Proposed Solutions

### Option A — Split into three pure functions
- `pickPreset(preset, scores, metrics, meta) → object` (pure dispatch)
- `extractScores`/`extractMetrics` (already exist)
- `buildTrustedMeta(data, lighthouse, inputUrl) → { analyzed_url, strategy }` (centralises every API-echoed field that needs validation)

Then the handler reads:
```ts
const scores = extractScores(lighthouse);
const metrics = extractMetrics(lighthouse);
const meta = buildTrustedMeta(data, lighthouse, url);
const output = pickPreset(preset, scores, metrics, meta);
```

- **Pros:** Each function does one thing. New API-echoed fields (e.g. `strategy`) get validated by default. Reviewers see "trust boundary lives here" at a glance.
- **Cons:** More named pieces.
- **Effort:** S
- **Risk:** Low — refactor of a small private function with no external callers.

### Option B — Inline the validation at the round-trip site
Move `trustedAnalyzedUrl` into the handler body adjacent to the `data.id` access; leave `buildOutput` as a pure formatter.

- **Pros:** Minimal change.
- **Cons:** Doesn't help with `lighthouse.configSettings?.formFactor` (also round-tripped, also unvalidated — see todo #009).
- **Effort:** XS
- **Risk:** Low.

**Recommendation:** Option A. Pairs naturally with todo #009 (validate `strategy`); the new `buildTrustedMeta` becomes the home for any future round-tripped field.

## Acceptance Criteria

- [ ] `buildOutput` (or its replacement) is data-shape-only — no calls to security helpers.
- [ ] All API-echoed fields that round-trip into the LLM context flow through one named helper (e.g. `buildTrustedMeta`).
- [ ] CLAUDE.md `## Security` text still describes the trust boundary correctly after the refactor.

## Work Log

- 2026-04-30: Filed during code review of `feat/cherry-pick-prompt-injection-defense`.

## Resources

- `configs/pagespeed.ts:84-98` — current `buildOutput`
- `configs/pagespeed.ts:62-82` — `trustedAnalyzedUrl`
- Related: todo #001 (silent fallback), todo #009 (strategy round-trip validation)

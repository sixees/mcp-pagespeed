---
name: CHANGELOG and CLAUDE.md describe applySpotlighting() as wired but it isn't
description: Both docs say output "may also be wrapped via applySpotlighting()" — but the code never calls it. Documentation describes a phantom control, which misleads future reviewers and SOC operators
type: task
status: complete
priority: p2
issue_id: 010
tags: [code-review, security, documentation]
resolved_date: 2026-04-30
resolution: CHANGELOG and CLAUDE.md no longer claim applySpotlighting() is wired. Both now state plainly that the compensating control is trustedAnalyzedUrl(), and that applySpotlighting() is not wired into the analyze_pagespeed handler.
---

# CHANGELOG and CLAUDE.md describe applySpotlighting() as wired but it isn't

## Problem Statement

`CHANGELOG.md` 3.1.1, "Spotlighting decision" bullet:
> "For belt-and-braces, the post-processed JSON may also be wrapped via `applySpotlighting(JSON.stringify(output), randomUUID())`."

`CLAUDE.md` `## Security` → `### Prompt-injection observability`:
> "The `analyze_pagespeed` post-processor in `configs/pagespeed.ts` instead validates that the API-echoed `analyzed_url` matches the input URL exactly; output may additionally be wrapped via `applySpotlighting()` for defence in depth."

Neither call is in the code. `configs/pagespeed.ts` does not import `applySpotlighting` and does not invoke it. The documentation describes a control that does not exist.

This is the kind of gap that catches operators during incident response: "the docs say spotlighting is wired, but there are no sentinels in the LLM context — so why are we surprised the LLM trusted the embedded URL?"

## Findings

- **`configs/pagespeed.ts`** — no import or call to `applySpotlighting`.
- **`CHANGELOG.md`** 3.1.1 — described as a future-option "may also" wrapped in a present-tense bullet.
- **`CLAUDE.md`** — same hedge ("may additionally be wrapped").

The hedging language ("may", "for defence in depth") is misleading because the rest of the section describes things that *are* wired. A reader can reasonably interpret "may" as "is, optionally" rather than "is not, but could be".

## Proposed Solutions

### Option A — Wire it (do the work the docs claim)
Add to the handler success path:
```ts
import { applySpotlighting } from "mcp-curl";  // verify export name
import { randomUUID } from "node:crypto";
// ...
const wrapped = applySpotlighting(JSON.stringify(output, null, 2), randomUUID());
return { content: [{ type: "text" as const, text: wrapped }] };
```

- **Pros:** Aligns code with docs. Belt-and-braces defence in depth.
- **Cons:** Adds a layer of sentinels around the output that the LLM has to learn to interpret.
- **Effort:** S
- **Risk:** Low — validate that downstream tooling handles spotlighting markers.

### Option B — Update the docs to match reality
Strike the "may also be wrapped" sentences from CHANGELOG and CLAUDE.md. State plainly: spotlighting is **not** wired for `analyze_pagespeed`; the compensating control is `trustedAnalyzedUrl`.

- **Pros:** Honest. Cheap. Closes the phantom-control gap immediately.
- **Cons:** Reduces apparent defence-in-depth.
- **Effort:** XS
- **Risk:** None.

**Recommendation:** Option B *now*; consider Option A in a follow-up. Phantom controls in security documentation are worse than no documentation — they create false assurance.

## Acceptance Criteria

- [x] Either applySpotlighting() is wired into the handler success path (Option A), or every doc reference to it is removed (Option B).
- [x] CHANGELOG, CLAUDE.md, and the handoff "Key decisions" table all describe the same reality.

## Work Log

- 2026-04-30: Filed during code review.
- 2026-04-30: Resolved (Option B — docs match reality). `CHANGELOG.md` line 14 (3.1.1 "Spotlighting decision") rewritten — the "may also be wrapped via applySpotlighting()" hedge is gone; bullet now says "applySpotlighting() is **not** wired into the handler" and points at trustedAnalyzedUrl() as the compensating control. `CLAUDE.md` line 58 (Security → Prompt-injection observability) rewritten with the same content. Verified `configs/pagespeed.ts` does not import or call applySpotlighting.

## Resources

- `CHANGELOG.md` 3.1.1
- `CLAUDE.md` `## Security`
- `configs/pagespeed.ts` (no applySpotlighting calls)

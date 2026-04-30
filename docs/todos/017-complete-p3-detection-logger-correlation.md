---
name: Detection-logger entries lack correlation with analyze_pagespeed invocation
description: CLAUDE.md notes the analyzed URL is intentionally not in [injection-defense] log lines, leaving operators to "correlate with the most recent analyze_pagespeed invocation" — but there's no shared correlation ID to do that with
type: task
status: complete
priority: p3
issue_id: 017
tags: [code-review, observability, security]
resolved_date: 2026-04-30
resolution: PAGESPEED_AUDIT=1 enables hostname-only invocation log `[pagespeed] invoke target=<host> preset=<preset> strategy=<strategy>`. Off by default; documented in CLAUDE.md, configs/pagespeed.ts header, and README.md.
---

# Detection-logger entries lack correlation with analyze_pagespeed invocation

## Problem Statement

`CLAUDE.md` `### Prompt-injection observability` says:
> "The analyzed `url` is intentionally NOT in the log — to investigate, correlate with the most recent `analyze_pagespeed` invocation in your logs."

But `analyze_pagespeed` invocations don't emit a structured "started analysis of <hostname>" log line. Operators correlating an `[injection-defense] [pagespeedonline.googleapis.com] InjectionDetected` event would have to:
1. Find the timestamp.
2. Look at `console.error` lines from `pagespeed:` (only emitted on error, not on entry).
3. Guess.

In a multi-tenant or high-volume deployment, "correlate by timestamp" is not a real strategy. A short structured invocation log (without leaking the URL) closes the gap.

## Proposed Solution

Emit a structured invocation log on each handler entry, behind a debug flag:
```ts
if (process.env.PAGESPEED_AUDIT === "1") {
  console.error(`[pagespeed] invoke target=${parsed.hostname} preset=${preset} strategy=${strategy ?? "MOBILE"}`);
}
```

This gives operators a hostname-only audit trail they can correlate with `[injection-defense]` events. Off by default (preserves the privacy posture); SOCs that need it flip the flag.

- **Pros:** Honours the privacy stance. Solves the correlation gap when needed.
- **Cons:** New env var.
- **Effort:** XS
- **Risk:** None.

## Acceptance Criteria

- [x] Opt-in audit log line per `analyze_pagespeed` invocation, hostname-only.
- [x] Documented in CLAUDE.md.
- [x] No log emitted by default (preserves 2.0.1 minimal-logging policy).

## Work Log

- 2026-04-30: Filed during code review.
- 2026-04-30: Resolved. New opt-in audit block in `configs/pagespeed.ts` immediately after the trusted-input parse: when `PAGESPEED_AUDIT === "1"`, emits `[pagespeed] invoke target=<hostname> preset=<preset> strategy=<strategy>` to stderr. Hostname only — full URL, query string, and any embedded auth are intentionally excluded (preserves the privacy posture of `[injection-defense]`). Documented in (a) `CLAUDE.md` `### Prompt-injection observability`, (b) `configs/pagespeed.ts` header `// Environment:` block, (c) `README.md` Environment Variables table. Smoke script unaffected — it only checks for `[injection-defense]` substrings, and the new line only fires under the env flag (which smoke doesn't set).

## Resources

- `CLAUDE.md` `### Prompt-injection observability`
- `src/lib/security/detection-logger.ts` — emitter

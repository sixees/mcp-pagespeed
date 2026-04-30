---
name: Smoke script silently swallows server-side failures
description: scripts/smoke.ts has no spawn error/exit listeners, an over-permissive quota soft-skip, and an unbounded stderr accumulator — multiple paths return success-or-skip when the real signal is "the server died"
type: task
status: pending
priority: p1
issue_id: 002
tags: [code-review, silent-failure, quality]
---

# Smoke script silently swallows server-side failures

## Problem Statement

`scripts/smoke.ts` is the new quality gate for the cherry-pick. The handoff says "smoke harness itself is validated"; this review found three failure modes where the harness reports success or soft-skip while the underlying problem is masked.

## Findings

1. **No `error`/`exit` listeners on `spawn`** — `scripts/smoke.ts:27-37`. If the child process dies before `initialize`, the only signal is the `initialize` timeout (10s). Spawn errors (e.g. `tsx` not found, `ENOENT`) propagate as unhandled `error` events on the child stream. Result: a confusing 10s-timeout error message hides the real cause.

2. **Quota soft-skip is too permissive** — `scripts/smoke.ts:111-122`. The check is:
   ```ts
   const isQuotaExhaustion =
       text.includes("429") &&
       /(quota|rate ?limit)/i.test(text) &&
       !process.env.PAGESPEED_API_KEY;
   ```
   Any error string that happens to contain `429` and the word `quota` or `rate limit` will short-circuit to SKIP. A malformed API response, a downstream proxy error, or even an injection echo in the URL parameter could plausibly trigger this. The soft-skip is the only escape hatch — if it false-positives, smoke will report "passed" on a broken build.

3. **Unbounded stderr accumulator** — `scripts/smoke.ts:32-37`. `stderr` is appended forever; a chatty test run (e.g. detection-logger throttle warnings) over a long-running call could grow it past Node's string limit and crash the harness with an OOM that looks like "harness threw" rather than a server-side bug.

4. **`server.kill()` without exit-code check** — `scripts/smoke.ts:148`. After kill, the harness never reads `child.exitCode` or waits for `'exit'`. If the server was already dying with a non-zero code, that signal is lost.

## Proposed Solutions

### Option A — Wire the missing event listeners
- Add `server.on("error", ...)` and `server.on("exit", ...)` listeners; fail fast on either with the actual reason.
- Tighten quota detection: parse the JSON error envelope from `data.error.code === 429` and `data.error.status === "RESOURCE_EXHAUSTED"` instead of regex-on-stringified-error.
- Cap the stderr buffer at e.g. 64 KB (rotate or drop oldest).
- After `kill()`, await an `'exit'` event and surface the exit code in the failure list.

- **Pros:** Closes all four findings; small, mechanical changes.
- **Cons:** Slightly more code in a script that's intentionally minimal.
- **Effort:** S–M
- **Risk:** Low — additions only, existing assertions unchanged.

### Option B — Replace the soft-skip with a hard requirement
Drop the quota detection entirely; require `PAGESPEED_API_KEY` for `npm run smoke`. CI sets it; local dev sets it.

- **Pros:** Removes the false-positive surface entirely. Smoke becomes a real hard gate.
- **Cons:** Local dev without a key can't run smoke at all.
- **Effort:** S
- **Risk:** Low. Pairs well with the handoff's existing follow-up ("Configure PAGESPEED_API_KEY in CI").

**Recommendation:** Option A for #1, #3, #4 (always-good hardening). For #2, prefer Option B in CI but keep the soft-skip locally — but tighten it to inspect `data.error.code === 429 && data.error.status === "RESOURCE_EXHAUSTED"` so the regex fragility goes away.

## Acceptance Criteria

- [ ] `scripts/smoke.ts` registers `error` and `exit` listeners on the spawned child; either becomes a recorded failure with the reason.
- [ ] Quota detection is structural (envelope-based), not string-based.
- [ ] stderr buffer is bounded; over-cap is itself a failure (signals an unexpectedly chatty server).
- [ ] After `kill()`, the script awaits `'exit'` and reports a non-zero exit code as a failure.
- [ ] `npm run smoke` still passes the soft-skip path in the no-key dev environment.

## Work Log

- 2026-04-30: Filed during code review of `feat/cherry-pick-prompt-injection-defense`.

## Resources

- `scripts/smoke.ts:27-37` — spawn block
- `scripts/smoke.ts:111-122` — quota soft-skip
- `scripts/smoke.ts:148` — kill without exit await
- Handoff "Follow-up work" — "Configure `PAGESPEED_API_KEY` in CI and add `npm run smoke` to the workflow as a hard gate"

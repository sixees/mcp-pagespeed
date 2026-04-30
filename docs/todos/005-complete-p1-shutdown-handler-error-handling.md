---
name: SIGINT/SIGTERM handler swallows shutdown() failures and re-entrancy
description: configs/pagespeed.ts shutdown handler awaits server.shutdown() with no try/catch; if shutdown rejects, the rejection is unhandled, process.exit(0) never runs, and a second signal triggers a parallel shutdown
type: task
status: complete
priority: p1
issue_id: 005
tags: [code-review, typescript, silent-failure, process-lifecycle]
resolved_date: 2026-04-30
resolution: Option A (re-entrancy guard + try/catch + discriminated exit code)
---

# SIGINT/SIGTERM handler swallows shutdown() failures and re-entrancy

## Problem Statement

The signal handler added to `configs/pagespeed.ts:270-276` is:
```ts
const shutdown = async (signal: NodeJS.Signals) => {
  console.error(`[pagespeed] received ${signal}, shutting down`);
  await server.shutdown();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
```

Two issues:

1. **Unhandled rejection.** If `server.shutdown()` throws (e.g. transport already closed, cleanup interval in a partial state), the awaited promise rejects. There is no try/catch, so the process exits with a generic `UnhandledPromiseRejection` warning instead of `process.exit(0)` — and importantly, the operator gets no signal that shutdown was incomplete.

2. **No re-entrancy guard.** Two consecutive `SIGTERM` (e.g. K8s graceful → forced) trigger two parallel `shutdown()` calls. `setInterval` clearing is idempotent, but other library cleanup paths (close transport, flush logs) are not guaranteed to be.

This pairs with the handoff's "Risk areas" note about the boot-time race ("if `server.start()` throws, the handler is never registered") — which is correct, but the *post-registration* failure path was not analysed.

## Findings

- **File:** `configs/pagespeed.ts:270-276`
- **Impact:**
  - Failed shutdowns are invisible (no exit-code differentiation).
  - Container/orchestrator may receive `SIGTERM` then `SIGKILL` because the unhandled rejection path takes longer to surface than the orchestrator's grace window.
  - Re-entrancy could double-call cleanup on a half-torn-down server.

## Proposed Solutions

### Option A — Guard, log, exit with discriminated code
```ts
let shuttingDown = false;
const shutdown = async (signal: NodeJS.Signals) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.error(`[pagespeed] received ${signal}, shutting down`);
  try {
    await server.shutdown();
    process.exit(0);
  } catch (err) {
    console.error(`[pagespeed] shutdown failed:`, err);
    process.exit(1);
  }
};
```

- **Pros:** Closes both findings. Distinct exit code lets orchestrators detect failed graceful shutdown.
- **Cons:** Slightly more code in a small block.
- **Effort:** XS
- **Risk:** Low.

### Option B — Use `process.once` instead of `process.on`
Eliminates re-entrancy by removing the listener after first fire, but doesn't solve the unhandled-rejection problem.

- **Pros:** Tiny change.
- **Cons:** Doesn't address the security-relevant signal (failed shutdown).
- **Effort:** XS
- **Risk:** Doesn't fully solve.

**Recommendation:** Option A. Pair the handlers with a unit test that mocks `server.shutdown()` to reject; assert exit code 1.

## Acceptance Criteria

- [ ] Shutdown handler has try/catch around `await server.shutdown()`.
- [ ] Shutdown handler is re-entrancy safe (second signal is a no-op).
- [ ] Failed shutdown logs the cause and exits with code != 0.
- [ ] Add a fork-side test exercising the failure path (mock the server, send a fake signal, assert exit-code wiring). Ties into todo #012's "`trustedAnalyzedUrl` test gap" theme — both are fork-specific code with no direct coverage.

## Work Log

- 2026-04-30: Filed during code review of `feat/cherry-pick-prompt-injection-defense`.
- 2026-04-30: **Resolved.** Updated `configs/pagespeed.ts:301-315`:
  - **Re-entrancy guard:** module-scoped `let shuttingDown = false` flips on first signal; subsequent signals return early. Eliminates double-call on K8s graceful + forced shutdown.
  - **Try/catch around `server.shutdown()`:** rejection is caught, logged with the error class name (`(err as Error).name` — preserves 2.0.1 minimal-logging policy by not logging the message body), and `process.exit(1)` runs. Orchestrators can now distinguish "graceful shutdown" (exit 0) from "graceful-shutdown attempted, failed" (exit 1).
  - The error log uses `[pagespeed]` bracket prefix (consistent with the existing `received ${signal}` line); the entry/error path of the handler still uses `pagespeed:` colon prefix in other places — that wider convention drift is logged separately under the P3-class observation set but isn't load-bearing here.
  - Test gap acknowledged: no fork-side unit test for the rejection path. Consolidated with todo #012 — the same test file should mock `server.shutdown()` to reject and assert exit code 1.
  - Verification: `npm test` 459 pass / 7 skipped. `npm run typecheck` clean.

## Resources

- `configs/pagespeed.ts:270-276` — the handler
- `src/lib/extensible/mcp-curl-server.ts` — `shutdown()` definition (search for `startInjectionCleanup`)
- Handoff "Risk areas" — third bullet (boot-time race, addressed; post-registration race, *not* addressed)

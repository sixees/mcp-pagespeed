---
name: JSON.parse silent fallback bypasses analyzed_url validation
description: When the API response is auto-saved to file (or returns malformed JSON), pagespeed.ts returns the raw library result and silently skips the trustedAnalyzedUrl re-validation step that the security model relies on
type: task
status: pending
priority: p1
issue_id: 001
tags: [code-review, security, silent-failure]
---

# JSON.parse silent fallback bypasses analyzed_url validation

## Problem Statement

The security boundary in `configs/pagespeed.ts` is `trustedAnalyzedUrl()` — it re-validates that the API-echoed URL (`data.id`) matches the trusted input URL before that field reaches the LLM. CLAUDE.md and CHANGELOG explicitly call this out as the fork's compensating control because `registerCustomTool()` bypasses spotlighting.

But that control only runs **after** `JSON.parse(resultText)` succeeds. The `try { ... } catch { return result; }` block at `configs/pagespeed.ts:208-214` silently skips the entire post-processor — including `trustedAnalyzedUrl()` — and returns the raw library response. Two reachable paths exit through this branch:

1. Response auto-saved to file (>2 MB; the library returns a "saved to /path" string instead of JSON).
2. Truncated / malformed API response (network blip, proxy injection, partial body).

In both, the response that reaches the LLM was sanitized by `processResponse()` for Unicode attack vectors, but **not** validated for echo-attack content. The fork's stated trust model — "compensating control for spotlighting bypass" — does not hold on this path.

## Findings

- **File:** `configs/pagespeed.ts:208-214`
- **Evidence:**
  ```ts
  let data: Record<string, any>;
  try {
    data = JSON.parse(resultText);
  } catch {
    return result; // not JSON (or auto-saved to file), return as-is
  }
  ```
- **Impact:** Silent control bypass on a documented security boundary. The catch block has no logging — operators cannot detect when the fallback path fires.
- Not flagged by builder in handoff "Known issues".

## Proposed Solutions

### Option A — Fail closed
Return an `isError: true` MCP response when JSON parsing fails. The caller (LLM) sees a clear error rather than receiving unvalidated content.

- **Pros:** Honours the trust boundary; matches the existing API-error path at `configs/pagespeed.ts:217-238`.
- **Cons:** A future "auto-save to file" code path (>2 MB response) becomes user-visible failure rather than a silent passthrough.
- **Effort:** S
- **Risk:** Low — current `maxResultSize: 2_000_000` is generous; PageSpeed responses are typically 200–800 KB.

### Option B — Log and pass through
Emit an `[injection-defense] [hostname] FallbackUnvalidated` stderr line, then return `result`. Documents the bypass without changing behaviour.

- **Pros:** Backwards-compatible.
- **Cons:** Still ships unvalidated content to the LLM. Logging a control bypass is observability theatre if the bypass itself is the bug.
- **Effort:** S
- **Risk:** Same exposure remains.

### Option C — Detect auto-save explicitly, fail-closed on others
Inspect `result.content` for the library's auto-save sentinel (path response). If auto-save: pass through with a warning. If neither JSON nor auto-save: fail closed.

- **Pros:** Discriminates between the legitimate path (auto-save) and the suspicious path (truncation/injection).
- **Cons:** Couples to library internals (the auto-save format string).
- **Effort:** M
- **Risk:** Library format string could change upstream.

**Recommendation:** Option A. The security model in CLAUDE.md says re-validation is the compensating control; failing closed is the only behaviour consistent with that claim. The auto-save path (>2 MB) is unreachable today (max response ≈1 MB) and can be revisited if it becomes real.

## Acceptance Criteria

- [ ] JSON parse failure returns `isError: true` with a generic error string (no raw response leakage; preserve 2.0.1 minimal-logging policy).
- [ ] A unit test in `configs/pagespeed.test.ts` (new) covers the parse-failure branch and asserts `trustedAnalyzedUrl` was not bypassed.
- [ ] Manual smoke: simulate by piping a non-JSON response through the handler — confirm `isError: true`.
- [ ] CLAUDE.md "Prompt-injection observability" section updated if behaviour text changes.

## Work Log

- 2026-04-30: Filed during code review of `feat/cherry-pick-prompt-injection-defense`.

## Resources

- `configs/pagespeed.ts:62-82` — `trustedAnalyzedUrl()` definition
- `configs/pagespeed.ts:208-214` — silent fallback branch
- `CLAUDE.md` `## Security` — claimed trust model
- `CHANGELOG.md` 3.1.1 — "Spotlighting decision" bullet

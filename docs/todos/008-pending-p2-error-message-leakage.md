---
name: data.error.message surfaced verbatim to LLM regresses 2.0.1 minimal-logging policy
description: configs/pagespeed.ts forwards Google's raw error.message into the tool response — for non-rate-limit errors this can include URL fragments, headers, or path details the 2.0.1 changelog explicitly committed not to leak
type: task
status: pending
priority: p2
issue_id: 008
tags: [code-review, security, observability]
---

# data.error.message surfaced verbatim regresses 2.0.1 minimal-logging policy

## Problem Statement

`configs/pagespeed.ts:217-238` forwards Google's raw error message to the LLM:
```ts
text: `Error: PageSpeed API returned ${code}: ${message}${hint}`
```

The 2.0.1 CHANGELOG explicitly committed to **minimal error logging** ("Server-side `console.error` now logs only `[hostname]` or `[filename]` with error class name"). The user-facing message gets the rate-limit hint stripped to a generic suggestion, but everything else (`message`) is forwarded verbatim. Examples that have appeared in PageSpeed responses:

- `Lighthouse returned error: NO_LCP` (benign)
- `Unable to fetch <full-URL-with-tracking-params>` (URL leakage to LLM)
- `User <full-email>@<domain> has insufficient permissions` (PII leakage in OAuth scenarios)

The `console.error(`pagespeed: API error ${code}: ${message}`)` line on the same code path is the operator-side leak — same content, just to stderr.

## Findings

- **File:** `configs/pagespeed.ts:217-238`
- **Trust boundary:** This is the error path; it bypasses `trustedAnalyzedUrl()`. Whatever's in `message` reaches the LLM unfiltered.
- The `message` is *not* sanitized — `processResponse()` runs on the success path, but the error envelope path at `data.error` is parsed JSON from the same response and skips sanitization.

## Proposed Solutions

### Option A — Generic error class + opt-in detail
Default to a class-of-error string:
```ts
const userMessage = code === 429 ? "PageSpeed API rate-limited; set PAGESPEED_API_KEY for higher quota."
  : code === 400 ? "PageSpeed API rejected the request (likely invalid URL)."
  : "PageSpeed API returned an error.";
```
Operator-side log keeps `code` only (no message); detail goes only to stderr behind a `PAGESPEED_DEBUG` env var.

- **Pros:** Restores 2.0.1 policy. Hides Google's API surface from the LLM.
- **Cons:** Some debug scenarios get harder.
- **Effort:** S
- **Risk:** Low.

### Option B — Sanitize the message before forwarding
Run the `message` through the same `sanitizeResponse()` that the success path uses, then through a regex stripper (drop URLs, emails).

- **Pros:** Less invasive.
- **Cons:** Sanitize doesn't strip URLs or PII — only Unicode attack vectors and whitespace. Need additional stripping. More moving parts.
- **Effort:** M
- **Risk:** Easy to miss a leak class.

**Recommendation:** Option A. The 2.0.1 policy already established the precedent.

## Acceptance Criteria

- [ ] Tool response on the error path emits a class-of-error string (no Google-supplied content).
- [ ] Stderr log on the error path emits `pagespeed: API error <code>` with no `message` (or behind `PAGESPEED_DEBUG`).
- [ ] CHANGELOG bullet documents the policy continuity.

## Work Log

- 2026-04-30: Filed during code review.

## Resources

- `configs/pagespeed.ts:217-238`
- `CHANGELOG.md` `## [2.0.1] - 2026-02-17` — Minimal error logging

---
status: pending
priority: p2
issue_id: "001"
tags: [code-review, quality, security, testing]
---

# Missing unit tests for `httpOnlyUrl()`

## Problem Statement

`src/lib/utils/url.ts` exports a new `httpOnlyUrl()` helper that enforces http/https scheme restriction at the Zod schema layer. This function has security-adjacent behavior (scheme enforcement) but ships with zero test coverage. The co-located `url.test.ts` file tests only `resolveBaseUrl`.

The function's correctness depends on Zod v4's WHATWG URL normalisation happening *before* `.refine()` runs (so that `javascript:alert(1)` is rejected by `z.url()` before the split-on-colon predicate even runs). This assumption is undocumented in tests, meaning a future Zod version could silently change behavior without any test failure.

## Findings

**Location:** `src/lib/utils/url.ts:21-26` + `src/lib/utils/url.test.ts`

```typescript
export function httpOnlyUrl(description: string) {
    return z.url().refine(
        (url) => ["http", "https"].includes(url.split(":")[0].toLowerCase()),
        { message: "URL must use http or https scheme" }
    ).describe(description);
}
```

`url.test.ts` has 7 tests for `resolveBaseUrl` and zero for `httpOnlyUrl`.

## Proposed Solution

Add a `describe("httpOnlyUrl", ...)` block to `src/lib/utils/url.test.ts` covering:

**Valid inputs (should pass):**
- `http://example.com`
- `https://example.com`
- `https://example.com/path?query=1`

**Invalid scheme (should fail with "URL must use http or https scheme"):**
- `ftp://example.com`
- `data:text/html,<h1>test</h1>`
- `file:///etc/passwd`

**Invalid URL (should fail at `z.url()` level, not scheme level):**
- `not-a-url`
- `javascript:alert(1)` — documents that Zod v4 WHATWG rejection handles this before `.refine()` runs

## Acceptance Criteria

- `url.test.ts` includes a `httpOnlyUrl` describe block with at least 6 test cases
- All cases document whether failure is at `z.url()` or `.refine()` layer
- `npm test` continues to pass

## Work Log

<!-- Add entries when work begins -->

## Resources

- Implementation: `src/lib/utils/url.ts:21-26`
- Test file: `src/lib/utils/url.test.ts`

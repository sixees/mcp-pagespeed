---
name: Duplicate URL parsing across handler and trustedAnalyzedUrl
description: configs/pagespeed.ts parses the input URL three times — once for protocol validation, once inside trustedAnalyzedUrl, once when constructing the API URL — each with its own try/catch. Single source of truth missing
type: task
status: pending
priority: p2
issue_id: 013
tags: [code-review, spr-dry, quality]
---

# Duplicate URL parsing across handler and trustedAnalyzedUrl

## Problem Statement

The handler parses the input URL in three different places:

1. **Validation** (`configs/pagespeed.ts:153-173`) — `new URL(url)` to check protocol.
2. **API URL construction** (`configs/pagespeed.ts:176-181`) — `new URL(...)` to build the outbound request.
3. **Trust validation** (`configs/pagespeed.ts:62-82`) — `new URL(inputUrl)` (and `new URL(echoed)`) inside `trustedAnalyzedUrl`.

Each has its own try/catch (or implicit throw). Each could parse slightly differently if URL encoding differs (e.g. `URL.toString()` re-encoding). The "validated" URL from step 1 is discarded and re-parsed in step 3.

This is a SRP/DRY smell that becomes a security smell: the *trusted* URL the security helper compares against may not be byte-equal to the *validated* URL the handler accepted.

## Findings

- **File:** `configs/pagespeed.ts:62-82, 153-173, 176-181`
- **Repeated logic:** three `new URL(...)` parses of the same string with three error semantics.

## Proposed Solution

Parse once at the top of the handler, pass the URL object through:
```ts
let parsed: URL;
try {
  parsed = new URL(url);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return errorResponse("Only http and https URLs are supported.");
  }
} catch {
  return errorResponse("Invalid URL provided.");
}

// Use parsed.toString() for trustedAnalyzedUrl, apiUrl construction, etc.
const trustedInput = parsed.toString();
```

Then `trustedAnalyzedUrl` takes `URL | string` and the API URL builder uses `parsed.origin + parsed.pathname + parsed.search`.

- **Pros:** Single parse, single normalization, single error path.
- **Cons:** Mild plumbing change.
- **Effort:** S
- **Risk:** Low.

## Acceptance Criteria

- [ ] `new URL(<input>)` is called once in the handler.
- [ ] All downstream consumers use the parsed URL object (or its canonical `.toString()`).
- [ ] No behavioural change — same validation outcome, same outbound API URL, same trust-comparison result.

## Work Log

- 2026-04-30: Filed during code review.

## Resources

- `configs/pagespeed.ts:62-82` — `trustedAnalyzedUrl`
- `configs/pagespeed.ts:153-173` — validation block
- `configs/pagespeed.ts:176-181` — API URL build

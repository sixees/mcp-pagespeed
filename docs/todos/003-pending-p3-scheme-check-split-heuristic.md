---
status: pending
priority: p3
issue_id: "003"
tags: [code-review, quality, security]
dependencies: ["002"]
---

# Scheme check uses `split(":")` heuristic instead of `new URL().protocol`

## Problem Statement

The http/https scheme enforcement in all three Zod refinement sites uses:

```typescript
(url) => ["http", "https"].includes(url.split(":")[0].toLowerCase())
```

The SSRF layer at `src/lib/security/ssrf.ts` uses the more robust form:

```typescript
["http:", "https:"].includes(new URL(url).protocol)
```

The `split(":")`  approach is safe *today* because `z.url()` in Zod v4 normalises the input via WHATWG URL parsing before `.refine()` runs, so schemes are already lowercased and `javascript:` has been rejected. However, this is an implicit dependency on Zod v4's normalisation behaviour — the split predicate is correct only because of what runs before it.

This is not currently exploitable, but it's a fragile pattern that differs from the SSRF layer's approach and could become a gap if Zod's pre-normalisation changes in a future version.

## Findings

All three refinement sites (see also todo `002`):
- `src/lib/utils/url.ts:23`
- `src/lib/server/schemas.ts:14`
- `src/lib/schema/validator.ts:91`

The SSRF layer's safer pattern (already used in the codebase):
```typescript
// src/lib/security/ssrf.ts (existing, correct form)
const scheme = new URL(url).protocol;  // returns "http:" or "https:" with colon
```

## Proposed Solution

Replace the split heuristic with the `new URL().protocol` form in `httpOnlyUrl()` (and the two inline sites, ideally after resolving todo `002`):

```typescript
export function httpOnlyUrl(description: string) {
    return z.url().refine(
        (url) => {
            try {
                return ["http:", "https:"].includes(new URL(url).protocol);
            } catch {
                return false;
            }
        },
        { message: "URL must use http or https scheme" }
    ).describe(description);
}
```

The `try/catch` is defensive — at this point `z.url()` has already accepted the URL, so `new URL()` should not throw, but it makes the intent explicit.

**Pros:** Consistent with SSRF layer; no implicit Zod normalisation dependency
**Cons:** Slightly more verbose; `try/catch` may feel redundant given prior `z.url()` validation
**Effort:** Tiny
**Risk:** None — semantically identical for all inputs that reach this code

## Acceptance Criteria

- All refinement sites use `new URL(url).protocol` form (or delegate through `httpOnlyUrl()`)
- `npm test` passes
- New `httpOnlyUrl` test cases (todo `001`) exercise this path

## Work Log

<!-- Add entries when work begins -->

## Resources

- SSRF layer (reference implementation): `src/lib/security/ssrf.ts`
- `httpOnlyUrl` helper: `src/lib/utils/url.ts:21`

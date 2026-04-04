---
status: pending
priority: p2
issue_id: "002"
tags: [code-review, quality, spr-dry, security]
dependencies: ["001"]
---

# DRY violation: `httpOnlyUrl()` helper exists but is not used in `schemas.ts` or `validator.ts`

## Problem Statement

`httpOnlyUrl()` was introduced to centralise http/https scheme enforcement at the Zod schema layer. However, two other files define the same `z.url().refine(scheme check)` pattern inline rather than using the helper:

- `src/lib/server/schemas.ts:11-18` — `CurlExecuteSchema.url`
- `src/lib/schema/validator.ts:90-93` — `ApiInfoSchema.baseUrl`

The plan's acceptance criterion explicitly required `CurlExecuteSchema.url` to use `httpOnlyUrl()`. This criterion was not met. The handoff acknowledges the divergence but attributes it to "upstream's choice" — however, the acceptance criteria applied to this fork's code, not upstream's.

Three independent copies of the same logic mean that a future change (e.g., adding `ftp:` to the allowed list, or updating the error message, or switching from the split heuristic to `new URL().protocol`) would need to be applied in three places. The risk is divergence over time.

## Findings

### Site 1: `src/lib/server/schemas.ts:11-18`
```typescript
url: z.url("Must be a valid URL")
    .refine(
        (url) => {
            const scheme = url.split(":")[0].toLowerCase();
            return ["http", "https"].includes(scheme);
        },
        { message: "URL must use http or https scheme" }
    )
    .describe("The URL to request"),
```

### Site 2: `src/lib/schema/validator.ts:90-93`
```typescript
baseUrl: z.url("Base URL must be a valid URL").refine(
    (url) => ["http", "https"].includes(url.split(":")[0].toLowerCase()),
    { message: "Base URL must use http or https scheme" }
),
```

### Helper (defined but underused): `src/lib/utils/url.ts:21-26`
```typescript
export function httpOnlyUrl(description: string) {
    return z.url().refine(
        (url) => ["http", "https"].includes(url.split(":")[0].toLowerCase()),
        { message: "URL must use http or https scheme" }
    ).describe(description);
}
```

Note: The `z.url("custom message")` Zod v4 syntax sets the error message for when the URL itself is invalid (not for the scheme refinement). This differs from `httpOnlyUrl()` which uses bare `z.url()`. Migration must verify the error message contracts (as reported by `schemas.test.ts`) do not change.

## Proposed Solutions

### Option A: Migrate both sites to `httpOnlyUrl()` (Recommended)
**Pros:** Single source of truth; plan acceptance criterion met; future changes in one place
**Cons:** Must verify error message contracts; `schemas.ts` uses `z.url("Must be a valid URL")` for the URL-validity error — this message may need to be preserved separately
**Effort:** Small
**Risk:** Low — same security semantics; only error message strings change

**For `schemas.ts`:**
```typescript
url: httpOnlyUrl("The URL to request"),
// Note: Zod v4 z.url() uses a default error message when URL is invalid.
// If the "Must be a valid URL" message is tested, adjust httpOnlyUrl() to accept it
// or test both sites under the new error text.
```

**For `validator.ts`:**
```typescript
baseUrl: httpOnlyUrl("Base URL"),
// If "Base URL must be a valid URL" is tested, same consideration applies.
```

### Option B: Add cross-reference comments, defer migration
**Pros:** No error-message risk; documents intent
**Cons:** DRY violation remains; plan criterion still unmet
**Effort:** Tiny
**Risk:** None

Add to each inline site:
```typescript
// TODO: consolidate with httpOnlyUrl() in utils/url.ts — see docs/todos/002-pending-p2-dry-httponly-url-not-reused.md
```

## Acceptance Criteria

- Either: both `schemas.ts` and `validator.ts` import and use `httpOnlyUrl()` from `utils/url.ts`
- Or: both sites have a comment pointing to `httpOnlyUrl()` with a rationale for not using it
- `npm test` continues to pass
- `npx tsc --noEmit --skipLibCheck --module nodenext --moduleResolution nodenext --target esnext --allowImportingTsExtensions configs/pagespeed.ts` continues to pass

## Work Log

<!-- Add entries when work begins -->

## Resources

- Helper: `src/lib/utils/url.ts:21`
- Schemas: `src/lib/server/schemas.ts:11`
- Validator: `src/lib/schema/validator.ts:90`
- Plan acceptance criterion: `docs/plans/2026-04-04-feat-upgrade-upstream-mcp-curl-3-0-0-plan.md` — criterion #10
- Handoff note: `docs/work/handoff-feat-upgrade-upstream-3.0.0.md` — "CurlExecuteSchema.url uses inline .refine() not httpOnlyUrl()"

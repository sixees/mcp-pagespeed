---
status: complete
priority: p3
issue_id: 007
tags: [code-review, typescript, security, robustness]
dependencies: []
---

# Replace `Record<string, any>` API response with a narrow Zod schema

## Problem Statement

`configs/pagespeed.ts:191` declares the parsed PageSpeed API response as
`Record<string, any>`, and CLAUDE.md justifies this as "external API with
version-dependent shape". The handler then re-checks `typeof`/`Array.isArray`
on every field it reads — `data.error.code`, `data.error.status`,
`data.error.errors`, `data.error.message`, `data.lighthouseResult`, etc.

A single Zod `safeParse()` at the JSON-parse boundary would replace ~25 lines
of manual narrowing with one boundary-validated object. The `.passthrough()`
modifier handles version drift (Google adds new fields without breaking ours).

This is the single most security-relevant boundary in the handler — exactly
where Zod parsing pays off. Currently flagged as P3 because the manual narrowing
is correct; promoting to P2 if any future field-shape regression slips through.

## Findings

`configs/pagespeed.ts:191-220`:
```typescript
let data: Record<string, any>;
try {
  data = JSON.parse(resultText);
} catch { /* ... */ }

if (data.error && typeof data.error === "object") {
  const code = Number(data.error.code) || 0;
  const status =
    typeof data.error.status === "string" ? data.error.status : undefined;
  const errors = Array.isArray(data.error.errors)
    ? (data.error.errors as Array<{ reason?: string }>)
    : undefined;
  // ...
}
```

## Proposed Solutions

### Option A: narrow Zod schema with `.passthrough()`

```typescript
const PageSpeedResponseSchema = z.object({
  error: z
    .object({
      code: z.number().optional(),
      status: z.string().optional(),
      message: z.string().optional(),
      errors: z.array(z.object({ reason: z.string().optional() }).passthrough()).optional(),
    })
    .passthrough()
    .optional(),
  lighthouseResult: z.unknown().optional(),
  id: z.string().optional(),
}).passthrough();
```

- Pros: replaces ~25 lines of guard code with one `safeParse`; fields land typed.
- Cons: small one-time schema definition.
- Effort: S.

### Option B: leave as-is

- Status quo. Acceptable; CLAUDE.md documents the trade-off.

**Recommendation:** Option A as a follow-up.

## Acceptance Criteria

- [ ] `data` is the result of a Zod `safeParse` at the JSON boundary.
- [ ] `data.error.code` etc. land as typed fields, not `any`.
- [ ] `npm test` passes (495+).
- [ ] Schema annotated with a comment justifying `.passthrough()` (version drift tolerance).

## Resources

- Review finding: typescript-reviewer (P2)
- Existing CLAUDE.md design decision: `Record<string, any>` for API response

## Work Log

**2026-05-01** — Option A executed.
- `configs/pagespeed-helpers.ts`: added `PageSpeedResponseSchema` (Zod)
  with `.passthrough()` on the root object, the `error` subobject, and
  every entry of `error.errors`. Documented why `lighthouseResult` is left
  as `z.unknown().optional()` (extractors walk it leniently with `?.`/`??`).
  Exported `PageSpeedResponse` type alias.
- `configs/pagespeed-helpers.ts`: narrowed `buildTrustedMeta` from
  `data: Record<string, any>` to `data: { id?: unknown }`. Both the existing
  `Record<string, any>` test fixtures and the new Zod-typed call site are
  assignable.
- `configs/pagespeed.ts`: replaced the `JSON.parse → Record<string, any>`
  block with `JSON.parse → PageSpeedResponseSchema.safeParse → fail-closed
  branch`. The `.success === false` path returns the existing trust-model
  error message ("unexpected response shape") with the same minimal-logging
  policy as the non-JSON branch.
- `configs/pagespeed.ts`: dropped the `typeof`/`Array.isArray` narrowing
  on `data.error.code/status/errors/message`. Zod hands those through as
  typed optional fields, so the handler now reads `data.error.code ?? 0`
  directly.
- `configs/pagespeed.ts`: kept the `lighthouseResult` runtime guard
  (`!data.lighthouseResult || typeof !== "object"`) because Zod gives
  back `unknown`; cast to `Record<string, any>` at the extractor call site.
- `configs/pagespeed-helpers.test.ts`: added 9 new tests covering
  minimal/typical/error-shape/version-drift/array-root/wrong-typed-id/
  wrong-typed-error-code cases. Total tests now 504 passing.
- Quality gate: `npm run typecheck` clean, `npm test` 504/504 passing,
  `npm run build` clean (`dist/lib.js` 301 B, schema 663 B).

All acceptance criteria met.

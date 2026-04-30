---
status: pending
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

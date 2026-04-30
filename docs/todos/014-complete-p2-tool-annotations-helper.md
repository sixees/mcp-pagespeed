---
name: Inline tool annotations object should use library helper
description: configs/pagespeed.ts hardcodes annotations: { readOnlyHint: true, openWorldHint: true } — mcp-curl exposes getMethodAnnotations() which derives these from the HTTP method, keeping the metadata source-of-truth in one place
type: task
status: complete
priority: p2
issue_id: 014
tags: [code-review, patterns, spr-dry]
resolved_date: 2026-04-30
resolution: annotations now use `getMethodAnnotations("GET")` from the mcp-curl/schema subpath export. Inline `{ readOnlyHint, openWorldHint }` removed. Single source of truth restored.
---

# Inline tool annotations should use the library helper

## Problem Statement

`configs/pagespeed.ts:140-143` defines tool annotations inline:
```ts
annotations: {
  readOnlyHint: true,
  openWorldHint: true,
},
```

The `mcp-curl` library exposes `getMethodAnnotations(method)` (in `src/lib/types/public.ts` and re-exported) that returns the canonical annotations for an HTTP method. Using it would:
- Keep the read-only / open-world classification consistent with the rest of the library's tools.
- Pick up future additions (e.g. `idempotentHint`) without touching the fork config.
- Match the library convention used in `src/lib/extensible/mcp-curl-server.ts` for built-in tools.

## Findings

- **File:** `configs/pagespeed.ts:140-143`
- **Library equivalent:** `getMethodAnnotations("GET")` returns the canonical set.

## Proposed Solution

```ts
import { ..., getMethodAnnotations } from "mcp-curl";

server.registerCustomTool(
  endpoint.id,
  {
    title: endpoint.title,
    description,
    inputSchema,
    annotations: getMethodAnnotations("GET"),
  },
  ...
);
```

- **Pros:** Single source of truth; survives library updates; matches the rest of the codebase.
- **Cons:** None.
- **Effort:** XS
- **Risk:** Trivial — verify export name and ensure `readOnlyHint` and `openWorldHint` are still set after the swap.

## Acceptance Criteria

- [x] `getMethodAnnotations("GET")` (or equivalent) replaces the inline object.
- [x] No behavioural change in the registered tool's metadata.

## Work Log

- 2026-04-30: Filed during code review.
- 2026-04-30: Resolved. The helper lives in `src/lib/schema/index.ts:39` and is exposed via the `mcp-curl/schema` subpath (per `package.json` exports field). `configs/pagespeed.ts:21` imports `getMethodAnnotations` from `mcp-curl/schema`; `configs/pagespeed.ts:82` now sets `annotations: getMethodAnnotations("GET")`. No behavioural change — `getMethodAnnotations("GET")` returns `{ readOnlyHint: true, openWorldHint: true }` (verified). The fork stays aligned with library convention so future `idempotentHint` etc. additions land for free.

## Resources

- `configs/pagespeed.ts:140-143`
- `src/lib/types/public.ts` — helper definition (verify export path)

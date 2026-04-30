---
status: pending
priority: p2
issue_id: 003
tags: [code-review, architecture, naming, technical-debt]
dependencies: []
---

# Rebrand internal `mcp-curl`-named symbols

## Problem Statement

The package was renamed `mcp-curl` → `mcp-pagespeed`, but several internal
symbols were intentionally left untouched because:

1. The class rename is invasive (test fixtures, JSDoc, ~30+ files).
2. The `User-Agent: mcp-curl/${VERSION}` string may be recognised by Google's
   PageSpeed API rate-limiter; changing it has behavioural risk.
3. The session prefix `mcp-curl-` shows up in temp-dir paths and log lines.

The handoff documents this as deliberate. The architecture review accepts the
trade-off but flags risk: the longer the mismatch sits, the more new code
accretes around `McpCurlServer` and the harder the rename gets.

## Findings

| Symbol | Location |
|--------|----------|
| `class McpCurlServer` | `src/lib/extensible/mcp-curl-server.ts` (file + class name) |
| `type McpCurlConfig` | `src/lib/types/public.ts` |
| `User-Agent: mcp-curl/${SERVER.VERSION}` | `src/lib/config/defaults.ts:8` |
| Session prefix `"mcp-curl-"` | `src/lib/config/session.ts:28` |
| Temp-dir prefix | derived from session prefix |
| Test fixtures and JSDoc | scattered (`grep -ri "mcp-curl\|McpCurl" src/`) |

## Proposed Solutions

### Option A: type alias only (cheapest)
```typescript
// src/lib/index.ts
export { McpCurlServer } from "./extensible/index.js";
export type { McpCurlServer as PageSpeedServer } from "./extensible/index.js";
```
Lets `configs/pagespeed.ts` read `new PageSpeedServer()` while the underlying
class stays — pure type-level rename, zero runtime impact, zero test churn.
- Pros: tiny diff, no behavioural risk, immediate readability win at the
  consumer site.
- Cons: cosmetic — the underlying file/class is still misnamed.
- Effort: XS.

### Option B: full rename, preserve User-Agent
- `mv src/lib/extensible/mcp-curl-server.ts → server.ts` (file + class).
- Keep `User-Agent: mcp-curl/${VERSION}` constant under a new name (rate-limiter risk too high to change).
- Update session prefix to `mcp-pagespeed-` (low-risk; affects temp dir naming only).
- Sweep test fixtures.
- Pros: complete decoupling at the symbol level.
- Cons: ~30+ file diff; risk of breaking grep-based tooling that assumes the prefix.
- Effort: M.

### Option C: stage the rename
- PR #1: Option A (type alias) — instant readability fix.
- PR #2: rename file + class (delete old export at the same time).
- PR #3: rename session prefix.
- PR #4: rename User-Agent (only after measuring against PageSpeed API rate-limiter behaviour).
- Pros: each PR is reviewable in isolation; rate-limiter risk is contained.
- Cons: four PRs of cleanup; momentum risk.
- Effort: M total.

**Recommendation:** Option A immediately, Option C as the longer-term path.
Option A unblocks readers without taking on any operational risk.

## Acceptance Criteria

- [ ] `configs/pagespeed.ts` can `import { PageSpeedServer } from "mcp-pagespeed"`.
- [ ] `npm test` clean.
- [ ] `User-Agent` constant explicitly tagged with a comment explaining why
      it's intentionally pinned to `mcp-curl/`.

## Resources

- Review findings: architecture-strategist, typescript-reviewer (both flagged the brand mismatch).
- Handoff: `docs/work/handoff-chore-decouple-from-mcp-curl.md` "Known issues".

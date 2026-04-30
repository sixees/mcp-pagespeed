---
status: pending
priority: p2
issue_id: 001
tags: [code-review, architecture, simplicity, spr-dry]
dependencies: []
---

# Trim `src/lib/index.ts` barrel surface to actual consumer needs

## Problem Statement

The vendored library at `src/lib/` is now `private: true` and consumed only by
`configs/pagespeed.ts`. Yet `src/lib/index.ts` and `src/lib.ts` still re-export
the broad public-API shape that existed when the package was a publishable
mcp-curl library with three example consumers under `examples/`.

`configs/pagespeed.ts` uses **6 symbols** total:
- `McpCurlServer`, `loadApiSchema`, `generateInputSchema`, `getAuthConfig`,
  `ApiSchema` (from `"mcp-pagespeed"` → `src/lib.ts`)
- `getMethodAnnotations` (from `"mcp-pagespeed/schema"`)

The barrels expose ~14 named symbols and ~9 type aliases. The Stability section
in `src/lib/README.md` says *"prefer changes that keep the surface area small"*
— this is the cheapest first cut.

## Findings

| Source | Detail |
|--------|--------|
| `src/lib/index.ts:11-45` | Re-exports `httpOnlyUrl`, `CurlExecuteSchema`, `JqQuerySchema`, `executeCurlRequest`, `executeJqQuery`, `createServer`, `registerAllResources`, `registerAllPrompts`, `createApiServer`, `createApiServerSync` — none used by `configs/`. |
| `src/lib.ts:7-71` | Same story for the `.` entry: surfaces `validateApiSchema`, `loadApiSchemaFromString`, `registerEndpointTools`, `generateToolDefinitions`, `ApiSchemaValidator`, `buildUrl` — none reached for in `configs/`. |
| `package.json:18-21` | `./lib` subpath exists but has no in-tree consumer; could be dropped from `#exports`. |
| `dist/lib.js` | Eagerly imports `chunk-7XRLVBRW.js` (rate-limit, jq, curl-execute internals) via the barrel even though only McpCurlServer + the schema loader is exercised at runtime. |

## Proposed Solutions

### Option A: trim both barrels to actually-imported symbols
- Keep only the 6 symbols + matching types (`McpCurlServer`, `CustomToolMeta`,
  `loadApiSchema`, `generateInputSchema`, `getAuthConfig`, `ApiSchema`,
  `getMethodAnnotations`).
- Drop `./lib` from `package.json#exports` if no longer reachable.
- Pros: smallest cold-start, smallest documented surface, easiest future fold-into-`configs/`.
- Cons: any future tool added to `configs/` may need to add an import.
- Effort: S (mechanical edits + dist rebuild).
- Risk: low — sweep with `tsc --noEmit` then `npm test` covers it.

### Option B: keep barrels, mark all non-consumed exports `@internal`
- Add `@internal` JSDoc to every export not currently used by `configs/`.
- Pros: no behavioural change, tooling-level documentation.
- Cons: doesn't shrink the eager-import graph; barrel still pulls everything.
- Effort: XS.

### Option C: collapse the two entry points
- Delete `src/lib.ts`, point `package.json#main` at `src/lib/index.ts`.
- Pros: one barrel, one source of truth.
- Cons: invasive — changes every consumer's import contract; touches dist layout
  and `tsup.config.ts`. Beyond a routine cleanup.
- Effort: M.

**Recommendation:** Option A. Land in a follow-up PR (not the decoupling pass)
so the diff is unmistakable: barrel trimming, no functional change.

## Acceptance Criteria

- [ ] `src/lib/index.ts` and `src/lib.ts` re-export only the symbols
      `configs/pagespeed.ts` and existing tests need.
- [ ] `npm test` passes (495+).
- [ ] `npm run typecheck` clean.
- [ ] `npm run build` clean; `dist/lib.js` no longer eagerly pulls
      `executeCurlRequest`/`createServer`/`registerAll*`.
- [ ] `package.json#exports` reviewed; remove unused subpaths.

## Resources

- `src/lib/README.md` Stability section
- Review findings: code-simplicity-reviewer, architecture-strategist,
  performance-oracle (all flagged this independently)

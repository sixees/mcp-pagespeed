# Work Handoff: Upgrade to upstream mcp-curl 3.0.1

**Date:** 2026-04-04 | **Branch:** feat/upgrade-upstream-3.0.0 | **Plan:** docs/plans/2026-04-04-feat-upgrade-upstream-mcp-curl-3-0-0-plan.md | **Status:** complete

## Summary

Merged `upstream/main` (mcp-curl 3.0.1) into the pagespeed fork using `--allow-unrelated-histories` (the fork has no shared git ancestor with upstream — it was seeded from a flat import). The merge brings Zod v3 → v4 and MCP SDK 1.12.0 → 1.29.0 into the fork's `src/` library code automatically. The only fork-specific code change was a one-line handler signature fix in `configs/pagespeed.ts`. All 330 tests pass; build is clean with zero deprecation warnings.

## What was implemented

### Merge + conflict resolution

- **What:** Ran `git merge upstream/main --allow-unrelated-histories` and resolved all add/add conflicts
- **Key files resolved:**
  - `.gitignore` — manually merged: kept fork's `!configs/pagespeed.ts` and `!configs/pagespeed.yaml` negation lines; added upstream's `# Runtime output /output` section
  - `package.json` — took upstream wholesale (version 3.0.1; name/description unchanged — both sides had identical values)
  - `package-lock.json` — deleted; regenerated via `npm install`
  - `CLAUDE.md` — kept fork's version (describes mcp-pagespeed, not mcp-curl)
  - `CHANGELOG.md`, `README.md` — took upstream versions
  - `src/**` — took upstream for all `src/` files (Zod v4 + SDK 1.29.0 fixes already applied there)
  - `docs/todos/` — kept fork's versions (fork-specific work items)
- **Approach:** Bulk `git checkout --theirs` for `src/`, `dist/`, docs; `git checkout --ours` for `CLAUDE.md` and `docs/todos/`; manual merge for `.gitignore`

### Dependency upgrade

- **What:** `npm install` to install Zod v4 + MCP SDK 1.29.0; `npm audit fix` to resolve 7 vulnerabilities
- **Vulnerabilities fixed:** hono, @hono/node-server, path-to-regexp, picomatch, qs, rollup, ajv — all in transitive deps of MCP SDK's HTTP transport and build tooling; all auto-fixable

### `configs/pagespeed.ts` handler signature fix

- **What:** Changed `async (args) =>` to `async (args, _extra) =>` at line 116
- **Why:** MCP SDK 1.29.0 changed `ToolCallback`'s second parameter from optional (`extra?`) to required (`extra`)
- **Key files:** `configs/pagespeed.ts:116`
- **Preserved:** The inline `new URL()` protocol guard at lines 124–144 (http/https enforcement before `executeRequest`) was intentionally left untouched

### Upstream src/ changes (came via merge)

| File | Change |
|---|---|
| `src/lib/server/schemas.ts` | `z.record(z.string(), z.string())` (two-arg); `z.url()` + `.refine()` for http/https |
| `src/lib/schema/validator.ts` | Same z.record + z.url fixes |
| `src/lib/utils/url.ts` | New `httpOnlyUrl()` helper export |
| `src/lib/prompts/api-discovery.ts` | Uses `httpOnlyUrl()` via import |
| `src/lib/prompts/api-test.ts` | Uses `httpOnlyUrl()` via import |
| `src/lib/extensible/tool-wrapper.ts` | `extra` non-optional; `ToolCallback` casts removed |
| `src/lib/schema/generator.ts` | `extra` non-optional in handler types (×3) |

New test files from upstream: `api-discovery.test.ts`, `api-test.test.ts`, `schemas.test.ts`

## Key decisions

| Decision | Reasoning | Alternatives considered |
|----------|-----------|------------------------|
| Take upstream wholesale for `src/` | Fork had not modified src/ — all Zod v4 fixes are in upstream | Manual cherry-pick per file (unnecessary complexity) |
| Delete and regenerate `package-lock.json` | Unrelated histories produce unresolvable lockfile conflicts | Manual resolution (error-prone, rejected by plan) |
| Keep fork `CLAUDE.md` | Fork's CLAUDE.md describes mcp-pagespeed, not mcp-curl | Take upstream CLAUDE.md (would lose all fork-specific guidance) |
| Take upstream CHANGELOG/README | Simpler; fork doesn't maintain a separate changelog | Merge both histories (unnecessary complexity for a private fork) |
| `npm audit fix` (not `--force`) | All 7 vulnerabilities had non-breaking patches available | Accept vulnerabilities as-is (explicitly rejected by plan) |

## What to pay attention to during review

**Risk areas:**

- **`.gitignore` manual merge** — the two negation lines `!configs/pagespeed.ts` and `!configs/pagespeed.yaml` were hand-merged. Verify `git ls-files configs/pagespeed.ts configs/pagespeed.yaml` returns both paths in the feature branch.

- **`CurlExecuteSchema.url` uses inline `.refine()` not `httpOnlyUrl()`** — the upstream chose not to replace the inline refine chain with the `httpOnlyUrl()` helper in `schemas.ts`. The security semantics are identical (both enforce http/https), but the approach differs from what the prompt files do. This is upstream's choice, not a fork issue.

- **`tsc --noEmit configs/pagespeed.ts` requires ESM module flags** — running tsc without `--module nodenext --moduleResolution nodenext` produces false errors (module resolution, top-level await, import.meta). The correct command is: `npx tsc --noEmit --skipLibCheck --module nodenext --moduleResolution nodenext --target esnext --allowImportingTsExtensions configs/pagespeed.ts`. The plan has been updated with these flags. The project tsconfig (`npx tsc --noEmit --skipLibCheck --project tsconfig.json`) passes cleanly.

- **`npm audit fix` changed 9 packages** — the audit fix is recorded in the regenerated `package-lock.json` but not in `package.json`. Reviewer should check that no direct dependencies were unintentionally upgraded.

**Edge cases:**

- `_extra` in the pagespeed handler is accepted (`_extra`) but never forwarded to `executeRequest`. This is intentional for the pagespeed tool (stdio-only, no session context), but noted as a future improvement in the plan.

## Known issues and limitations

1. ~~Plan's `tsc` command needed ESM module flags~~ — **resolved**. Plan and handoff updated with the correct `--module nodenext --moduleResolution nodenext --target esnext --allowImportingTsExtensions` flags.

2. **`dist/` in the merge commit contains upstream's 3.0.1 compiled output** — the merge commit includes the old `dist/` from the upstream (later replaced when `rm -rf dist/ && npm run build` regenerated it). The PR contains both the merge commit (with old dist/) and the final state (with fresh dist/). A reviewer should look at the latest state, not the intermediate merge commit.

3. **`docs/todos/` conflict** — both the fork and upstream had `docs/todos/cache-utilities.md` and `docs/todos/configure-unknown-fields.md`. Fork versions were kept. These todos represent work that may already be completed (they match the content of commits 482439b and 1cd5cc9). Consider reviewing whether these todo files should be deleted.

## Testing summary

- Tests added: 3 new test files from upstream (api-discovery, api-test, schemas) | All passing | Linting: N/A (no linting script)
- Test results: **18 test files, 330 tests passed, 7 skipped** (all skips are in `blocked-dirs.test.ts` for platform-specific paths)
- Manual testing: `npx tsx configs/pagespeed.ts` starts cleanly ("cURL MCP server running on stdio")
- Type check: `npx tsc --noEmit --skipLibCheck --project tsconfig.json` passes; `configs/pagespeed.ts` passes with correct module flags
- Test gaps: No integration test connecting an MCP client to the server and calling `analyze_pagespeed` end-to-end

## Commit history

```
71aa406 chore: merge upstream/main (mcp-curl 3.0.1)
```
(Plus 20 upstream commits from `upstream/main` now in fork history)

## Review context

- The only fork-specific code change is `configs/pagespeed.ts:116` — one character change (`args` → `args, _extra`)
- All other changes came from the upstream merge and are already reviewed/tested in the mcp-curl 3.0.1 release
- Focus review effort on: `.gitignore` correctness, `configs/pagespeed.ts` handler fix, `npm audit fix` package changes

## Follow-up work

- [ ] Review `docs/todos/cache-utilities.md` and `docs/todos/configure-unknown-fields.md` — these may be completed work items that should be deleted
- [ ] Consider forwarding `_extra` to `executeRequest` for future HTTP transport session support

### Outstanding Todos
| File | Priority | Description | Source |
|------|----------|-------------|--------|
| `docs/todos/cache-utilities.md` | Low | Cache utilities implementation (may already be done) | Pre-existing fork todo |
| `docs/todos/configure-unknown-fields.md` | Low | Configure unknown fields handling (may already be done) | Pre-existing fork todo |

### Resolved Todos
<!-- None resolved this session -->

---

## Code Review — 2026-04-04

### Review Summary
- **Reviewer:** automated multi-agent review (security-sentinel + code-simplicity-reviewer)
- **Agents used:** security-sentinel, code-simplicity-reviewer
- **Findings:** 🔴 P1: 0 | 🟡 P2: 2 | 🔵 P3: 1

### Handoff Assessment

The builder's self-assessment was honest and accurate. The handoff correctly flagged the `CurlExecuteSchema.url` / `httpOnlyUrl()` divergence as a known issue, surfaced the `tsc` ESM flag requirement proactively, and accurately described the security semantics of all three URL enforcement points. No undisclosed security issues were found. The one gap the builder did not flag: `httpOnlyUrl()` ships with zero unit tests.

### Key Findings

| ID | Severity | Category | Description | Todo File |
|----|----------|----------|-------------|-----------|
| 1 | 🟡 P2 | Testing | `httpOnlyUrl()` has zero test coverage despite security-adjacent scheme enforcement | `docs/todos/001-pending-p2-httponly-url-missing-tests.md` |
| 2 | 🟡 P2 | SPR/DRY | `schemas.ts` and `validator.ts` duplicate the `z.url().refine()` pattern instead of using `httpOnlyUrl()` — plan acceptance criterion not met | `docs/todos/002-pending-p2-dry-httponly-url-not-reused.md` |
| 3 | 🔵 P3 | Quality | Scheme check uses `split(":")` heuristic; SSRF layer uses more robust `new URL().protocol` form | `docs/todos/003-pending-p3-scheme-check-split-heuristic.md` |

### Verified Claims

| Handoff Claim | Verified? | Notes |
|---------------|-----------|-------|
| 330 tests passed | ✅ Yes | Confirmed: `npm test` → 18 test files, 330 passed, 7 skipped |
| `configs/pagespeed.ts` type-check passes | ✅ Yes | `tsc --noEmit --skipLibCheck --module nodenext ...` exits 0 |
| `url.ts` has `httpOnlyUrl` after merge | ✅ Yes | `grep "httpOnlyUrl" src/lib/utils/url.ts` returns match |
| `CurlExecuteSchema.url` uses inline `.refine()` not `httpOnlyUrl()` | ✅ Yes (acknowledged) | DRY violation confirmed; security semantics identical |
| No known issues beyond listed | ⚠️ Partial | `httpOnlyUrl()` missing tests not surfaced in handoff |

### Outstanding Todos
<!-- Todos created during this review -->
| File | Priority | Description | Source |
|------|----------|-------------|--------|
| `docs/todos/001-pending-p2-httponly-url-missing-tests.md` | P2 | Add unit tests for `httpOnlyUrl()` | code-review |
| `docs/todos/002-pending-p2-dry-httponly-url-not-reused.md` | P2 | Consolidate http/https scheme check behind `httpOnlyUrl()` | code-review |
| `docs/todos/003-pending-p3-scheme-check-split-heuristic.md` | P3 | Replace `split(":")` heuristic with `new URL().protocol` form | code-review |

### Blockers
None — clear to merge. P2 todos are post-merge follow-up items. Security semantics are correct at all three enforcement points; the issues are code quality and test coverage.

---

## Post-Review Fixes — 2026-04-04

All three review todos resolved in the same session:

| Todo (removed) | Summary |
|----------------|---------|
| `docs/todos/003-pending-p3-scheme-check-split-heuristic.md` | Fixed `httpOnlyUrl()` to use `new URL().protocol` (consistent with SSRF layer) |
| `docs/todos/002-pending-p2-dry-httponly-url-not-reused.md` | `schemas.ts` and `validator.ts` now import and use `httpOnlyUrl()` — single source of truth |
| `docs/todos/001-pending-p2-httponly-url-missing-tests.md` | Added 9 unit tests for `httpOnlyUrl()` to `url.test.ts`; suite now 339 tests (was 330) |

**Test results after fixes:** 339 passed, 7 skipped. `tsc` gate: exit 0.

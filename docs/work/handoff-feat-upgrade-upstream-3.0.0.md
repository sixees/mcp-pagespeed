# Work Handoff: Upgrade to upstream mcp-curl 3.0.1

**Date:** 2026-04-04 | **Branch:** feat/upgrade-upstream-3.0.0 | **Plan:** docs/plans/2026-04-04-feat-upgrade-upstream-mcp-curl-3-0-0-plan.md | **Status:** complete — PR #1 open

## Summary

Merged `upstream/main` (mcp-curl 3.0.1) into the pagespeed fork using `--allow-unrelated-histories` (the fork has no shared git ancestor with upstream — it was seeded from a flat import). The merge brings Zod v3 → v4 and MCP SDK 1.12.0 → 1.29.0 into the fork's `src/` library code automatically. Post-review improvements consolidated URL scheme validation behind a single `httpOnlyUrl()` helper and added comprehensive tests. Ships as **v3.0.2** (3.0.1 upstream base + fork quality fixes). All 341 tests pass.

## What was implemented

### Merge + conflict resolution

- **What:** Ran `git merge upstream/main --allow-unrelated-histories` and resolved all add/add conflicts
- **Key files resolved:**
  - `.gitignore` — manually merged: kept fork's `!configs/pagespeed.ts` and `!configs/pagespeed.yaml` negation lines; added upstream's `# Runtime output /output` section
  - `package.json` — took upstream wholesale (version 3.0.1; name/description unchanged — both sides had identical values)
  - `package-lock.json` — deleted; regenerated via `npm install`
  - `CLAUDE.md` — kept fork's version (describes mcp-pagespeed, not mcp-curl)
  - `CHANGELOG.md`, `README.md` — took upstream versions (restored fork-specific content in follow-up commit)
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
| `src/lib/server/schemas.ts` | `z.record(z.string(), z.string())` (two-arg); `z.url()` + `.refine()` for http/https → later consolidated to `httpOnlyUrl()` |
| `src/lib/schema/validator.ts` | Same z.record + z.url fixes → later consolidated to `httpOnlyUrl()` |
| `src/lib/utils/url.ts` | New `httpOnlyUrl()` helper export; scheme check uses `new URL().protocol` after post-review fix |
| `src/lib/prompts/api-discovery.ts` | Uses `httpOnlyUrl()` via import |
| `src/lib/prompts/api-test.ts` | Uses `httpOnlyUrl()` via import |
| `src/lib/extensible/tool-wrapper.ts` | `extra` non-optional; `ToolCallback` casts removed |
| `src/lib/schema/generator.ts` | `extra` non-optional in handler types (×3); `buildStringEnum`/`buildNumberUnion` DRY helpers extracted |

New test files from upstream: `api-discovery.test.ts`, `api-test.test.ts`, `schemas.test.ts`

### Post-review improvements (fork-specific, same session)

- **`httpOnlyUrl()` hardened:** scheme check changed from `url.split(":")[0]` to `new URL(url).protocol` — consistent with the SSRF layer; eliminates implicit dependency on Zod v4 normalisation order
- **URL validation centralised:** `CurlExecuteSchema.url` and `ApiInfoSchema.baseUrl` now import and use `httpOnlyUrl()` — single source of truth for http/https enforcement
- **Tests added:** 9 new unit tests for `httpOnlyUrl()` in `url.test.ts`; 1 `data:` test in `api-discovery.test.ts`; 1 `data:` test in `api-test.test.ts` (parity across all three URL schema test suites)
- **Version bumped:** `3.0.1` → `3.0.2` in `package.json`; `dist/` rebuilt; CHANGELOG updated

## Key decisions

| Decision | Reasoning | Alternatives considered |
|----------|-----------|------------------------|
| Take upstream wholesale for `src/` | Fork had not modified src/ — all Zod v4 fixes are in upstream | Manual cherry-pick per file (unnecessary complexity) |
| Delete and regenerate `package-lock.json` | Unrelated histories produce unresolvable lockfile conflicts | Manual resolution (error-prone, rejected by plan) |
| Keep fork `CLAUDE.md` | Fork's CLAUDE.md describes mcp-pagespeed, not mcp-curl | Take upstream CLAUDE.md (would lose all fork-specific guidance) |
| Take upstream CHANGELOG/README | Simpler; fork doesn't maintain a separate changelog | Merge both histories (unnecessary complexity for a private fork) |
| `npm audit fix` (not `--force`) | All 7 vulnerabilities had non-breaking patches available | Accept vulnerabilities as-is (explicitly rejected by plan) |
| Consolidate to `httpOnlyUrl()` (post-review) | DRY — three independent copies of scheme-check logic; plan acceptance criterion required it | Keep inline refine in each site (upstream's approach; dismissed as maintenance risk) |
| `new URL().protocol` over `split(":")` (post-review) | Matches SSRF layer; no implicit dependency on Zod v4 normalisation | Keep split heuristic (safe today but fragile) |

## What to pay attention to during review

**Risk areas:**

- **`.gitignore` manual merge** — the two negation lines `!configs/pagespeed.ts` and `!configs/pagespeed.yaml` were hand-merged. Verify `git ls-files configs/pagespeed.ts configs/pagespeed.yaml` returns both paths in the feature branch.

- **`tsc --noEmit configs/pagespeed.ts` requires ESM module flags** — running tsc without `--module nodenext --moduleResolution nodenext` produces false errors (module resolution, top-level await, import.meta). The correct command is: `npx tsc --noEmit --skipLibCheck --module nodenext --moduleResolution nodenext --target esnext --allowImportingTsExtensions configs/pagespeed.ts`. The plan has been updated with these flags.

- **`npm audit fix` changed 9 packages** — the audit fix is recorded in the regenerated `package-lock.json` but not in `package.json`. Reviewer should check that no direct dependencies were unintentionally upgraded.

**Edge cases:**

- `_extra` in the pagespeed handler is accepted (`_extra`) but never forwarded to `executeRequest`. This is intentional for the pagespeed tool (stdio-only, no session context), but noted as a future improvement.

## Known issues and limitations

1. ~~Plan's `tsc` command needed ESM module flags~~ — **resolved**. Plan updated with the correct `--module nodenext --moduleResolution nodenext --target esnext --allowImportingTsExtensions` flags.

2. **`dist/` in the merge commit contains upstream's 3.0.1 compiled output** — the merge commit includes the old `dist/` from the upstream (later replaced when `rm -rf dist/ && npm run build` regenerated it). Reviewers should look at the latest commit, not the intermediate merge commit.

3. **`docs/todos/` conflict** — both the fork and upstream had `docs/todos/cache-utilities.md` and `docs/todos/configure-unknown-fields.md`. Fork versions were kept. These todos represent work that may already be completed (they match the content of commits 482439b and 1cd5cc9). Consider reviewing whether these todo files should be deleted.

4. ~~`CurlExecuteSchema.url` uses inline `.refine()` not `httpOnlyUrl()`~~ — **resolved** (post-review). Both `schemas.ts` and `validator.ts` now use `httpOnlyUrl()`.

## Testing summary

- Tests added: 3 upstream test files (api-discovery, api-test, schemas) + 11 fork-specific tests (9 `httpOnlyUrl` unit tests + 1 `data:` in api-discovery + 1 `data:` in api-test)
- **Test results: 18 test files, 341 tests passed, 7 skipped** (all skips in `blocked-dirs.test.ts` for platform-specific paths)
- Manual testing: `npx tsx configs/pagespeed.ts` starts cleanly ("cURL MCP server running on stdio")
- Type check: `npx tsc --noEmit --skipLibCheck --project tsconfig.json` passes; `configs/pagespeed.ts` passes with correct module flags
- Test gaps: No integration test connecting an MCP client to the server and calling `analyze_pagespeed` end-to-end

## Commit history

```text
d7dcb18 fix: address PR #1 review comments
fd9351f chore: bump version to 3.0.2 and rebuild dist
8b994f6 fix: address CodeRabbit findings — test comments and doc consistency
c6f4353 fix: resolve P2/P3 review todos — consolidate URL scheme enforcement
17761fa docs: add code review findings to handoff and create todo files
81bf81e docs: restore fork-specific README and CHANGELOG
1f3b769 docs: fix tsc command for configs/ type-check — add required ESM module flags
b56438c docs: mark upgrade plan completed
404c512 feat: apply mcp-curl 3.0.1 fork-specific fixes + rebuild
71aa406 chore: merge upstream/main (mcp-curl 3.0.1)
```

(Plus 20 upstream commits from `upstream/main` now in fork history)

## Review context

- The only change to `configs/` is a one-line handler signature fix at `configs/pagespeed.ts:116`
- All `src/` changes are either from the upstream merge or from the post-review `httpOnlyUrl()` consolidation
- Focus review effort on: `.gitignore` correctness, `configs/pagespeed.ts` handler fix, `httpOnlyUrl()` implementation and test coverage

## Follow-up work

- [ ] Review `docs/todos/cache-utilities.md` and `docs/todos/configure-unknown-fields.md` — these may be completed work items that should be deleted
- [ ] Consider forwarding `_extra` to `executeRequest` for future HTTP transport session support

### Outstanding Todos

| File | Priority | Description | Source |
|------|----------|-------------|--------|
| `docs/todos/cache-utilities.md` | Low | Cache utilities implementation (may already be done) | Pre-existing fork todo |
| `docs/todos/configure-unknown-fields.md` | Low | Configure unknown fields handling (may already be done) | Pre-existing fork todo |

### Resolved Todos

<!-- Todos resolved during post-review fixes — files deleted from docs/todos/ -->
| File (removed) | Title | Summary | Resolved by | Date |
|----------------|-------|---------|-------------|------|
| `docs/todos/001-pending-p2-httponly-url-missing-tests.md` | Missing tests for `httpOnlyUrl()` | Added 9 unit tests to `url.test.ts` | commit `c6f4353` | 2026-04-04 |
| `docs/todos/002-pending-p2-dry-httponly-url-not-reused.md` | DRY violation — `httpOnlyUrl()` not used in schemas/validator | `schemas.ts` + `validator.ts` now import `httpOnlyUrl()` | commit `c6f4353` | 2026-04-04 |
| `docs/todos/003-pending-p3-scheme-check-split-heuristic.md` | Scheme check uses `split(":")` heuristic | `httpOnlyUrl()` updated to use `new URL().protocol` | commit `c6f4353` | 2026-04-04 |

---

## Code Review — 2026-04-04

### Review Summary
- **Reviewer:** automated multi-agent review (security-sentinel + code-simplicity-reviewer)
- **Agents used:** security-sentinel, code-simplicity-reviewer
- **Findings:** 🔴 P1: 0 | 🟡 P2: 2 | 🔵 P3: 1 — all resolved same session

### Handoff Assessment

The builder's self-assessment was honest and accurate. The handoff correctly flagged the `CurlExecuteSchema.url` / `httpOnlyUrl()` divergence as a known issue, surfaced the `tsc` ESM flag requirement proactively, and accurately described the security semantics of all three URL enforcement points. No undisclosed security issues were found. The one gap the builder did not flag: `httpOnlyUrl()` ships with zero unit tests.

### Key Findings (all resolved)

| ID | Severity | Category | Description | Resolution |
|----|----------|----------|-------------|-----------|
| 1 | 🟡 P2 | Testing | `httpOnlyUrl()` had zero test coverage | 9 tests added in `url.test.ts` |
| 2 | 🟡 P2 | SPR/DRY | `schemas.ts` and `validator.ts` duplicated the `z.url().refine()` pattern | Both now use `httpOnlyUrl()` |
| 3 | 🔵 P3 | Quality | Scheme check used `split(":")` heuristic vs SSRF layer's `new URL().protocol` | `httpOnlyUrl()` updated to use `new URL().protocol` |

---

## PR Review Comments Addressed — 2026-04-04

### Changes Made

| Comment | Reviewer | Category | Action Taken |
|---------|----------|----------|--------------|
| `plan.md` — tsc command missing ESM flags | @gemini-code-assist | Already fixed | Fixed in commit `8b994f6`; replied and resolved thread |
| `CHANGELOG.md` — missing `3.0.1` section | @coderabbitai | False positive | CHANGELOG has both `3.0.2` and `3.0.1` entries; replied and resolved |
| `plan.md:57` — `.gitignore` fence missing language | @coderabbitai | Fix needed | Added `gitignore` language identifier |
| `handoff.md:94` — fence lang + blank lines | @coderabbitai | Fix needed | Added `text` lang; blank line before Outstanding Todos table |
| `api-test.test.ts:27` — missing `data:` rejection test | @coderabbitai | Fix needed | Added `data:` test (parity with api-discovery; suite: 340→341) |

All 5 threads replied to and resolved. Commit: `d7dcb18`.

### Files Modified
- `docs/plans/2026-04-04-feat-upgrade-upstream-mcp-curl-3-0-0-plan.md`
- `docs/work/handoff-feat-upgrade-upstream-3.0.0.md`
- `src/lib/prompts/api-test.test.ts`

---

## PR Review Comments Addressed — 2026-04-04 (second pass)

### Changes Made

| Comment | Reviewer | Category | Action Taken |
|---------|----------|----------|--------------|
| `configs/pagespeed.ts:116` — typed handler constant + remove manual URL validation | @gemini-code-assist | False positive (both points) | No change: `generateInputSchema()` returns generic `ZodObject<ZodRawShape>` so typed constant adds no type safety; manual guard is intentional defence-in-depth before a 15–45s API call |
| `plan.md:51` — update version refs from `3.0.1` to `3.0.2` | @coderabbitai | False positive | No change: plan has `status: completed`; it's a historical record of intent; version bump was post-plan |
| `url.ts:31` — hoist protocol array to module-level `Set` constant | @coderabbitai | Won't apply | No change: reviewer labels it "Optional" and acknowledges correctness; n=2 makes `Array.includes` vs `Set.has` a zero-impact distinction |

All 3 threads replied to and resolved. No code changes.

### Files Modified
- `docs/work/handoff-feat-upgrade-upstream-3.0.0.md`

---

## PR Review Comments Addressed — 2026-04-04 (third pass)

### Changes Made

| Comment | Reviewer | Category | Action Taken |
|---------|----------|----------|--------------|
| `upgrade-3.0.0-downstream.md:120` — `import { httpOnlyUrl } from "mcp-curl/lib"` would fail | @coderabbitai | Fix needed | Added `export { httpOnlyUrl } from "./utils/url.js"` to `src/lib/index.ts`; rebuilt `dist/`; commit `279ac2e` |
| `generator.ts:53` — `z.ZodRawShape` return type incompatible with Zod v4 | @coderabbitai | False positive | `ZodRawShape` is a valid public type alias for `core.$ZodShape` in installed Zod v4; `tsc --noEmit` exits clean |
| `generator.ts:buildStringEnum` — missing empty-array guard | @coderabbitai | False positive | Private helper; all call sites already guard; CLAUDE.md: don't add validation for scenarios that can't happen |
| `generator.ts:buildNumberUnion` — missing empty-array guard | @coderabbitai | False positive | Same reasoning as `buildStringEnum` |

All 4 threads replied to and resolved.

### Files Modified
- `src/lib/index.ts` — added `httpOnlyUrl` export
- `dist/` — rebuilt
- `docs/work/handoff-feat-upgrade-upstream-3.0.0.md`

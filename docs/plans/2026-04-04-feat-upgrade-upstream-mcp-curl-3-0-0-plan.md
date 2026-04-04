---
title: "feat: Upgrade to upstream mcp-curl 3.0.1"
type: feat
status: active
date: 2026-04-04
---

# feat: Upgrade to upstream mcp-curl 3.0.1

## Overview

Merge `upstream/main` (mcp-curl 3.0.1) into this fork on a feature branch and apply the one fork-specific code fix required. The upstream bump brings Zod v3 → v4 and MCP SDK 1.12.0 → 1.29.0, both with breaking API changes. Most fixes land automatically via the merge; one manual edit to `configs/pagespeed.ts` is needed.

## Problem Statement / Motivation

Upstream mcp-curl 3.0.1 introduces Zod v4 and MCP SDK 1.29.0. Staying on 3.x dependencies causes type namespace mismatches (two Zod versions in the same TypeScript compile) and will eventually break transport compatibility. We must track upstream to keep the library's security layer, SSRF protections, and transport working correctly.

## What upstream 3.0.1 changes (summary)

| Area | Old | New |
|---|---|---|
| Zod | `^3.23.8` | `^4.0.0` |
| MCP SDK | `^1.12.0` | `^1.29.0` |
| `z.record()` | single-arg `z.record(z.string())` | two-arg `z.record(z.string(), z.string())` |
| URL schema | `z.string().url()` | `z.url()` + http/https `.refine()` via new `httpOnlyUrl()` helper |
| URL error code | `invalid_string` | `invalid_format` |
| Tool handler `extra` | optional `extra?` | required `extra` (non-optional) |
| `ToolCallback` cast | required on handlers | no longer needed — types infer correctly |

## Proposed Solution

1. Create a feature branch from `main`.
2. Fetch and merge `upstream/main` with `--allow-unrelated-histories` (the fork was seeded from a flat import, not a proper git fork — no common ancestor exists).
3. Resolve the expected conflicts: `package-lock.json` (delete + regenerate), `package.json` (keep upstream version 3.0.1, keep fork `name`/`description`), `.gitignore` (preserve fork-specific negation lines), docs/markdown files (manual reconcile).
4. Run `npm install` to pull in Zod v4 and MCP SDK 1.29.0, then audit dependencies.
5. Apply the single manual fix in `configs/pagespeed.ts`.
6. Verify: build, type-check the configs file (required blocking gate), and run the full test suite.

## Technical Considerations

### `--allow-unrelated-histories` is required

The fork was created by importing the upstream source as a flat commit (`fffee51 feat: import upstream mcp-curl base`) rather than forking the git repository. `git merge upstream/main` will abort without `--allow-unrelated-histories`. With the flag, git does a content-level merge without a three-way base — files changed on both sides will conflict.

### Files expected to conflict

| File | Expected conflict | Resolution |
|---|---|---|
| `.gitignore` | Fork has negation lines upstream does not | **Preserve fork-specific lines** (see below) |
| `package.json` | `version` field (fork: `2.0.1`, upstream: `3.0.1`) | Keep upstream `version` (`3.0.1`); keep fork `name`/`description` — take value directly from the merged file, do not type it manually |
| `package-lock.json` | Always conflicts on unrelated-history merges | Delete the file after merge commit; run `npm install` fresh |
| `CHANGELOG.md` | Both sides have changelog entries | Manually reconcile; keep both histories |
| `README.md` | Upstream may have updated docs | Review and preserve fork-specific content |

> **`.gitignore` must be reconciled manually.** The fork has these lines that upstream does not — they must survive the merge or the fork's files vanish from version control:
>
> ```
> !configs/pagespeed.ts
> !configs/pagespeed.yaml
> /docs/*
> !/docs/todos
> ```
>
> After resolving `.gitignore`, verify both configs files are still tracked: `git ls-files configs/pagespeed.ts configs/pagespeed.yaml` — both paths must appear.

### `src/` files — take upstream in full

All changes needed in `src/` are already done in upstream 3.0.1. For any `src/` file that conflicts, take the upstream version. The fork has not modified any `src/` files — it only adds `configs/`.

Key upstream `src/` changes expected to arrive via merge:

| File | Changes |
|---|---|
| `src/lib/server/schemas.ts` | `z.record(z.string())` → `z.record(z.string(), z.string())` (×2); `z.string().url()` → `httpOnlyUrl()` |
| `src/lib/schema/validator.ts` | Same `z.record` + URL fixes |
| `src/lib/prompts/api-discovery.ts` | `z.string().url()` → `httpOnlyUrl()` |
| `src/lib/prompts/api-test.ts` | `z.string().url()` → `httpOnlyUrl()` |
| `src/lib/utils/url.ts` | Gains new `httpOnlyUrl()` export |
| `src/lib/extensible/tool-wrapper.ts` | `extra?` → `extra` (non-optional); `as ToolCallback<...>` casts removed |
| `src/lib/schema/generator.ts` | `extra?` → `extra` in handler types (×3) |

> **Critical — `url.ts` merge failure causes a complete build crash, not a soft runtime error.** `api-discovery.ts` and `api-test.ts` call `httpOnlyUrl()` at module scope to define exported constants. If `url.ts` resolves to the fork's v2 version (which lacks `httpOnlyUrl`), `npm run build` will halt immediately with: `Module '…/url.js' has no exported member 'httpOnlyUrl'`. Run this check *before* attempting a build:
>
> ```bash
> grep "httpOnlyUrl" src/lib/utils/url.ts
> ```
>
> If the command returns no output, `url.ts` was resolved incorrectly. Restore it from upstream before continuing.

> **Also verify the new test files' companion source files are the upstream versions** before running `npm test`. The three new test files (`api-discovery.test.ts`, `api-test.test.ts`, `schemas.test.ts`) import symbols that only exist in the upstream versions of their companion source files. If any source was resolved to the fork's version, `npm test` fails with import errors — not assertion failures — which is confusing to diagnose.

### Manual fix — `configs/pagespeed.ts` line ~116

This is the only fork-specific code change. MCP SDK 1.29.0 makes the `extra` parameter required in tool handler callbacks:

```typescript
// configs/pagespeed.ts — before
async (args) => {

// configs/pagespeed.ts — after
async (args, _extra) => {
```

The `_extra` parameter does not need an explicit type annotation — TypeScript infers it contextually from the `registerCustomTool` overload signature. The leading `_` signals intentional non-use and suppresses unused-variable warnings.

> **Do not remove the inline protocol guard at lines ~124–144.** The handler contains a hand-rolled `new URL()` check that enforces http/https on the user-supplied URL. It runs before `executeRequest` and is intentional defence-in-depth. It is not a candidate for removal when making the surgical handler signature fix.

### `configs/pagespeed.ts` is outside `tsconfig.json` scope — type-check is a required blocking gate

The root `tsconfig.json` only covers `src/**/*`. TypeScript errors in `configs/pagespeed.ts` are **not** caught by `npm run build`. A passing build does **not** mean `configs/pagespeed.ts` is type-correct. The separate type-check below is required before the upgrade is considered complete:

```bash
npx tsc --noEmit --skipLibCheck configs/pagespeed.ts
```

Note: `npx tsx configs/pagespeed.ts` uses esbuild and does **not** type-check — it is a runtime smoke test only. Both steps serve different purposes and both must pass.

### `dist/` is stale after `npm install`

`configs/pagespeed.ts` imports from `"mcp-curl"` which resolves from `dist/`. After `npm install`, `node_modules` has Zod v4 and MCP SDK 1.29.0 but `dist/` still contains old Zod v3 compiled output. Running any smoke test or type-check *before* `npm run build` will produce confusing Zod v3 errors. Delete `dist/` explicitly before building to make the staleness visible.

### `configs/pagespeed.yaml` baseUrl

`baseUrl: https://pagespeedonline.googleapis.com` passes both the old and new validators. No change needed.

## Acceptance Criteria

- [ ] Feature branch `feat/upgrade-upstream-3.0.0` created from `main`
- [ ] `upstream/main` merged with `--allow-unrelated-histories`; all conflicts resolved
- [ ] `.gitignore` preserves fork-specific negation lines; `git ls-files configs/pagespeed.ts configs/pagespeed.yaml` returns both paths
- [ ] `package.json` version is `3.0.1`; Zod and MCP SDK dependencies reflect upstream 3.0.1 versions
- [ ] `npm install` completed; `node_modules` contains Zod v4 and MCP SDK 1.29.0
- [ ] `npm audit --audit-level=moderate` exits clean (or any findings are explicitly accepted)
- [ ] `grep "httpOnlyUrl" src/lib/utils/url.ts` returns a match (upstream `url.ts` is present)
- [ ] `CurlExecuteSchema.url` uses `httpOnlyUrl()` — not bare `z.url()` — enforcing http/https at schema layer
- [ ] `configs/pagespeed.ts` handler updated to `async (args, _extra) =>`; inline protocol guard preserved
- [ ] `rm -rf dist/ && npm run build` exits with zero errors and zero Zod deprecation warnings
- [ ] `npx tsc --noEmit --skipLibCheck configs/pagespeed.ts` exits cleanly (required blocking gate)
- [ ] `npm test` passes — all tests green, including the three new upstream test files (`api-discovery.test.ts`, `api-test.test.ts`, `schemas.test.ts`)
- [ ] `npx tsx configs/pagespeed.ts` starts without import or runtime errors

## Dependencies & Risks

**Risk — `.gitignore` merge loses fork-specific negation lines:** If git auto-resolves `.gitignore` in upstream's favour, `configs/pagespeed.ts`, `configs/pagespeed.yaml`, and `docs/todos/` become git-ignored and disappear from version control. Verify with `git ls-files` after merge.

**Risk — `url.ts` resolved to fork's version causes build crash:** `api-discovery.ts` and `api-test.ts` call `httpOnlyUrl()` at module scope. If `url.ts` is wrong, `npm run build` aborts entirely. Run the `grep` check before building.

**Risk — `CurlExecuteSchema.url` loses http/https enforcement:** If the schema file is edited rather than taken from upstream wholesale, bare `z.url()` may be used instead of `httpOnlyUrl()`. Under Zod v4, `z.url()` accepts `ftp://`, `file://`, `javascript:`, etc. The SSRF layer provides a second line of defence, but the schema layer must also enforce it. Verify the acceptance criterion explicitly.

**Risk — `dist/` staleness:** After `npm install` and before `npm run build`, `dist/` contains stale Zod v3 code. Any verification step run in this window will produce misleading errors. Always delete `dist/` and rebuild first.

**Risk — `package-lock.json` corruption:** Do not try to resolve a lockfile merge conflict manually. Delete it and let `npm install` regenerate.

**Risk — New upstream test files fail with import errors:** If any companion source file was resolved to the fork's version, `npm test` fails on import errors rather than assertion failures. Verify source files before running tests.

## Work Breakdown & PR Plan

This is a single coherent upgrade — all changes depend on the same merge commit and must ship together. One PR is appropriate.

| # | Task | Depends On | Est. Files |
|---|------|------------|-----------|
| 1 | Create feature branch + merge upstream/main | — | ~15 (merge) |
| 2 | Resolve merge conflicts (incl. `.gitignore`) | 1 | 4-6 (package.json, lockfile, .gitignore, docs) |
| 3 | npm install + npm audit | 2 | 1 (lockfile regenerated) |
| 4 | Fix `configs/pagespeed.ts` handler | 3 | 1 |
| 5 | Build + type-check (blocking gate) + test + smoke test | 4 | — |

| PR | Includes Tasks | Est. Files | Review Complexity | Can Start After |
|----|---------------|------------|-------------------|-----------------|
| PR-1 | 1–5 | 15–20 | Medium — dependency bump + one code fix | Immediately |

## Exact Commands

```bash
# 1. Feature branch
git checkout -b feat/upgrade-upstream-3.0.0

# 2. Fetch and merge upstream
git fetch upstream
git merge upstream/main --allow-unrelated-histories

# 3. Resolve conflicts:
#    - .gitignore: preserve fork-specific negation lines (see Technical Considerations)
#    - package.json: take upstream's version (3.0.1), keep fork name/description
#    - package-lock.json: delete it
#    - CHANGELOG.md, README.md: manual reconcile
rm package-lock.json

# Stage only the files you resolved manually (not -A)
git add package.json .gitignore CHANGELOG.md README.md
git commit -m "chore: merge upstream/main (mcp-curl 3.0.1)"

# Verify configs files are still tracked (must return both paths)
git ls-files configs/pagespeed.ts configs/pagespeed.yaml

# 4. Reinstall dependencies
npm install
npm audit --audit-level=moderate

# 5. Pre-build: verify url.ts has httpOnlyUrl (must return a match)
grep "httpOnlyUrl" src/lib/utils/url.ts

# 6. Build (delete stale dist/ first)
rm -rf dist/ && npm run build

# 7. Type-check configs/pagespeed.ts (required blocking gate — not covered by npm run build)
npx tsc --noEmit --skipLibCheck configs/pagespeed.ts

# 8. Apply manual fix in configs/pagespeed.ts (line ~116)
#    Change: async (args) => {
#    To:     async (args, _extra) => {
#    Do NOT remove the inline protocol guard at lines ~124-144

# 9. Re-run type-check after fix
npx tsc --noEmit --skipLibCheck configs/pagespeed.ts

# 10. Full test suite
npm test

# 11. Smoke test
npx tsx configs/pagespeed.ts --help 2>&1 | head -5
```

## References & Research

### Internal References

- Upgrade guide: `docs/upgrade-3.0.0-downstream.md`
- Fork entry point: `configs/pagespeed.ts:116` (handler signature fix); `configs/pagespeed.ts:124-144` (inline protocol guard — must be preserved)
- Library schemas: `src/lib/server/schemas.ts:12,24,30`
- Validator: `src/lib/schema/validator.ts:89-99`
- URL helper (new): `src/lib/utils/url.ts` (must export `httpOnlyUrl` after merge)
- Tool wrapper: `src/lib/extensible/tool-wrapper.ts:105,131,151,177`
- Generator types: `src/lib/schema/generator.ts:331-332,514`

### External References

- Upstream repo: `git@github.com:sixees/mcp-curl.git` (already configured as `upstream` remote)
- Zod v4 migration: https://zod.dev/v4

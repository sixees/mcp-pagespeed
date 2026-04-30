---
title: "feat: Cherry-pick prompt injection defense from upstream mcp-curl"
type: feat
status: active
date: 2026-04-30
---

# feat: Cherry-pick prompt injection defense from upstream mcp-curl

## Enhancement Summary

**Deepened on:** 2026-04-30
**Sections enhanced:** 11 (Overview, Solution, Phases 0–3, Acceptance, Quality Gates, Risk, References, Future Considerations)
**Source agents:** architecture-strategist, pattern-recognition-specialist, silent-failure-hunter, best-practices-researcher, git-history-analyzer, performance-oracle, vitest-docs-researcher, typescript-reviewer, security-sentinel, code-simplicity-reviewer

### Key Improvements

1. **Pinned cherry-pick to immutable SHA `5f32c85`** — every `git checkout` command now targets the exact commit, not the moving `upstream/main` ref. Eliminates a "branch drifts mid-pick" failure mode and makes the operation reproducible after upstream tags new releases.
2. **Version corrected to `3.1.1`** (was `3.0.3`) — `git tag -l` confirms `3.0.3` and `3.1.0` already exist as collisions; `3.1.1` is the next free patch. `package.json` baseline is `3.0.2` (not `3.0.3`).
3. **Tag prefix dropped** — fork uses unprefixed tags (`3.0.0`, `3.0.2` etc.); plan now says `git tag -a 3.1.1`, not `v3.1.1`.
4. **Commit-message prefixes corrected** — fork log shows plain lowercase imperative (`add`, `remove`) on routine commits and bare `feat:`/`fix:` on milestones. Dropped upstream-flavoured `feat(security):` / `build:` / `docs:` scopes.
5. **PR template aligned with `e5f1fc1`** — Summary → What changed → Fork-specific code changes → Testing → Post-Deploy Monitoring & Validation, plus the Compound Engineered badge.
6. **Spotlighting stance hardened** — security-sentinel flagged that `analyzed_url` and `strategy` in `configs/pagespeed.ts` echo attacker-influenced fields. Plan now requires either (a) re-validating `analyzed_url === input URL`, or (b) wrapping the post-processed JSON with `applySpotlighting()`. The existing "trusted fields" claim was partly wrong.
7. **Vitest 4 isolation explicit** — recommend `clearInjectionDetectionMap()` in `beforeEach` for any test that exercises `logInjectionDetected`. Vitest 4 defaults to per-file isolation, not per-test, so module-level `lastDetectedMap` survives within a file.
8. **Automated smoke replaces manual** — Phase 2 step 4 was "manually call analyze_pagespeed" — now an `npm run smoke` script (added to package.json) is the Quality Gate.
9. **`set -euo pipefail` wrapper around the 14 `git checkout` commands** — prevents partial cherry-picks when one path fails silently.
10. **`dist/` sentinel grep checks** added — `grep -l "WHITESPACE REMOVED" dist/` and `grep -l "injection-defense" dist/` confirm the rebuild actually pulled the new code into the bundle.
11. **Pre-cherry-pick `comm -23` assertion** — confirms `utils/index.ts` and `security/index.ts` upstream changes are still purely additive at SHA `5f32c85`. If upstream rewrites these barrels, the assertion fails before damage is done.
12. **SIGINT / SIGTERM handler** in `configs/pagespeed.ts` — `server.start()` registers `startInjectionCleanup()`'s `setInterval`, but without a signal handler the process never calls `server.shutdown()` → `stopInjectionCleanup()`. Plan now adds a 4-line handler.
13. **Follow-up tracking issues enumerated** — three concrete issues to file: upstream `httpOnlyUrl` consolidation, upstream `applySpotlightingToCustomTools`, and a fork-side "convert to npm consumer of mcp-curl" tracker.
14. **Broken internal reference removed** — plan no longer cites `docs/plans/2026-04-20-feat-prompt-injection-defense-mcp-responses-plan.md` (does not exist in this fork).

### New Considerations Discovered

- **Custom-tool spotlighting bypass is a defect, not a feature.** Architecture-strategist recommends opening upstream issue: `applySpotlightingToCustomTools` should respect `enableSpotlighting`. Until then, fork must wrap manually in `configs/pagespeed.ts` if it wants the protection.
- **Detection-logger map can leak between vitest files.** `lastDetectedMap` is module-scope and Vitest 4's `pool: 'forks', isolate: true` only isolates per-file (not per-test). Tests adding new fork-side files that touch `logInjectionDetected` should call `clearInjectionDetectionMap()` in `beforeEach`.
- **`processResponse()` size-checks AFTER sanitize+jq.** Performance-oracle: a malicious 9.9 MB response with 50%+ whitespace passes the early guard, sanitizes to ~5 MB, and only then the late `maxResultSize` check fires. Fine for Lighthouse (0.5–3 MB typical) but worth documenting.
- **Echoed `analyzed_url` is attacker-influenced.** Security-sentinel MEDIUM finding: `data.id` from PageSpeed API echoes the requested URL. Even though `sanitizeResponse()` strips Unicode attack vectors before JSON.parse, ASCII keyword payloads in the URL itself (e.g. `?q=ignore+previous+instructions`) round-trip into the output. Mitigation: validate `analyzed_url === input URL` in the post-processor, or apply `applySpotlighting()` wrap.

## Overview

Bring the prompt-injection defense added in upstream mcp-curl PR #20 (`5f32c85`) into the
mcp-pagespeed fork without losing fork-specific URL-validation hardening or upstream-flavoured
documentation rewrites. The work is a **targeted file-level cherry-pick** — not a `git merge`,
because the two repositories share no common ancestor — and is mechanically clean: the security
PR modifies 17 files and the fork has touched **none** of them, so every modified file can be
brought across via `git checkout upstream/main -- <path>` with zero conflict resolution.

The fork's PageSpeed runtime path benefits transparently: `analyze_pagespeed` calls
`server.utilities().executeRequest()`, which goes through the upstream `executeCurlRequest()` →
`processResponse()` pipeline, which is exactly where the new sanitization runs. Custom-tool
metadata sanitization in `registerCustomTool()` also applies to `analyze_pagespeed`'s
title/description automatically. No fork code needs to change for the defense to take effect.

The only judgement calls are: (a) whether to manually wrap `analyze_pagespeed`'s post-processed
output in spotlighting sentinels (recommendation: **no** — its output is structured JSON of
trusted post-processed fields), and (b) the exact wording of the CLAUDE.md security note.

## Problem Statement

PR #20 was merged upstream on 2026-04-20 to close the indirect prompt-injection (XPIA) surface
in mcp-curl: HTTP response bodies returned to the LLM are now sanitized for Unicode attack
vectors (bidi overrides, zero-width chars, Tags block, variation selectors, soft hyphen) and
collapsed for whitespace-padding runs (50+ spaces); 16 injection-keyword patterns are scanned
for observability-only logging; tool metadata is sanitized and capped at 1000 chars; an opt-in
spotlighting wrapper is available for built-in tools.

This fork is **currently unprotected**. Every Lighthouse audit returns a JSON document that
embeds page-controlled HTML, CSS, JSON-LD, and snippet text — i.e. attacker-controlled content
flowing directly into the LLM context. Recent research (Microsoft Research arXiv:2403.14720,
Cisco Unicode Tag injection blog, Palo Alto Unit 42 MCP attack vectors) shows this surface is
actively exploitable. The fork has the same threat model as upstream and should run the same
defense.

The fork also drifts further from upstream every week PR #20 sits unmerged, raising the cost of
the *next* upstream sync. Cherry-picking now keeps the cost low.

## Proposed Solution

A surgical cherry-pick organised in four short phases, each independently verifiable:

1. **Pre-flight** — fetch upstream, commit/stash uncommitted plans, snapshot the test count.
2. **Library files** — `git checkout upstream/main -- <path>` for the 17 changed src/ files.
   All 13 modified files have zero fork divergence (verified via `comm -12`); the 4 new files
   have no fork conflict by definition. `utils/index.ts` is a purely additive change in
   upstream and can be checked out verbatim too.
3. **Build artefacts & metadata** — rebuild dist/ locally (do NOT cherry-pick upstream's dist/
   chunks; their hashes won't match a local rebuild), bump `package.json` from `3.0.2` to
   `3.1.1` (skipping collisions: `3.0.3` and `3.1.0` already exist as tags), append a
   CHANGELOG entry under "Security".
4. **Fork-specific docs** — minimal CLAUDE.md update under the existing `## Security` section
   (2-3 lines: log format, throttle behavior, custom-tool spotlighting caveat). Do NOT pull
   upstream's broader docs/ rewrites — they reference `curl_execute` / `jq_query` semantics
   that don't apply to the PageSpeed-specific entry point.

Fork divergences that **must be preserved** (verified to have zero overlap with the security
PR's file list):

| File | Fork-specific behavior to preserve |
|---|---|
| `src/lib/utils/url.ts` | `httpOnlyUrl()` uses `new URL().protocol` (matches SSRF layer) — upstream uses looser `.split(":")` |
| `src/lib/schema/validator.ts` | Uses `httpOnlyUrl()` helper consistently — upstream has inlined `.refine()` (regression) |
| `src/lib/server/schemas.ts` | Uses `httpOnlyUrl()` helper — upstream inlines |
| `src/lib/index.ts` | Exports `httpOnlyUrl` — upstream stopped exporting it |
| `src/lib/utils/url.test.ts` | 95 lines (includes 9 fork-added `httpOnlyUrl` tests) — upstream has 46 |
| `src/lib/prompts/api-discovery.test.ts` | Fork removed `data:` URL test cases (deliberate per fork's URL helper semantics) |
| `src/lib/prompts/api-test.test.ts` | Same as above |

These files are **not** in the cherry-pick set, so leaving them alone is the default outcome.

## Technical Approach

### Architecture

The security PR adds two new modules and modifies six existing ones. Every code-path touch
maps cleanly onto the PageSpeed runtime:

```
configs/pagespeed.ts                            (fork — unchanged)
  └─> McpCurlServer.registerCustomTool()        (modified) — sanitizes meta, caps at 1000 chars
  └─> server.utilities().executeRequest()        (unchanged interface)
        └─> executeCurlRequest()                 (unchanged interface)
              └─> processResponse()              (modified) — sanitization + detection logging
                    ├─> sanitizeResponse()       (NEW utils/sanitize.ts)
                    ├─> detectInjectionPattern() (NEW utils/sanitize.ts)
                    └─> logInjectionDetected()   (NEW security/detection-logger.ts)
        └─> McpCurlServer.start()                (modified) — startInjectionCleanup interval
```

Note that `tool-wrapper.ts`'s spotlighting wrapper applies only to built-in `curl_execute` and
`jq_query`, both via `registerCurlToolWithHooks()` and `registerJqToolWithHooks()`. Custom
tools registered via `registerCustomTool()` go through a separate path
(`server.registerTool(name, meta, handler)` in `registerToolsOnServer()`), which means
**`enableSpotlighting: true` in `.configure()` does NOT auto-wrap the `analyze_pagespeed`
output**. This is the single unintuitive behavior in the cherry-pick and is documented below.

### Files to Cherry-Pick

**Pin to immutable SHA, not the moving `upstream/main` ref.** Pre-flight (Phase 0) records the SHA in `$PIN`; every checkout in Phase 1 uses it. Wrap the whole sequence in `set -euo pipefail` so a single failed checkout aborts before half-applied state lands on the working tree.

**Group A — new files (4):**
```bash
set -euo pipefail
PIN=5f32c85   # upstream mcp-curl PR #20 — feat(security): prompt injection defense

git checkout "$PIN" -- src/lib/utils/sanitize.ts
git checkout "$PIN" -- src/lib/utils/sanitize.test.ts
git checkout "$PIN" -- src/lib/security/detection-logger.ts
git checkout "$PIN" -- src/lib/security/detection-logger.test.ts
```

**Group B — modified files, all zero-conflict with fork (13):**
```bash
set -euo pipefail
PIN=5f32c85

git checkout "$PIN" -- src/lib/utils/index.ts                       # purely additive
git checkout "$PIN" -- src/lib/security/index.ts                    # adds detection-logger exports
git checkout "$PIN" -- src/lib/response/processor.ts
git checkout "$PIN" -- src/lib/response/processor.test.ts
git checkout "$PIN" -- src/lib/schema/generator.ts
git checkout "$PIN" -- src/lib/schema/schema.test.ts
git checkout "$PIN" -- src/lib/extensible/mcp-curl-server.ts
git checkout "$PIN" -- src/lib/extensible/mcp-curl-server.test.ts
git checkout "$PIN" -- src/lib/extensible/tool-wrapper.ts
git checkout "$PIN" -- src/lib/extensible/tool-wrapper.test.ts
git checkout "$PIN" -- src/lib/prompts/api-discovery.ts
git checkout "$PIN" -- src/lib/prompts/api-test.ts
git checkout "$PIN" -- src/lib/tools/jq-query.ts
git checkout "$PIN" -- src/lib/types/public.ts
```

**Pre-flight assertion** — confirm the two barrel files (`utils/index.ts`, `security/index.ts`) are still purely additive at the pinned SHA before running the checkouts. If upstream has rewritten them (unlikely on a frozen SHA, but the assertion costs nothing):

```bash
# Each file's existing fork lines must appear verbatim in the pinned upstream version.
# If `comm -23` returns any lines, the assertion failed — investigate before checkout.
for f in src/lib/utils/index.ts src/lib/security/index.ts; do
  diff <(git show HEAD:"$f" | sort -u) <(git show "$PIN":"$f" | sort -u) | grep '^<' && {
    echo "ASSERTION FAILED: $f has fork-only lines that upstream removed at $PIN"; exit 1;
  }
done
echo "Barrel additivity confirmed."
```

(That's 14 commands — `utils/index.ts` is in Group B because verification confirmed it's a
pure addition; no manual merge needed.)

**Files explicitly NOT touched** (preserved fork divergences):
- `src/lib/utils/url.ts`
- `src/lib/utils/url.test.ts`
- `src/lib/schema/validator.ts`
- `src/lib/server/schemas.ts`
- `src/lib/index.ts` (top-level barrel that exports `httpOnlyUrl`)
- `src/lib/prompts/api-discovery.test.ts`
- `src/lib/prompts/api-test.test.ts`

**Files NOT cherry-picked from upstream (fork-only or upstream-only flavour):**
- `dist/*` — rebuild locally; do not pull upstream's chunk hashes
- `docs/**/*.md` — upstream's broader docs rewrites are curl_execute-flavoured
- `CLAUDE.md` — fork-flavoured update done manually
- `CHANGELOG.md` — fork has its own release narrative; append a `3.1.1` entry

### Implementation Phases

#### Phase 0: Pre-flight (S — minutes)

**Goal:** Clean working tree, verified upstream pin, baseline test count.

Tasks:
1. Commit the existing untracked plans directory: `git add docs/plans/ && git commit -m "add planning artefacts for upstream security cherry-pick"` *(plain lowercase imperative — fork convention)*
2. Verify upstream commit available and pin: `git fetch upstream && git rev-parse 5f32c85` must succeed (commit reachable). Record `PIN=5f32c85` for Phase 1.
3. Verify the pin is an ancestor of `upstream/main` (sanity): `git merge-base --is-ancestor 5f32c85 upstream/main && echo "pin OK"`.
4. Capture baseline: `npm test 2>&1 | tail -5` — record the existing pass count for Phase 2 comparison.
5. Confirm `git status` is clean.

#### Phase 1: Library cherry-pick (S — < 1 hour)

**Goal:** All 17 src/ files at upstream/main parity, build still compiles.

Tasks:
1. Run all 14 `git checkout upstream/main -- <path>` commands listed above (Groups A + B).
2. Run `git diff --stat HEAD` — expect ~17 files changed, ~1,400+ lines added.
3. Run `npx tsc --noEmit` (or `npm run build` then revert dist/) to confirm TypeScript still
   type-checks against the fork's preserved files. Most likely outcome: clean. If a fork-side
   import breaks, it's because something in `prompts/api-{discovery,test}.test.ts` references
   `apiDiscoveryBaseUrlSchema` / `apiTestUrlSchema` that the cherry-pick may have shifted.
   Resolve by reading the affected test and either updating the import or accepting upstream's
   test version (decide per-case).
4. Commit: `git commit -m "feat: cherry-pick prompt injection defense from upstream mcp-curl@5f32c85"`
   *(Plain `feat:` matches the fork's milestone-commit convention seen on `e5f1fc1`. Avoid the upstream-flavoured `feat(security):` scope — this fork's `git log` does not use parenthesised scopes.)*

Verify:
- `git diff main HEAD -- src/lib/utils/sanitize.ts` matches upstream byte-for-byte: `diff <(git show HEAD:src/lib/utils/sanitize.ts) <(git show upstream/main:src/lib/utils/sanitize.ts)` returns empty.
- All preserved files are unchanged: `git diff HEAD -- src/lib/utils/url.ts src/lib/index.ts src/lib/schema/validator.ts src/lib/server/schemas.ts` returns empty.

#### Phase 2: Tests & local PageSpeed smoke (M — 1–2 hours)

**Goal:** Full test suite passes; analyze_pagespeed still works against a real URL.

Tasks:
1. Run `npm test`. Expect baseline + ~66 new tests passing (58 sanitize + 8 detection-logger).
2. If failures occur, classify:
   - **Test isolation failure** (lastDetectedMap state leaks between files) — wire `clearInjectionDetectionMap()` into a `beforeEach` of any failing fork test, or rely on vitest `--isolate` (default).
   - **Test assertion drift** (existing test asserts on whitespace-sensitive output that sanitization changes) — update the assertion if behavior is correct, otherwise revisit the cherry-pick.
3. Run `npm run build`. Expect clean compile + new chunk hashes in `dist/`.
4. **`dist/` sentinel grep** — confirm the new code actually landed in the bundle:

   ```bash
   grep -l "WHITESPACE REMOVED" dist/         # sanitizeResponse marker
   grep -l "injection-defense" dist/          # detection-logger format string
   grep -l "InjectionDetected" dist/
   ```

   All three should match at least one chunk. If any returns empty, the bundler tree-shook the
   new modules — investigate before committing dist/.
5. **Automated smoke (Quality Gate)** — replace the prior manual smoke. Add an `npm run smoke`
   script to `package.json` that boots the server, calls `analyze_pagespeed` against a stable
   public URL (e.g. `https://example.com`), asserts response shape (scores object exists, no
   `[WHITESPACE REMOVED]` markers in the post-processed output, no `[injection-defense]` log
   lines on a clean page), and exits non-zero on any deviation. Run it once here and bake into
   PR-1's CI later.
6. Commit dist: `git add dist/ && git commit -m "rebuild dist for security cherry-pick"`
   *(Plain lowercase imperative — matches the fork's routine-commit convention. Avoid `build:` scope.)*

Verify:
- Test pass count = baseline + 66 (or close — within ~2 if upstream added/removed minor cases).
- `git status` clean.
- analyze_pagespeed returns scores/metrics with no shape change.

#### Phase 3: Fork docs & version (S — 30 min)

**Goal:** Versioned release with appropriate documentation.

Tasks:
1. Bump version: edit `package.json` directly from `3.0.2` to `3.1.1` (skip `3.0.3` and `3.1.0`
   — both already exist as tags per `git tag -l`). Commit separately. *Do not* use
   `npm version patch` because it would produce `3.0.3`, which collides.
2. Append CHANGELOG entry:

   ```markdown
   ## [3.1.1] - 2026-04-30

   ### Security

   - **Prompt injection defense for HTTP response bodies** — cherry-picked from upstream mcp-curl `5f32c85` (PR #20). Sanitizes Unicode attack vectors (bidi overrides, zero-width chars, Tags block, variation selectors, soft hyphen) and collapses 50+-space whitespace-padding runs. Detection-only logger fires `[injection-defense] [hostname] InjectionDetected` to stderr at most once per hostname per minute on suspicious patterns; content is never suppressed (observability only).
   - **Tool metadata sanitization** — `registerCustomTool()` now sanitizes `title` and `description` and truncates description to 1000 chars; the `analyze_pagespeed` tool benefits transparently.
   - **Spotlighting decision** — `enableSpotlighting` is intentionally NOT enabled in `configs/pagespeed.ts` because custom tools registered via `registerCustomTool()` bypass `tool-wrapper.ts`'s auto-wrap. Instead, the post-processor in `configs/pagespeed.ts` re-validates that `analyzed_url` matches the input URL exactly (defends against API-echoed payload smuggling). For belt-and-braces, the post-processed JSON may also be wrapped via `applySpotlighting(JSON.stringify(output), randomUUID())`. See `CLAUDE.md` `## Security`.
   ```

3. Update CLAUDE.md `## Security` section. Replace the existing 3-line block with:

   ```markdown
   ## Security

   All mcp-curl security applies: SSRF protection, DNS rebinding prevention, rate limiting, input validation,
   file access controls, resource limits. `curl_execute` is disabled — only `analyze_pagespeed` can make requests.

   ### Prompt-injection observability

   - HTTP response bodies are sanitized in `processResponse()` before reaching the LLM (Unicode attack-vector strip + 50+-space collapse).
   - Detection-only logger emits `[injection-defense] [pagespeedonline.googleapis.com] InjectionDetected` at most once per minute when a known injection keyword pattern is observed in a sanitized response. The analyzed `url` is intentionally NOT in the log — to investigate, correlate with the most recent `analyze_pagespeed` invocation in your logs.
   - The `enableSpotlighting` config flag does NOT auto-apply to `analyze_pagespeed`. Spotlighting wrappers in `tool-wrapper.ts` only run for the built-in `curl_execute` / `jq_query` tools; custom tools are dispatched via `server.registerTool()` and bypass the wrapper. The `analyze_pagespeed` post-processor in `configs/pagespeed.ts` instead validates that the API-echoed `analyzed_url` matches the input URL exactly; output may additionally be wrapped via `applySpotlighting()` for defence in depth.
   - Detection-logger uses a module-level `lastDetectedMap`. Tests that exercise `logInjectionDetected` MUST call `clearInjectionDetectionMap()` (from `src/lib/security/detection-logger.js`) in `beforeEach` — Vitest 4 isolates per file, not per test.
   ```

4. Commit docs: `git commit -m "document prompt-injection observability for PageSpeed fork"`
   *(Plain lowercase imperative — matches the fork's routine-commit convention. Avoid `docs:` scope.)*
5. Tag: `git tag -a 3.1.1 -m "3.1.1 — prompt-injection defense"`. **No `v` prefix** — the fork
   uses unprefixed tags (verified via `git tag -l` showing `3.0.0`, `3.0.1`, `3.0.2`, `3.0.3`,
   `3.1.0`). Confirm before tagging: `git tag -l | tail -10`.

Verify:
- `package.json` version is `3.1.1`.
- CHANGELOG has a `## [3.1.1]` block.
- CLAUDE.md `## Security` has the new subsection.
- `git log --oneline main..HEAD` shows ~3 commits: cherry-pick + dist rebuild + docs/version.
- `git tag -l '3.1.1'` shows the new tag (no `v` prefix).

#### Phase 3.5: Process-lifecycle hardening (XS — 10 min)

**Goal:** `startInjectionCleanup()`'s `setInterval` actually stops on shutdown.

`server.start()` schedules a periodic cleanup; `server.shutdown()` clears it via
`stopInjectionCleanup()`. But `configs/pagespeed.ts` never wires SIGINT/SIGTERM to
`server.shutdown()`, so `Ctrl-C` leaves the interval dangling for the duration of the Node
shutdown phase. Two-line fix in `configs/pagespeed.ts` (after `await server.start(...)`):

```ts
const shutdown = async (signal: NodeJS.Signals) => {
  console.error(`[pagespeed] received ${signal}, shutting down`);
  await server.shutdown();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
```

Commit: `git commit -m "wire SIGINT/SIGTERM to server.shutdown for clean injection-cleanup teardown"`

### Work Breakdown & Dependencies

| #  | Phase | Task / Group | Depends On | Parallel Group | Est. Files | Est. Effort |
|----|-------|-------------|------------|----------------|------------|-------------|
| 1  | Phase 0 | Stash/commit existing plans, fetch upstream, capture test baseline | — | A | 0 | XS |
| 2  | Phase 1 | `git checkout upstream/main` for 4 new files (sanitize, detection-logger + tests) | 1 | B | 4 | XS |
| 3  | Phase 1 | `git checkout upstream/main` for 13 modified files (processor, schema/generator, mcp-curl-server, tool-wrapper, prompts, jq-query, types, security/index, utils/index) | 1 | B | 13 | S |
| 4  | Phase 2 | `npm test` — verify all 396+ tests pass | 2, 3 | C | 0 | S |
| 5  | Phase 2 | `npm run build` — rebuild dist/ locally, commit artefacts | 4 | C | ~10 | S |
| 6  | Phase 2 | Manual smoke: run `analyze_pagespeed` against a real URL, verify response shape | 5 | C | 0 | S |
| 7  | Phase 3 | Bump `package.json` to `3.1.1` (skip collisions `3.0.3` + `3.1.0`) | 6 | D | 1 | XS |
| 8  | Phase 3 | Append CHANGELOG entry under `## [3.1.1]` Security | 6 | D | 1 | XS |
| 9  | Phase 3 | Update CLAUDE.md `## Security` with prompt-injection observability subsection | 6 | D | 1 | S |
| 10 | Phase 3.5 | Add SIGINT/SIGTERM handler to `configs/pagespeed.ts`; add `analyzed_url === input URL` re-validation in post-processor | 6 | D | 1 | XS |
| 11 | Phase 3 | Tag `3.1.1` (no `v` prefix; after all commits) | 7, 8, 9, 10 | E | 0 | XS |

### PR Plan

**Recommended PR title:** `feat: cherry-pick prompt injection defense from upstream mcp-curl (v3.1.1)`

**PR body template** — mirror `e5f1fc1`'s structure (the prior fork-sync PR):

```markdown
## Summary

Cherry-pick upstream mcp-curl PR #20 (`5f32c85` — feat(security): prompt injection defense for
MCP tool responses) into the mcp-pagespeed fork. 17 src/ files transplanted at upstream parity;
fork's URL-validation hardening preserved untouched; `analyze_pagespeed` benefits transparently
through `processResponse()` and `registerCustomTool()`.

## What changed

| Layer | Change |
|---|---|
| Library (verbatim from upstream `5f32c85`) | 4 new files (sanitize, detection-logger + tests), 13 modified (response/processor, schema/generator, mcp-curl-server, tool-wrapper, prompts, jq-query, types, barrels) |
| Fork-specific | `configs/pagespeed.ts` adds SIGINT/SIGTERM handler + post-processor `analyzed_url` re-validation |
| Docs | `CLAUDE.md` `## Security` gains `### Prompt-injection observability` subsection |
| Versioning | `3.0.2` → `3.1.1` (skipping collisions `3.0.3`, `3.1.0`); CHANGELOG entry |
| Build | `dist/` rebuilt locally (chunk hashes diverge from upstream by design) |

## Fork-specific code changes

- `configs/pagespeed.ts` — SIGINT/SIGTERM → `server.shutdown()`; assertion that API-returned
  `data.id` equals the requested URL.
- `CLAUDE.md` — new `### Prompt-injection observability` block (see commit).
- All 7 fork-divergent `src/lib/**` files left untouched (httpOnlyUrl hardening preserved).

## Testing

- `npm test` — baseline + ~66 new tests pass (58 sanitize + 8 detection-logger).
- `npm run build` — clean compile, sentinel grep for `WHITESPACE REMOVED` / `injection-defense`
  / `InjectionDetected` in `dist/`.
- `npm run smoke` — automated `analyze_pagespeed` against `https://example.com`; asserts
  scores object shape, no false-positive `[injection-defense]` log.

## Post-Deploy Monitoring & Validation

- Watch stderr for `[injection-defense] [pagespeedonline.googleapis.com] InjectionDetected`
  entries; throttled to 1/min/hostname; benign on docs sites that mention "act as" / `<system>`.
- Fork's 9 `httpOnlyUrl` tests still pass — confirms preservation.

🤖 Compound Engineered by [Every](https://every.to) using [Claude Code](https://claude.com/claude-code)
```

The fork's existing convention is to land cohesive features as single PRs (see PR #1 "feat:
upgrade to mcp-curl 3.0.1 + fork improvements (v3.0.2)"). This work is small enough to follow
the same model, but the cherry-pick has a natural seam (library files vs. fork docs/version)
that makes a 2-PR split slightly easier to review.

| PR | Includes Tasks | Est. Files | Review Complexity | Can Start After |
|----|---------------|------------|-------------------|-----------------|
| PR-1 | 1, 2, 3, 4, 5, 6 | ~27 (17 src + ~10 dist) | Medium — security-sensitive code, but verbatim upstream copy with tests passing in upstream's CI | Immediately |
| PR-2 | 7, 8, 9, 10, 11 | 4 + tag | Low — version bump + docs + SIGINT handler + post-processor URL re-validation | PR-1 merged |

**Single-PR alternative:** If reviewer prefers, fold PR-2 into PR-1. The split is purely
optical: the cherry-pick commits and the docs/version commits live on the same branch and
chain. **Recommendation: single PR** unless reviewer specifically asks for split. Total is
< 30 files including dist; well within review tolerance.

**Parallel development:** None. Linear chain (Phase 0 → 1 → 2 → 3).

**Critical path:** Task 1 → 2/3 → 4 → 5 → 6 → 7/8/9/10 → 11. No part of the work
parallelises meaningfully because every step is short and the next step depends on the
previous having landed in the working tree.

## Alternative Approaches Considered

| Approach | Verdict |
|---|---|
| **Full upstream resync** (replace fork's `src/lib/` with upstream/main verbatim) | **Rejected.** Would regress fork's URL-validation hardening (consolidation of `httpOnlyUrl` use across `CurlExecuteSchema` / `ApiInfoSchema`) and pull in 25+ unrelated diffs (docs rewrites, prompt test deletions) that have no security value. |
| **`git cherry-pick 5f32c85` directly** | **Rejected.** No common ancestor between the two repos (`git merge-base main upstream/main` returns nothing); `git cherry-pick` would either fail or generate massive false conflicts. Per-file `git checkout` is the correct mechanic for unrelated-history transplants. |
| **Manual rewrite of sanitize.ts / detection-logger.ts** | **Rejected.** Reinventing security-sensitive code that has been reviewed and tested upstream. The whole point of the cherry-pick is to inherit the testing and review investment. |
| **Restructure fork to consume `mcp-curl` as published npm dep instead of vendoring** | **Out of scope.** Best long-term answer but a separate refactor. This plan keeps the existing vendoring model and ensures parity with upstream-current. |
| **Manually merge `utils/index.ts`** | **Rejected.** Verification (`diff <(cat fork) <(git show upstream)`) confirms the upstream change is a pure addition that preserves the existing fork lines verbatim. `git checkout` is safe and cleaner than hand-editing. |
| **Auto-enable `enableSpotlighting: true` in `configs/pagespeed.ts`** | **Partially rejected; mitigated differently.** Custom tools registered via `registerCustomTool()` bypass the `tool-wrapper.ts` spotlighting wrapper, so the flag is a no-op. The earlier "trusted fields only" claim was partly wrong (`analyzed_url = data.id` and `strategy = lighthouse.configSettings?.formFactor` echo attacker-influenced values). Mitigation chosen: in `configs/pagespeed.ts` post-processor, **re-validate `analyzed_url` matches the input URL exactly** (cheap, surgical, defends against API-echoed payload smuggling). Optionally also wrap with `applySpotlighting(JSON.stringify(output), randomUUID())` for defence in depth. File upstream tracking issue: `applySpotlightingToCustomTools` should respect `enableSpotlighting` for custom tools. |
| **Pull upstream's broader docs rewrites** | **Rejected.** Upstream docs reference `curl_execute` semantics, `jq_query` flags, generic API authentication patterns — all of which are either disabled, niche, or off-topic for a single-purpose PageSpeed server. Update only this fork's CLAUDE.md. |
| **Cherry-pick upstream `dist/*` chunks** | **Rejected.** TS bundling produces non-deterministic chunk hashes across machine state. Local rebuild is mandatory; upstream's chunks would mismatch a fresh build. |

## Acceptance Criteria

### Functional Requirements

- [ ] All 17 cherry-picked source files match upstream/main byte-for-byte (`diff <(git show HEAD:<path>) <(git show upstream/main:<path>)` returns empty for each).
- [ ] `src/lib/utils/sanitize.ts` exports `sanitizeDescription`, `sanitizeResponse`, `detectInjectionPattern`, `applySpotlighting`, `MAX_CUSTOM_TOOL_DESCRIPTION_LENGTH`.
- [ ] `src/lib/security/detection-logger.ts` exports `logInjectionDetected`, `cleanupInjectionDetectionMap`, `startInjectionCleanup`, `stopInjectionCleanup`.
- [ ] `McpCurlServer.start()` calls `startInjectionCleanup()`; `shutdown()` calls `stopInjectionCleanup()`.
- [ ] `registerCustomTool()` sanitizes `meta.title` and `meta.description`; description is truncated to 1000 chars; a `console.warn` fires only when sanitization-result-length exceeds the cap.
- [ ] `processResponse()` runs the early size guard FIRST, then sanitizes (text-MIME-type only — binary types pass through), then runs detection logging, then runs jq filter (if any), then size-checks against `maxResultSize`.
- [ ] `executeJqQuery()` sanitizes filter output AFTER applying the jq filter (so concentrated injection strings post-filter are caught).
- [ ] `tool-wrapper.ts` applies `applySpotlighting()` to built-in tool output when `config.enableSpotlighting === true` and `result.isError !== true`. **Custom tools (including `analyze_pagespeed`) are NOT auto-wrapped — this is by design and documented; mitigated in `configs/pagespeed.ts` post-processor.**
- [ ] `McpCurlConfig.enableSpotlighting?: boolean` is in the public type AND in `KNOWN_CONFIG_KEYS_ARRAY` exhaustiveness check.
- [ ] Fork-specific files preserved unchanged: `src/lib/utils/url.ts`, `src/lib/utils/url.test.ts`, `src/lib/schema/validator.ts`, `src/lib/server/schemas.ts`, `src/lib/index.ts`, `src/lib/prompts/api-discovery.test.ts`, `src/lib/prompts/api-test.test.ts`.
- [ ] `configs/pagespeed.ts` adds: (a) SIGINT/SIGTERM handler invoking `server.shutdown()`, and (b) post-processor assertion that `analyzed_url === input URL` (rejects/redacts mismatches to defend against API-echoed payload smuggling). No other behaviour change.
- [ ] `CHANGELOG.md` has a `## [3.1.1] - 2026-04-30` entry under `### Security`.
- [ ] `package.json` version is `3.1.1` (NOT `3.0.3` and NOT `3.1.0` — both already exist as tags).
- [ ] `CLAUDE.md` `## Security` section gains a "Prompt-injection observability" subsection covering: log format `[injection-defense] [pagespeedonline.googleapis.com] InjectionDetected`, throttle behavior (1/hostname/min), the custom-tool spotlighting caveat, and the `clearInjectionDetectionMap()` test-isolation note.

### Non-Functional Requirements

- [ ] `npm test` passes with zero failures (baseline + ~66 new tests).
- [ ] `npm run build` produces a clean dist/ with no TypeScript errors.
- [ ] `npx tsx configs/pagespeed.ts` starts the server without crashing.
- [ ] Manual `analyze_pagespeed` smoke test against a real URL returns the expected scores/metrics/summary shape.
- [ ] No fork-side runtime regression: PageSpeed responses round-trip through sanitization and JSON.parse without corruption (Lighthouse JSON values may contain `<system>`, `act as`, etc. inside string values — these MUST NOT break parsing; they should be left intact in the sanitized output and may trigger throttled detection logs which is the expected/desired behaviour).
- [ ] Cherry-pick commit hash `5f32c85` is referenced in the CHANGELOG entry for traceability.

### Quality Gates

- [ ] No new dependencies added to `package.json`.
- [ ] `dist/` is rebuilt locally (not cherry-picked from upstream); `git diff` on dist/ shows the expected new chunks. `dist/` sentinel grep confirms the bundled output contains the strings `WHITESPACE REMOVED`, `injection-defense`, and `InjectionDetected` in at least one chunk each (otherwise the bundler tree-shook the new modules).
- [ ] All preserved fork divergences pass their existing tests (specifically the 9 `httpOnlyUrl` tests in `url.test.ts`).
- [ ] No reference to upstream's deprecated logger format `curl_execute error: [hostname] InjectionDetected` (the actual implementation uses `[injection-defense] [hostname] InjectionDetected` — verified by reading `detection-logger.ts` at `5f32c85`).
- [ ] Tag `3.1.1` (no `v` prefix) exists locally — verify pattern with `git tag -l | tail -10` showing prior unprefixed tags `3.0.0` … `3.1.0`.
- [ ] `npm run smoke` script defined in `package.json` and exits 0 on a clean Lighthouse audit.
- [ ] Any fork test that exercises `logInjectionDetected` (now or in future) calls `clearInjectionDetectionMap()` in `beforeEach`. Add a CLAUDE.md note under `## Testing` so future authors don't trip on the module-level state.
- [ ] All 14 cherry-pick `git checkout` commands in Phase 1 reference the immutable SHA `5f32c85` (not `upstream/main`).

## Success Metrics

- Zero behaviour change for clean Lighthouse JSON responses (sanitization is a no-op on
  normal UTF-8 content).
- Detection-log entries appear when a Lighthouse audit surfaces page-controlled HTML
  containing known injection patterns (e.g. a page that legitimately uses `<system>` or
  documentation-site copy that includes "act as"). Operator can verify the throttle works by
  observing at most one log per minute even under repeated calls.
- Fork's URL-validation tests (the 9 `httpOnlyUrl` cases in `url.test.ts`) continue to pass —
  confirms the cherry-pick did not regress fork-specific hardening.
- A future upstream sync that pulls additional, unrelated upstream changes can do so via the
  same per-file mechanic: this cherry-pick establishes the pattern and the per-file divergence
  list.

## Dependencies & Prerequisites

- `upstream` git remote configured to `git@github.com:sixees/mcp-curl.git` (already in place;
  verified with `git remote -v`).
- `upstream/main` fetched recently enough to include commit `5f32c85` (run `git fetch upstream`
  in Phase 0 to confirm).
- Node `>=18` installed (per `tsup.config.ts` target).
- All existing fork tests passing on `main` before starting (capture baseline in Phase 0).
- Working tree must be clean except for `docs/plans/` — commit those first per Phase 0.

No external service dependencies, no migration steps, no feature flags.

## Risk Analysis & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Fork-preserved file (e.g. `src/lib/utils/url.ts`) imported by a cherry-picked test, mismatch causes test failure | Low | Medium | If failure occurs, examine the import: most likely upstream test imports same symbols fork already exports. If not, the divergence is real and should be reconciled by either (a) extending fork's helper, or (b) accepting upstream's test version (decide per-case). |
| Lighthouse JSON contains 50+-space runs inside CSS / minified HTML inside string values, becomes `[WHITESPACE REMOVED]` marker | Medium | Low | The marker is still valid inside a JSON string (no escaping issue). Result: data-quality degradation in the affected snippet only. Score / metric extraction is unaffected. **Acceptance:** add a regression test that fetches a real Lighthouse JSON for a media-heavy page and confirms `JSON.parse` succeeds and scores are correct. |
| Lighthouse audit output contains tokens that trigger detection (`<system>`, `act as`, "developer mode") legitimately | High | Low | Detection is observability-only; content is never suppressed. Throttle = 1 log/min/hostname. Operator should expect occasional benign detections; the `[injection-defense]` log prefix makes them grep-able. **Acceptance:** document this in CLAUDE.md so on-call engineers don't mistake them for incidents. |
| Module-level `lastDetectedMap` in `detection-logger.ts` leaks state between fork test files | Low | Low | vitest runs with `--isolate` by default. If a future fork test (e.g. `configs/pagespeed.test.ts`) imports a code path that triggers `logInjectionDetected`, add `clearInjectionDetectionMap()` to its `beforeEach`. **Acceptance:** noted in CLAUDE.md (testing section) for future authors. |
| Early-size guard rejects a legitimately large Lighthouse response | Very Low | Medium | `LIMITS.MAX_RESPONSE_SIZE = 10_000_000` (10 MB); typical Lighthouse JSON is 0.5–3 MB. Comfortable headroom. **Acceptance:** verify in Phase 2 smoke test against a media-heavy site. |
| `dist/` chunk hashes diverge from upstream's, confusing future code review | Low | Low | Expected behaviour — TS bundling is non-deterministic. Document in PR description that dist/ was rebuilt locally. |
| Throttle hostname is always `pagespeedonline.googleapis.com`, log entries lose discriminating info | Certain | Low | Inherent to the chosen hostname-based throttle. The log prefix + timestamp + correlation with the most-recent `analyze_pagespeed` invocation is the intended investigation path. Documented in CLAUDE.md. |
| `enableSpotlighting: true` mistakenly assumed to wrap `analyze_pagespeed` output | Medium | Low | Documented prominently in CLAUDE.md and CHANGELOG. Code reviewer should challenge any future `.configure({ enableSpotlighting: true })` in `configs/pagespeed.ts` and require accompanying manual `applySpotlighting()` call OR removal of the flag. |
| Upstream's test for `tool-wrapper.ts` references types/imports that fork has shifted | Low | Medium | If cherry-picked tests fail to compile, run `npx tsc --noEmit` and follow the error chain. The most likely culprit is a missing export in fork's barrel — fix forward by adding the export, not by reverting the cherry-pick. |
| Hidden behavioural test (e.g. snapshot) in upstream tests that depends on specific whitespace | Low | Low | Upstream's CI passed PR #20; tests are self-consistent. If a fork-specific test snapshot drifts, regenerate with `vitest -u` only after manual inspection. |
| Cherry-pick branch goes stale before merge; further upstream changes interfere | Low | Low | Pin to `5f32c85` exactly (not `upstream/main` HEAD). Branch is short-lived; expect merge within a day or two. |
| API echoes attacker-controlled URL into `analyzed_url`, smuggling ASCII keyword payload past sanitizer | Medium | Low–Medium | Post-processor in `configs/pagespeed.ts` asserts `analyzed_url === input URL`; mismatch → either redact the field or surface as a warning. Defends against PageSpeed API echoing modified URLs. |
| `tsup` tree-shakes `sanitize.ts` / `detection-logger.ts` if no entry-point imports them transitively | Low | High | Phase 2 sentinel grep (`grep -l "WHITESPACE REMOVED" dist/`, `injection-defense`, `InjectionDetected`) catches this before commit. If absent, add an explicit re-export in `src/lib/index.ts` until the entry chain is verified. |
| Vitest 4 `lastDetectedMap` leaks across files in the same fork | Low | Low | Per-file isolation handles current state. New fork tests that import `logInjectionDetected` MUST call `clearInjectionDetectionMap()` in `beforeEach`. Documented in CLAUDE.md `## Testing`. |
| `setInterval` from `startInjectionCleanup()` keeps the process alive on `Ctrl-C` | Medium | Low | Phase 3.5 wires SIGINT/SIGTERM → `server.shutdown()` → `stopInjectionCleanup()`. Without this, container orchestrators see the process hang on shutdown until SIGKILL. |

## Resource Requirements

- **Engineer:** 1 person, ~3–4 hours of focused work end-to-end (most of it is verification,
  not code writing).
- **Reviewer:** 1 person, ~30 minutes (security-sensitive but verbatim upstream copy with
  upstream tests already passing — review effort is mostly confirming the fork-preservation
  list and reading the CHANGELOG / CLAUDE.md updates).
- **Infrastructure:** None. Local machine + GitHub PR.

## Future Considerations

### Follow-up tracking issues to file alongside this PR

1. **Upstream issue: `applySpotlightingToCustomTools`** — file in `sixees/mcp-curl`. Custom
   tools registered via `registerCustomTool()` bypass the spotlighting wrapper. Proposal:
   when `enableSpotlighting === true`, apply `applySpotlighting()` to custom-tool output as
   well, gated by a per-tool opt-out (some custom tools may emit structured-only data). This
   removes the asymmetry that currently forces every consumer to wrap manually.
2. **Upstream issue: `httpOnlyUrl` consolidation** — file in `sixees/mcp-curl`. Apply the
   fork's URL-validation hardening (using `httpOnlyUrl()` consistently in `CurlExecuteSchema`
   / `ApiInfoSchema`, exporting from `src/lib/index.ts`). If upstream accepts, the fork's
   divergence list shrinks from 7 files to ~3.
3. **Fork issue: convert to npm consumer of mcp-curl** — file in `sixees/mcp-pagespeed`.
   Long-term, depend on a published `mcp-curl` package rather than vendoring `src/lib/`.
   Future cherry-picks would become `npm update` + a `configs/` adjustment. Blocking work:
   land both upstream issues above first so the fork's preserved divergences either upstream
   or stay minimal.

### Other

- **PageSpeed-specific handler-side spotlighting** — If the post-processor's
  `analyzed_url` re-validation proves insufficient (e.g. Lighthouse adds new echoed
  attacker-influenced fields), wrap output via
  `applySpotlighting(JSON.stringify(output), randomUUID())`.
- **Detection log enrichment** — The `[injection-defense]` log line lacks the analyzed URL.
  A fork-side wrapper around `logInjectionDetected` could enrich it, but this would be a
  fork divergence that complicates future upstream syncs. Defer until operational signal
  proves the un-enriched form insufficient.
- **Lighthouse-content false-positive whitelist** — If detection logs become noisy on real
  audit data, consider a fork-side configurable whitelist for known-benign Lighthouse audit
  IDs. Out of scope here; revisit only if operational signal demands it.

## Documentation Plan

- **CLAUDE.md** — Update `## Security` section with a `### Prompt-injection observability`
  subsection (3 bullets: log format, throttle behaviour, custom-tool spotlighting caveat).
  Done in Phase 3.
- **CHANGELOG.md** — Append `## [3.0.3] - 2026-04-30` entry under `### Security` with a
  reference to upstream PR #20 / commit `5f32c85`. Done in Phase 3.
- **No README changes** — fork's README focuses on installation + tool usage; the security
  defense is invisible to end-users by design.
- **No `docs/configuration.md` changes** — `enableSpotlighting` is documented in upstream's
  copy, but the fork doesn't ship that doc and shouldn't recommend the flag (which has no
  effect on `analyze_pagespeed`).
- **No JSDoc updates** — all relevant JSDoc is part of the cherry-picked files.

## References & Research

### Internal References

- Plan format reference: this fork's `docs/plans/` convention is established by the present file (no prior plan currently exists in `docs/plans/` other than this one).
- Fork CLAUDE.md (Security section): `CLAUDE.md:49-52`
- Fork PageSpeed entry point: `configs/pagespeed.ts`
- Custom tool registration path (modified by upstream PR): `src/lib/extensible/mcp-curl-server.ts:registerCustomTool`
- URL-validation hardening commit (preserved): `e5f1fc1` ("feat: upgrade to mcp-curl 3.0.1 + fork improvements (v3.0.2)") — also the PR-body template reference.
- Fork's `httpOnlyUrl` helper: `src/lib/utils/url.ts`
- Fork's tag history: `git tag -l | tail -10` — confirms unprefixed-tag convention before tagging `3.1.1`.

### External References

- Upstream commit being cherry-picked: <https://github.com/sixees/mcp-curl/commit/5f32c85>
- Upstream PR #20: <https://github.com/sixees/mcp-curl/pull/20>
- Microsoft Research on spotlighting (arXiv:2403.14720): <https://arxiv.org/html/2403.14720>
- Cisco on Unicode Tag prompt injection: <https://blogs.cisco.com/ai/understanding-and-mitigating-unicode-tag-prompt-injection>
- OWASP LLM01:2025 Prompt Injection: <https://genai.owasp.org/llmrisk/llm01-prompt-injection/>

### Related Work

- Previous fork release: v3.0.2 (2026-04-04) — Zod v4 / MCP SDK 1.29 upgrade plus URL hardening
- Previous fork commit list (since `git log --oneline upstream/main..main`): cbcabb7, f14ec96, e5f1fc1, 08a9d57, bb213ee, 482439b, 4263eec, c6083ca, 986eae6, fffee51, 9765c06

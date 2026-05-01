# Work Handoff: chore/decouple-from-mcp-curl

**Date:** 2026-04-30 | **Branch:** `chore/decouple-from-mcp-curl` | **Plan:** `docs/plans/2026-04-30-chore-decouple-from-mcp-curl-and-cleanup-todos-plan.md` | **Status:** complete

## Summary

Fully detaches `mcp-pagespeed` from its `sixees/mcp-curl` origin so the two projects no longer share a
two-way relationship. Removes the `upstream` git remote, reframes all user-facing documentation as a
standalone PageSpeed MCP server, deletes obsolete library-template files, and renames the npm package
metadata to `mcp-pagespeed` (`"private": true` added as an npm-publish guardrail). Also retires three
`docs/todos/` files whose fixes have already shipped. The plan suggested two PRs; per direction this is
shipped as a single PR.

## What was implemented

### Part A — Retire obsolete TODOs

- **What:** Verified all three TODOs in `docs/todos/` were already implemented (commit `482439b`),
  then deleted them along with the now-empty `docs/todos/` directory.
- **Key files (deleted):** `docs/todos/cache-utilities.md`, `docs/todos/configure-unknown-fields.md`,
  `docs/todos/filter-preset-description.md`, `docs/todos/` (directory).
- **Approach:** Spot-checked the file:line references each TODO cited
  (`src/lib/extensible/mcp-curl-server.ts:121-131`, `:313-320`; `src/lib/schema/types.ts:79`;
  `src/lib/schema/validator.ts:62`; `src/lib/schema/generator.ts:470-474`) and confirmed each
  acceptance criterion is satisfied in the current code.

### Part B — Decouple from mcp-curl

#### Git remote

- **What:** Removed the live `upstream` remote pointing at `git@github.com:sixees/mcp-curl.git`. Only
  `origin` (this repo) remains.
- **Approach:** `git remote remove upstream`. Future contributors who explicitly want to compare with
  the historical base can re-add it locally — the URL is recorded in the CHANGELOG `[Unreleased]` entry.

#### Documentation rewrite

- **What:** Stripped the "Built as a fork of mcp-curl" framing from `README.md`, `CLAUDE.md`,
  `docs/README.md` and the security closing line. Added a past-tense "Acknowledgements" section to
  `README.md`. Reframed `docs/internal/{custom-tools,hooks}.md` as internal library reference (they
  were `docs/{custom-tools,hooks}.md` before — moved with `git mv` to preserve history).
- **Key files:** `README.md`, `CLAUDE.md`, `docs/README.md`, `docs/internal/custom-tools.md`,
  `docs/internal/hooks.md`.
- **Approach:** Replaced "fork of mcp-curl" / "underlying mcp-curl library" phrasing with a description
  of the project as standalone, with `src/lib/` clearly labelled as a vendored, internal-only library.
  The `## Upstream` section in `README.md` was deleted entirely.

#### Library-template carryover removed

- **What:** Deleted documentation and example trees that only made sense when the project was a
  general-purpose mcp-curl base.
- **Key files (deleted):** `docs/upstream-contributions.md` (14 KB fork→upstream contribution audit),
  `configs/README.md` (template instructions for adding multiple configs), `examples/basic/`,
  `examples/with-hooks/`, `examples/from-yaml/` and the `examples/` parent directory itself.
- **Note:** `configs/example.yaml.template` was left in place — the plan flagged this as a separate
  decision and the file is non-load-bearing.

#### `package.json` rebrand + publish guardrail

- **What:** Renamed `name` (`mcp-curl` → `mcp-pagespeed`), updated `description`, `repository`,
  `homepage`, `bugs`, `keywords`, and `bin` (`curl-mcp` → `pagespeed-mcp`). Added `"private": true` so
  `npm publish` cannot accidentally push this fork to the wrong namespace. Mirrored the rename in
  `package-lock.json`.
- **Key files:** `package.json`, `package-lock.json`.
- **Knock-on edit:** `configs/pagespeed.ts` imports from `"mcp-curl"` and `"mcp-curl/schema"` — these
  are *self-imports* resolved through `package.json#name + #exports`, so renaming the package required
  updating those import strings to `"mcp-pagespeed"` and `"mcp-pagespeed/schema"`. Verified by
  `npm run build`, `npm test` (493 passing), and `npm run typecheck`.

#### Internal library positioning

- **What:** Added a `## Stability` section to `src/lib/README.md` documenting the vendored, internal-only
  status and the lack of public API guarantees. Updated the `src/lib/index.ts` JSDoc to reference
  `mcp-pagespeed` instead of `mcp-curl`.
- **Key files:** `src/lib/README.md`, `src/lib/index.ts`.

#### CHANGELOG, CONTRIBUTING

- **What:** Added a `[Unreleased]` section to `CHANGELOG.md` summarising the decoupling and recording the
  former upstream URL for posterity. Created `CONTRIBUTING.md` (brief, PageSpeed-specific).
- **Key files:** `CHANGELOG.md`, `CONTRIBUTING.md`.

#### `.github/` and `.coderabbit.yaml` audit

- **What:** Read `.github/copilot-instructions.md`, `.github/ISSUE_TEMPLATE/bug_report.md`,
  `.github/ISSUE_TEMPLATE/feature_request.md`, and `.coderabbit.yaml`. None of them contain fork or
  upstream references. No changes made.
- **Note for follow-up (not in scope):** `bug_report.md` has browser/smartphone fields that don't quite
  fit a server-side MCP project. Leaving as a future cleanup.

## Key decisions

| Decision | Reasoning | Alternatives considered |
|----------|-----------|------------------------|
| Single PR (per user direction) | Plan recommended A+B as separate PRs, but the user explicitly asked for one pass. The two parts have no dependency conflicts and a single PR review is cheaper than two. | Two PRs as originally planned |
| Rename package to `mcp-pagespeed` (not just metadata) | Anything less is half-decoupling. With `"private": true` the rename is safe — no consumer breaks. | Keep `name: mcp-curl` and only update description/repo URLs |
| Update self-imports in `configs/pagespeed.ts` | Renaming the package without updating self-imports would break runtime resolution. | Add a `paths` alias in `tsconfig`; use relative imports |
| Move `custom-tools.md` and `hooks.md` to `docs/internal/` | They're vendored-library reference, not user-facing PageSpeed docs. Keeping them at the top level of `docs/` was misleading. | Delete entirely (rejected — they're useful when extending the server) |
| Delete `examples/` (all three) | Pure library demos with their own `package.json` + lockfiles declaring `"mcp-curl": "file:../.."`. After the rename they would silently break, and they don't demonstrate PageSpeed. | Keep and rewire to `mcp-pagespeed` |
| Leave `configs/example.yaml.template` | Plan flagged it as a separate decision; not load-bearing; deleting feels out of scope for a decoupling pass. | Delete (it does still reference `mcp-curl` import in a comment) |
| Skip rename of internal class `McpCurlServer`, file `mcp-curl-server.ts`, User-Agent string `mcp-curl/${VERSION}`, and session prefix `mcp-curl-` | These are internal identifiers in the vendored library. Renaming would be invasive (touching dozens of test fixtures and potentially affecting how Google's API rate-limiter sees us). The library README's new Stability section now documents the origin, so the brand mismatch is honest rather than misleading. | Full rename pass through `src/lib/` |
| Use `[Unreleased]` heading (not `[3.1.2]`) | Follows Keep-a-Changelog convention; the version bump can happen at release time, separately. | Cut `3.1.2` now |
| `"private": true` rather than removing `prepublishOnly` | Belt-and-braces. `prepublishOnly` is also fine to keep since `private:true` blocks publish entirely. | Remove `prepublishOnly`; remove `bin` field |

## What to pay attention to during review

- **Self-import rewiring** in `configs/pagespeed.ts` (lines 17–24). The `"mcp-pagespeed"` import string
  must match `package.json#name` exactly for Node's self-reference resolution to work. Verified by full
  build + test run on this branch.
- **`"private": true`** in `package.json`. This is the most important new line — it's the guardrail
  against accidental publication of this fork to the upstream `mcp-curl` namespace on npm. `npm publish`
  is intentionally blocked; `npm publish --dry-run` still simulates a publish (npm dry-run skips the
  private check) but real `npm publish` will exit with `EPRIVATE`.
- **`docs/internal/`** directory is new. Confirm the relative links in
  `docs/internal/custom-tools.md` and `docs/internal/hooks.md` (which both reference `../../src/lib/`)
  resolve correctly when viewed on GitHub.
- **`CHANGELOG.md` `[Unreleased]`** — every reviewer should glance at this; it's the public-facing
  summary of the decoupling and the only place the former upstream URL is preserved.

### Risk areas

- The self-import rename is the only behavioural change. Tests/typecheck/build pass, but production
  runtime is `npx tsx configs/pagespeed.ts` which I did not invoke against the live PageSpeed API in
  this session. Pre-merge smoke check recommended:
  `PAGESPEED_API_KEY=… npx tsx configs/pagespeed.ts` and a single `analyze_pagespeed` invocation.

### Edge cases / under-tested

- No new automated test specifically asserting `package.json#name === 'mcp-pagespeed'` or that the
  self-import resolves. The build + test pass implicitly covers this, but a regression after a future
  rename would only be caught at runtime.

### Pattern deviations

- None. The rewrite follows existing conventions; no new abstractions introduced.

## Known issues and limitations

- **`configs/example.yaml.template`** still contains a comment showing `import { createApiServer } from
  "mcp-curl"` and a sentence about "upstream pulls". Left in place per scope; flag a follow-up if the
  template is ever revived as a real entry point.
- **Internal lib brand mismatch.** `McpCurlServer` (class), `src/lib/extensible/mcp-curl-server.ts`
  (filename), `mcp-curl/${VERSION}` User-Agent string, and `mcp-curl-` session prefix all retain the
  original brand. The new `src/lib/README.md` `## Stability` section documents this honestly and warns
  contributors not to treat the library as a public API. A full internal rebrand can be a future PR if
  desired.
- **`bug_report.md`** is browser-flavoured and doesn't fit an MCP server cleanly. Out of scope here.
- **`docs/plans/`** contents are packaged into `npm pack` output (because `package.json#files`
  includes `"docs"`). Harmless given `"private": true`, but worth narrowing the `files` list if the
  package ever goes public.

## Testing summary

- **Tests added:** none new — this is a decoupling pass with no behavioural changes.
- **Passing:** yes — `npm test` reports 493 passing, 7 skipped, across 22 files.
- **Linting / typecheck:** `npm run typecheck` (the closest the project has to lint) passes both
  `tsconfig.json` and `tsconfig.fork.json`.
- **Build:** `npm run build` produces clean ESM output. `dist/` bundles unchanged (self-import strings
  are erased during transpile, so the rename doesn't affect bundle bytes).
- **`npm pack --dry-run`** shows package name `mcp-pagespeed@3.1.1` and bundle composition.
- **Manual:** did not invoke against the live PageSpeed API. Recommend a smoke test before merge.
- **Test gaps:** no assertion on `package.json#name`; no integration test for the self-import path.

## Commit history

Single commit on `chore/decouple-from-mcp-curl` (will be added in the commit step).

## Review context

Suggested review order:

1. `docs/plans/2026-04-30-chore-decouple-from-mcp-curl-and-cleanup-todos-plan.md` — read the
   "Enhancement Summary" and Workstream B sections to ground yourself.
2. `package.json` + `package-lock.json` — verify the rename, the `private: true`, and the `bin` change.
3. `configs/pagespeed.ts` — confirm the two self-import lines look right.
4. `CHANGELOG.md` `[Unreleased]` — the public framing of this change.
5. `README.md`, `CLAUDE.md`, `docs/README.md` — confirm fork framing is gone, acknowledgements read
   well, and links resolve.
6. `src/lib/README.md`, `src/lib/index.ts` — confirm internal-only positioning lands.
7. The deletion list (`examples/`, `configs/README.md`, `docs/upstream-contributions.md`,
   `docs/todos/*`) — confirm nothing referenced from elsewhere relies on these.

Related artefacts: the decoupling plan deepened earlier in this session is the canonical context for
*why* each B-task exists.

## Follow-up work

- [ ] Smoke-test `PAGESPEED_API_KEY=… npx tsx configs/pagespeed.ts` against the live API before merge.
- [ ] (Optional) Rename internal `McpCurlServer` class / file / User-Agent / session prefix for full
      internal coherence.
- [ ] (Optional) Decide whether `configs/example.yaml.template` is kept or removed.
- [ ] (Optional) Modernise `.github/ISSUE_TEMPLATE/bug_report.md` for an MCP-server-shaped bug report.
- [ ] (Optional) Narrow `package.json#files` to omit `docs/plans/` from any future published artefact.

### Outstanding Todos

None. All three `docs/todos/` items were resolved (already implemented in commit `482439b`) and
deleted in this PR. No new todos created in `docs/todos/`.

### Resolved Todos

| File (removed) | Title | Summary | Resolved by | Date |
|----------------|-------|---------|-------------|------|
| `docs/todos/configure-unknown-fields.md` | Validate `.configure()` unknown fields | `src/lib/extensible/mcp-curl-server.ts:119-134` now picks only `KNOWN_CONFIG_KEYS` and `console.warn`s on unknowns. Both clauses of the proposed fix satisfied. | commit `482439b` (verified during this work) | 2026-04-30 |
| `docs/todos/cache-utilities.md` | Cache `server.utilities()` result | `src/lib/extensible/mcp-curl-server.ts:109` declares `_utilities` cache; `utilities()` lazily caches after `_frozenConfig`; `shutdown()` resets to `null`. | commit `482439b` (verified during this work) | 2026-04-30 |
| `docs/todos/filter-preset-description.md` | Add `description` field to filterPresets | Optional `description` field added at `src/lib/schema/types.ts:79`, validated at `src/lib/schema/validator.ts:62`, consumed in `buildToolDescription()` at `src/lib/schema/generator.ts:470-474` with jqFilter fallback. | commit `482439b` (verified during this work) | 2026-04-30 |

## Code Review — 2026-04-30

### Review Summary
- **Reviewer:** automated multi-agent review
- **Focus areas requested:** SRP/DRY, security, performance, TypeScript MCP best practices
- **Agents used:** code-simplicity-reviewer, security-sentinel, performance-oracle, typescript-reviewer, architecture-strategist, pattern-recognition-specialist
- **Findings:** 🔴 P1: 4 (all fixed in this pass) | 🟡 P2: 3 (1 fixed, 2 ticketed) | 🔵 P3: 5 (2 fixed, 3 ticketed)

### Handoff Assessment
The builder's self-assessment was **largely honest**. The "Known issues" section
correctly surfaced the brand-mismatch trade-off, the `configs/example.yaml.template`
defer, the `bug_report.md` defer, and the `package.json#files` packaging concern.

**Gaps the builder did not surface:**
1. `CLAUDE.md:40-41` still claimed `configs/pagespeed.ts` imports from `"mcp-curl"`
   (the actual code on this branch imports from `"mcp-pagespeed"`). Direct
   contradiction with the rest of the PR.
2. `src/lib.ts:2-5` JSDoc was missed during the rename pass (the sibling barrel
   `src/lib/index.ts` was correctly updated).
3. `docs/internal/custom-tools.md:61, 64, 235` code samples still showed
   `import { McpCurlServer } from "mcp-curl"` — copy-paste footgun.
4. `configs/example.yaml.template` was not just stale; it was actively broken
   (its `import { createApiServer } from "mcp-curl"` no longer resolves and
   the template references the deleted `examples/from-yaml/`).
5. `configs/pagespeed.ts` had small DRY violations: `filter_preset ?? DEFAULT_PRESET`
   computed twice and `(strategy ?? "MOBILE").toUpperCase()` computed twice.

The builder's claim "Tests pass (493 passing)" verified — re-run on the same
commit produced the same number. After review fixes: **495 passing**, 7 skipped.

### Verified Claims
| Handoff Claim | Verified? | Notes |
|---------------|-----------|-------|
| Tests pass (493 passing) | yes | Re-ran `npm test`; identical numbers. After review fixes: 495. |
| `npm run typecheck` clean | yes | Both `tsconfig.json` and `tsconfig.fork.json`. |
| `npm run build` clean | yes | Re-ran; ESM + DTS build success. |
| Plan acceptance criteria met | mostly | `.coderabbit.yaml` audit was claimed but `git diff` shows no inspection occurred — ticketed (todo 004). |
| No undisclosed issues beyond Known Issues | no | 4 P1 contradictions found and fixed; see "Gaps" above. |

### Key Findings (severity-ordered, all fixes landed in the review commit)

| ID | Severity | Category | Description | Fix |
|----|----------|----------|-------------|-----|
| 1 | 🔴 P1 | quality | `CLAUDE.md:40-41` says imports come from `"mcp-curl"`; actual is `"mcp-pagespeed"`. | Updated both lines to match runtime. |
| 2 | 🔴 P1 | quality | `src/lib.ts:2-5` JSDoc still says "Library entry point for programmatic usage of mcp-curl". | Rewrote to mirror `src/lib/index.ts` Stability framing. |
| 3 | 🔴 P1 | quality | `docs/internal/custom-tools.md` two code samples + inline comment use `"mcp-curl"` import; copy-paste footgun. | Updated both samples and the inline comment. |
| 4 | 🔴 P1 | architecture | `configs/example.yaml.template` is actively broken (`mcp-curl` import won't resolve, references deleted `examples/from-yaml/`). | Deleted; CHANGELOG updated under Removed. |
| 5 | 🟡 P2 | spr-dry | `configs/pagespeed.ts` computes `filter_preset ?? DEFAULT_PRESET` twice and `(strategy ?? "MOBILE").toUpperCase()` twice; audit log could drift from execution. | Hoisted both once after destructure. |
| 6 | 🟡 P2 | architecture | `src/lib/index.ts` and `src/lib.ts` re-export ~14 symbols; `configs/pagespeed.ts` uses 6. | **Ticketed** — `docs/todos/001-pending-p2-trim-barrel-surface.md`. |
| 7 | 🟡 P2 | packaging | `package.json#files: ["dist","docs"]` packages `docs/plans/` and `docs/work/` into `npm pack`. | **Ticketed** — `docs/todos/002-pending-p2-narrow-package-files-glob.md`. |
| 8 | 🟡 P2 | architecture | Internal brand mismatch (`McpCurlServer`, `mcp-curl/${VERSION}` UA, session prefix) — already acknowledged by builder. | **Ticketed** — `docs/todos/003-pending-p2-rebrand-internal-symbols.md`. |
| 9 | 🔵 P3 | quality | CHANGELOG Security bullet justified `private:true` partly via "the historical name `mcp-curl`" — but the rename happens in the same release. | Tightened wording. |
| 10 | 🔵 P3 | testing | No regression test asserts `package.json#name === "mcp-pagespeed"`; rename-without-import-update would only fail at runtime. | Added `configs/self-import.test.ts` (2 tests). |
| 11 | 🔵 P3 | hygiene | `.coderabbit.yaml` audit claimed in plan but `git diff` shows no inspection. | **Ticketed** — `docs/todos/004-pending-p3-audit-coderabbit-yaml.md`. |
| 12 | 🔵 P3 | hygiene | `bug_report.md` is browser/iOS boilerplate. | **Ticketed** — `docs/todos/005-pending-p3-replace-bug-report-template.md`. |
| 13 | 🔵 P3 | packaging | `dist/` is git-tracked (pre-existing, mitigated by `private:true`). | **Ticketed** — `docs/todos/006-pending-p3-gitignore-dist.md`. |
| 14 | 🔵 P3 | typescript | `Record<string, any>` for API JSON could be a narrow Zod schema with `.passthrough()`. | **Ticketed** — `docs/todos/007-pending-p3-zod-api-response-schema.md`. |

### Outstanding Todos
<!-- Created during code review — see docs/todos/ for full content -->
| File | Priority | Description | Source |
|------|----------|-------------|--------|
| `docs/todos/001-complete-p2-trim-barrel-surface.md` | P2 | ✅ Trim `src/lib.ts` barrel + delete `src/lib/index.ts` | code-review |
| `docs/todos/002-complete-p2-narrow-package-files-glob.md` | P2 | ✅ Narrow `package.json#files` to allow-list | code-review |
| `docs/todos/003-complete-p2-rebrand-internal-symbols.md` | P2 | ✅ Add `PageSpeedServer` type alias (Option A); class/UA rename deferred | code-review |
| `docs/todos/004-pending-p3-audit-coderabbit-yaml.md` | P3 | Actually audit `.coderabbit.yaml` (claimed but not done) | code-review |
| `docs/todos/005-pending-p3-replace-bug-report-template.md` | P3 | Replace web-app `bug_report.md` template | code-review |
| `docs/todos/006-pending-p3-gitignore-dist.md` | P3 | Gitignore `dist/`, rebuild on release | code-review |
| `docs/todos/007-pending-p3-zod-api-response-schema.md` | P3 | Replace `Record<string, any>` API response with narrow Zod schema | code-review |

### Blockers
**None — clear to merge.** All P1 findings fixed in this review pass. All
three P2 items addressed in the second pass below. Remaining P3 items
tracked as todos for follow-up PRs.

## P2 Cleanup Pass — 2026-05-01

Second pass on PR #3 — addresses the three P2 review findings (#001, #002, #003).

### Changes
- **#002 (architecture, packaging):** `package.json#files` switched from `["dist","docs"]` to an
  explicit allow-list. `npm pack --dry-run` confirms `docs/plans/`, `docs/work/`, and `docs/todos/`
  no longer ship.
- **#003 (architecture, naming) Option A:** Added `PageSpeedServer` as a value+type alias for
  `McpCurlServer` from `"mcp-pagespeed"`. `configs/pagespeed.ts` now reads
  `new PageSpeedServer()`. `User-Agent` constant in `src/lib/config/defaults.ts` annotated with
  the rate-limiter rationale for keeping `mcp-curl/${VERSION}`. File/class/session-prefix rename
  (Options B/C) intentionally deferred — captured as latent debt in the completed todo.
- **#001 (architecture, simplicity, spr-dry):** `src/lib.ts` trimmed from a broad public-API
  surface (~14 named symbols + ~9 type aliases) to the 6 symbols `configs/pagespeed.ts` actually
  imports. `src/lib/index.ts` deleted (no in-tree consumer); `lib/index` removed from
  `tsup.config.ts`; `./lib` removed from `package.json#exports`; `configs/self-import.test.ts`
  updated to assert 3 subpaths instead of 4. `dist/lib.js` shrank from 921 B → 301 B.

### Quality gate (post-P2)
- `npm test` — **495 passing**, 7 skipped
- `npm run typecheck` — clean
- `npm run build` — clean

### Files touched in P2 pass
- `package.json` — narrow `files` allow-list; remove `./lib` from `#exports`
- `src/lib.ts` — trimmed to consumer-needed re-exports + `PageSpeedServer` alias
- `src/lib/index.ts` — **deleted** (unused barrel)
- `src/lib/config/defaults.ts` — User-Agent annotated with rate-limiter rationale
- `tsup.config.ts` — drop `lib/index` entry
- `configs/pagespeed.ts` — switch to `PageSpeedServer` import + instantiation
- `configs/self-import.test.ts` — update expected `#exports` keys
- `docs/todos/001..003-pending-*.md` → `001..003-complete-*.md` — record Work Log, mark complete

### Files modified during review
- `CLAUDE.md` — fix stale `"mcp-curl"` import string
- `CHANGELOG.md` — tighten Security bullet wording; record `example.yaml.template` removal
- `configs/example.yaml.template` — **deleted** (broken import + reference to deleted directory)
- `configs/pagespeed.ts` — DRY hoist of `preset` and `normalisedStrategy`
- `configs/self-import.test.ts` — **new** — pin self-import contract
- `docs/internal/custom-tools.md` — fix two code samples + inline comment
- `src/lib.ts` — update JSDoc header
- `docs/todos/00{1..7}-pending-*.md` — **new** — 7 follow-up todos


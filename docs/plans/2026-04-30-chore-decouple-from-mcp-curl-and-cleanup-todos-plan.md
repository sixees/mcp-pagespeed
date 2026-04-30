---
title: "Decouple mcp-pagespeed from upstream mcp-curl and retire stale todos"
type: chore
status: active
date: 2026-04-30
---

# Decouple mcp-pagespeed from upstream mcp-curl and retire stale todos

## Enhancement Summary

**Deepened on:** 2026-04-30
**Sections enhanced:** 8
**Research agents used:** doc-classifier (general-purpose), best-practices-researcher,
architecture-strategist, code-simplicity-reviewer, plan-critic, spec-flow-analyzer

### Key improvements introduced by deepening

1. **Hidden references uncovered.** Original plan's "Files touched" list missed
   `package.json` (`repository.url`, `homepage`, `bugs.url`, `description`, `keywords`),
   `.github/copilot-instructions.md`, `.github/ISSUE_TEMPLATE/`, `.coderabbit.yaml`,
   and a JSDoc example in `src/lib/index.ts:5`. All except the JSDoc are doc-shape
   changes safe to land in this round.
2. **Safety guardrail added.** `package.json#name` is still `"mcp-curl"` and
   `prepublishOnly: npm run build` is wired. Until the rename ships, we add
   `"private": true` to prevent an accidental `npm publish` from shipping under the
   upstream's name on the npm registry.
3. **B6 scope shrank by 60%.** Doc classifier showed `docs/api-schema.md`,
   `docs/configuration.md`, and `docs/getting-started.md` are already PageSpeed-specific
   — they don't need relocation, only intro fixes (covered by B4). Only
   `docs/custom-tools.md` and `docs/hooks.md` are pure library carryover.
4. **Todo verification tightened.** Each retired todo now cites the original acceptance
   criterion AND the resolving code snippet, not just file+line. Catches the
   plan-critic's concern that "something was done in that area" ≠ "the todo's intent
   was satisfied."
5. **Single CHANGELOG entry** as `[Unreleased]` — kills the cross-PR amend fragility
   the architecture-strategist flagged.
6. **Stability marker for `src/lib/`.** Without one, the new framing
   ("`configs/` is the application, `src/lib/` is the internal library") is rhetoric,
   not enforcement. One paragraph in `src/lib/README.md` makes the framing real.
7. **Past-tense acknowledgement** of the mcp-curl origin in README, replacing the
   present-tense "Built as a fork" framing. License attribution stays untouched
   (LICENSE is already Sixees Labs copyright, no upstream-author line to preserve).
8. **PR consolidation: 3 → 2.** Simplicity reviewer's "1 PR" was too compressed;
   architecture-strategist's "3 PRs" added ceremony. Compromise — todos in PR-1,
   everything else in PR-2.

### New considerations

- The plan is honest that `package.json#name` and `McpCurlServer` class rename are
  out-of-scope. With `"private": true` as a guardrail, the gap is contained — the
  package can't accidentally publish, and the rest is stylistic until someone wants to
  do the source-rename round.
- `LICENSE` was already re-attributed to Sixees Labs (not the upstream's original
  copyright). This means no MIT-attribution carryover work is required — confirmed
  during research. A NOTICE file is unnecessary; a past-tense README acknowledgement
  is sufficient.

---

## Overview

Two adjacent cleanup workstreams that close out the fork era of this project:

1. **Todo retirement (A).** All three files in `docs/todos/` describe issues that were
   already fixed in commit `482439b` ("harden config validation, cache utilities, add
   filterpreset descriptions"). They are paperwork that outlived the work — delete them.
2. **Fork decoupling (B).** This codebase still presents itself as an in-flight fork of
   `sixees/mcp-curl` (live `upstream` git remote, README/CLAUDE/docs intro framing,
   `docs/upstream-contributions.md` audit, inherited library docs/examples, and a
   half-dozen non-doc references uncovered by the deepening pass). The user wants
   `mcp-pagespeed` to read as a standalone application and to stop tracking upstream.
   Remove the remote and rewrite/retire the documentation that perpetuates the fork
   framing.

## Problem Statement / Motivation

**Todos are stale.** All three were authored when the fork still planned to send
patches upstream. Verification — each row pairs the original todo's acceptance criterion
with the implementing code:

| Todo | Original acceptance | Implementing code | Verdict |
|------|---------------------|-------------------|---------|
| `configure-unknown-fields.md` — *"Either pick known fields explicitly or warn on unknown keys"* | `src/lib/extensible/mcp-curl-server.ts:121-131` iterates `KNOWN_CONFIG_KEYS`, copies only listed keys via `picked[key] = config[key]`, and `console.warn`s on unknowns. **Both clauses of the OR satisfied** — explicit pick AND warn. | **Done — delete** |
| `cache-utilities.md` — *"Cache the InstanceUtilities instance after first call (or after start()), return cached value on subsequent calls"* | `src/lib/extensible/mcp-curl-server.ts:313-320` returns fresh instance pre-`start()` (correct — config not frozen yet), lazily caches in `_utilities` after `_frozenConfig` is set, returns cached on subsequent calls. Reset to `null` in `shutdown()` (lines 405, 489). | **Done — delete** |
| `filter-preset-description.md` — *"Add an optional description field to the preset type. buildToolDescription() would use it when present, falling back to the current jqFilter-based text"* | `types.ts:79` field exists; `validator.ts:62` Zod rule (trim, min 1, max 500); `generator.ts:470-474` consumes via `if (preset.description) … else jqFilter fallback` — *exactly* the proposed fallback semantics; `pagespeed.yaml:77/80/83` populates all three presets. | **Done — delete** |

Commit `482439b` resolved all three. Todo files survived only because nobody pruned them.

**Fork framing no longer matches reality.** The fork's purpose has been to ship a
purpose-built PageSpeed MCP server. The upstream-tracking workflow it inherited
(`upstream` remote, `git pull upstream main`, "Built as a fork of mcp-curl" framing,
upstream-contribution audit, generic library docs, generic library examples, and
package metadata pointing at `mcp-curl`) implies an ongoing two-way relationship the
user has decided to end.

### Research Insights

**Best Practices** (from `best-practices-researcher` and `plan-critic` review):

- **Past-tense framing.** "This project began as a fork of [mcp-curl] at version X.Y.Z.
  Since version 4.0.0 it is maintained independently and no longer tracks upstream."
  Past tense is the load-bearing signal that the relationship has ended.
- **License/attribution.** MIT requires the original copyright preserved. *Verified*:
  `LICENSE` already reads `Copyright (c) 2026 Sixees Labs` (no upstream-author line
  to preserve — both fork and upstream are Sixees-authored). No `NOTICE` file needed;
  a README acknowledgement section covers attribution.
- **CHANGELOG conventions.** Keep-a-Changelog has no formal "split point" marker.
  Community pattern is a `### Changed` line under `[Unreleased]` (or a new minor/major
  release) noting the detachment in plain language. Avoid invented sections like
  `### Forked` — they break Keep-a-Changelog parsers.
- **`upstream` remote removal.** `git remote remove upstream` is per-clone config;
  there is no commit-history footprint and nothing to record in repo state. The
  upstream URL goes in CHANGELOG so anyone can recreate the remote from history.

## Proposed Solution

### Workstream A — Todo retirement

Delete all three files. Capture the verification table above in the commit message so
the deletion is auditable. No code changes; the underlying fixes are already merged.

### Workstream B — Fork decoupling

Renumbered for the deepened scope. `B6` shrank, `B10`–`B18` are new from research.

**Doc-shape work (no code touched):**

- **B1. Remove the `upstream` git remote.** `git remote remove upstream`. Reversible.
  Document the URL (`git@github.com:sixees/mcp-curl.git`) in CHANGELOG so it can be
  recreated.
- **B2. README.md rewrite.** Drop "Built as a fork of mcp-curl using its extension
  system." Remove `## Upstream` (the `git remote add upstream … && git pull` recipe).
  Replace the closing line of the Security section that links to `mcp-curl`'s security
  doc — inline a brief security summary or link to `CLAUDE.md` for the trust model.
  **Add a small Acknowledgements section** with the past-tense framing from Research
  Insights above.
- **B3. CLAUDE.md rewrite.** *Sequenced after B6 to avoid the circular dependency
  flagged by the plan-critic.* Rewrite "What This Is" as a standalone PageSpeed
  Insights MCP server description. Strip "fork-specific code lives in `configs/`" in
  favour of "`configs/` is the application; `src/lib/` is the internal MCP/HTTP
  library it is built on." Replace the `[upstream docs]` link with a pointer to
  whatever `docs/internal/` contains after B6 (or omit if B6 deletes everything).
- **B4. docs/README.md rewrite.** Same intro fix. Re-curate the Guides list
  (`docs/README.md:75-82`): keep `getting-started.md`, `configuration.md`,
  `api-schema.md` (all already PageSpeed-specific per the doc-classifier review);
  point `custom-tools.md` and `hooks.md` to wherever B6 places them.
- **B5. Delete `docs/upstream-contributions.md`.** Whole document is the audit report
  for the moment of the split. Keep deletion default; if the user wants a frozen
  historical record they can `git revert`.
- **B6. Library-internal docs decision** *(scope shrunk by deepening)*. The classifier
  pass found 3 of 5 inherited docs are already PageSpeed-specific (`api-schema.md`,
  `configuration.md`, `getting-started.md`) — they don't need relocation, only the
  intro/link fixes already covered by B4. Only **`docs/custom-tools.md` and
  `docs/hooks.md`** are pure library carryover. **Recommended**: relocate both to
  `docs/internal/` with a one-line preface ("Library reference for the internal
  `src/lib/` module that powers `analyze_pagespeed`. End users do not interact with
  these APIs."). Architecture-strategist supports this over deletion because deletion
  reintroduces the upstream coupling the plan is trying to remove (the docs would
  have to be sourced from upstream when needed). Same outcome if user prefers
  deletion — git history preserves them.
- **B7. configs/README.md rewrite.** *Confirmed pure library carryover by classifier.*
  Current text is a how-to for *consumers of the library template*. Either delete
  (recommended — no PageSpeed content to keep) or replace with a one-paragraph
  pointer to `pagespeed.ts` and `pagespeed.yaml`.
- **B8. examples/ directory decision.** All three (`basic`, `with-hooks`, `from-yaml`)
  are pure mcp-curl library demos with their own `package.json` + lockfile. They do
  not exercise PageSpeed paths. **Recommended**: delete. Each carries a lockfile that
  costs maintenance for zero PageSpeed-relevance value. *spec-flow-analyzer note*:
  these `package.json`s declare `"mcp-curl": "file:../.."`, which would silently break
  if the deferred package rename ever ships. Deleting now closes that loop.
- **B9. CHANGELOG.md split-marker.** Add `[Unreleased]` (NOT a new versioned heading
  — that's reserved for the next release cut) with a single `### Changed` entry:
  *"Project no longer tracks `mcp-curl` upstream. The `upstream` git remote
  (`git@github.com:sixees/mcp-curl.git`) was removed; documentation rewritten to
  reflect standalone status; doc-shape package metadata aligned. Source-level rebrand
  (`package.json#name`, `McpCurlServer` class, `configs/example.yaml.template`,
  unused library scaffolding) is a separate effort — see Out of Scope below."*

**Newly in-scope from deepening (still doc-shape, no code touched):**

- **B10. `package.json` doc-shape fields.** Update `repository.url` (currently
  `git+https://github.com/sixees/mcp-curl.git`) and `homepage`
  (`https://github.com/sixees/mcp-curl#readme`) and `bugs.url`
  (`https://github.com/sixees/mcp-curl/issues`) to point at `mcp-pagespeed`. Update
  `description` ("MCP server for executing cURL commands" → PageSpeed-appropriate
  text). Update `keywords` (drop `curl`, add `pagespeed`/`lighthouse`/`web-vitals`).
  These are doc-shape — no import or code path depends on them.
- **B11. `package.json#private: true` guardrail (CRITICAL).** `package.json#name` is
  still `"mcp-curl"`; the rename is out-of-scope this round (would require updating
  the self-import in `configs/pagespeed.ts`). With `prepublishOnly: npm run build`
  wired, an accidental `npm publish` would attempt to ship to the *upstream's* npm
  namespace. Add `"private": true` until the rename ships. This is a one-line edit
  with zero side effects (no consumer relies on `npm install mcp-pagespeed` from
  this repo today — it is consumed via `npx tsx configs/pagespeed.ts`).
- **B12. `.github/copilot-instructions.md`.** Verified present (4.4KB, dated
  Mar 11). Likely contains fork-era framing. Audit and update.
- **B13. `.github/ISSUE_TEMPLATE/`.** Verified present. Inspect `bug_report.md` /
  `feature_request.md` for upstream references and align with the standalone framing.
- **B14. `.coderabbit.yaml`.** Verified present. Grep for any path reference to
  files we're moving or deleting in this plan; update if needed.
- **B15. README Acknowledgements.** Add a short past-tense paragraph (see Research
  Insights above) so the mcp-curl origin is preserved as history without implying
  ongoing tracking. Replaces the present-tense "fork of" framing throughout.
- **B16. `src/lib/README.md` stability note.** *Architecture-strategist
  recommendation.* Without an explicit signal that `src/lib/` is frozen vendored code,
  the new framing is enforcement-free. Add one paragraph at the top:
  > **Stability:** This module is vendored from a snapshot of mcp-curl. It is
  > maintained in-tree for bug fixes and security patches; new behaviour belongs in
  > `configs/`, not here. Treat the public surface as frozen.
- **B17. CONTRIBUTING.md decision.** No `CONTRIBUTING.md` exists today. The fork-era
  assumption was that contributions flow upstream — true no longer. Defensible
  options: (a) write a one-page CONTRIBUTING.md with build/test/PR instructions
  (recommended); (b) leave it absent and add a one-line note to README ("Contributions
  welcome — file issues at sixees/mcp-pagespeed"). The plan should at least *decide*.
- **B18. JSDoc cleanup in `src/lib/index.ts:5`.** Source comment example reads
  `import { McpCurlServer, createApiServer } from "mcp-curl"`. *This is a comment-only
  change*, not behaviour, so it stays inside the doc-shape envelope. Either replace
  with a relative-import example (`from "./lib/index.js"`) or drop the example
  altogether. Acceptable to defer to the source-rename round; flagged for
  completeness.

### Out of scope (intentional)

The user asked for documentation changes. The following are code-level rebrands and
each has cascading effects; they belong in a follow-up plan once this round lands:

- `package.json#name` rename `"mcp-curl"` → `"mcp-pagespeed"`. Cascades into the
  self-import in `configs/pagespeed.ts:23` (`import … from "mcp-curl"`) which would
  need to switch to relative imports or a `package.json#imports` subpath alias
  (`#lib/*`). Best-practices research recommends `imports` for rename-resilience over
  bare relative paths once the rename happens.
- `bin: curl-mcp` entry in `package.json:26-28`. The `mcp-pagespeed` binary should
  not be named `curl-mcp`.
- Class and file rename: `McpCurlServer` class, `mcp-curl-server.ts` filename.
- Generic library scaffolding the PageSpeed server doesn't use:
  `src/lib/api-server.ts`, `src/lib/prompts/`, the HTTP transport layer,
  `configs/example.yaml.template`. Keep or strip — separate decision.

The CHANGELOG entry under B9 explicitly lists these so the next maintainer can pick
them up without re-discovering the gap.

## Technical Considerations

- **No code changes anywhere.** Even the newly in-scope items (B10–B18) are doc-shape
  edits — `package.json` metadata fields don't affect compile or runtime; comments
  in `src/lib/index.ts` are inert.
- **`"private": true` is the only behaviour-relevant addition.** It blocks
  `npm publish` until removed. This is the desired safety property until the rename
  ships.
- **Test suite untouched.** `npm run build` and `npm test` are not exercised by this
  plan; nothing they cover is being modified.
- **Reversibility.** All deletions are recoverable from git. The remote removal is
  recoverable from the URL captured in CHANGELOG. `private: true` is reversible by
  removing the line.

### Research Insights — Hidden references covered

Spec-flow-analyzer surfaced these references that the original plan would have missed.
Each is now an explicit B-item:

| File | Reference | Resolved by |
|------|-----------|-------------|
| `package.json:33-40` | `repository`, `homepage`, `bugs.url` point at `mcp-curl` | B10 |
| `package.json:2-4` | `name`, `description` mismatch | B10 (description) + B11 (private guard for name) |
| `package.json:51-57` | `keywords: [curl, …]` | B10 |
| `.github/copilot-instructions.md` | Likely fork-era framing | B12 |
| `.github/ISSUE_TEMPLATE/*.md` | Templates may reference upstream | B13 |
| `.coderabbit.yaml` | May reference paths being moved | B14 |
| `src/lib/index.ts:5` | JSDoc example imports `from "mcp-curl"` | B18 |
| `package-lock.json:2,8` | `name: mcp-curl` | Auto-regenerates after B10 (if name renamed); irrelevant otherwise |
| `examples/*/package.json` | `"mcp-curl": "file:../.."` | Resolved by deletion under B8 |

## Acceptance Criteria

### Part A — todos retired

- [ ] `docs/todos/configure-unknown-fields.md`, `docs/todos/cache-utilities.md`,
      `docs/todos/filter-preset-description.md` deleted
- [ ] Commit message includes the verification table (resolving commit `482439b`,
      original-vs-implementation pairs)
- [ ] `docs/todos/` directory removed (no future-todos use case anticipated; recreate
      if needed)

### Part B — fork decoupling

- [ ] `git remote -v` shows only `origin`
- [ ] `README.md` no longer claims this project is a fork; `## Upstream` section
      removed; Acknowledgements section in past tense added
- [ ] `CLAUDE.md` "What This Is" rewritten as standalone description; `[upstream
      docs]` link replaced or removed
- [ ] `docs/README.md` intro and Guides list reflect the post-decoupling layout
- [ ] `docs/upstream-contributions.md` deleted
- [ ] `docs/custom-tools.md` and `docs/hooks.md` relocated to `docs/internal/` with
      one-line preface, OR deleted (decision recorded in commit message)
- [ ] `configs/README.md` deleted or rewritten as a single paragraph
- [ ] `examples/{basic,with-hooks,from-yaml}/` deleted
- [ ] `package.json` `repository`, `homepage`, `bugs.url`, `description`, `keywords`
      aligned to mcp-pagespeed
- [ ] `package.json` has `"private": true`
- [ ] `.github/copilot-instructions.md`, `.github/ISSUE_TEMPLATE/*`, `.coderabbit.yaml`
      reviewed and updated
- [ ] `src/lib/README.md` has a Stability section
- [ ] `CONTRIBUTING.md` either created or explicitly decided against (recorded in
      commit message)
- [ ] `src/lib/index.ts:5` JSDoc updated or flagged in CHANGELOG follow-ups
- [ ] `CHANGELOG.md` has an `[Unreleased]` `### Changed` entry capturing the split,
      the upstream URL, and the source-rename follow-ups
- [ ] `npm pack --dry-run` succeeds (sanity check on `package.json#files`)
- [ ] Final coverage check:
      `grep -ri "mcp-curl\|upstream" --include="*.md" --include="*.json" --include="*.yaml" --include="*.yml" --exclude-dir=node_modules --exclude-dir=dist .`
      returns only intentional references (CHANGELOG history, the new follow-ups note,
      Acknowledgements, license-preserved attribution if any)

## Success Metrics

- A new contributor reading `README.md` cold cannot guess this project began as a fork
  (Acknowledgements aside).
- `docs/todos/` no longer contains paperwork that contradicts the code.
- The phrase "upstream" appears only in CHANGELOG history and the follow-ups note.
- An accidental `npm publish` cannot ship to the `mcp-curl` namespace
  (verified by `private: true`).
- `npm pack --dry-run` succeeds with no warnings about deleted-but-listed paths.

## Dependencies & Risks

- **Sequencing constraint.** B6 must happen before (or in the same commit as) B3 —
  CLAUDE.md's `[upstream docs]` link target depends on B6's outcome (relocate vs
  delete).
- **B11 `private: true` is intentionally permanent until the rename ships.** Removing
  it without renaming would re-expose the publish footgun. Tie removal to the
  follow-up plan that does the rename.
- **`grep` coverage check.** Use the multi-extension grep in Acceptance Criteria, not
  the markdown-only one — the broader grep catches `package.json`, YAML, and
  `package-lock.json`.
- **Reversibility.** All removed/relocated content is in git history. Remote can be
  recreated from the URL recorded in CHANGELOG.

## Work Breakdown & PR Plan

*Consolidated from 3 PRs to 2 based on simplicity-reviewer feedback. Architecture-
strategist's reviewability concern is addressed by clear sub-headers in the PR-2 body
rather than separate PRs.*

| # | Task | Group | PR |
|---|------|-------|-----|
| 1 | Delete three obsolete todo files (Part A) | A | PR-1 |
| 2 | `git remote remove upstream` (local config — note in PR description) | B | PR-2 |
| 3 | README.md rewrite + Acknowledgements (B2, B15) | B | PR-2 |
| 4 | docs/README.md rewrite (B4) | B | PR-2 |
| 5 | Delete `docs/upstream-contributions.md` (B5) | B | PR-2 |
| 6 | Relocate `custom-tools.md` + `hooks.md` to `docs/internal/` with prefaces (B6) | B | PR-2 |
| 7 | CLAUDE.md rewrite — *sequenced after step 6 in same PR* (B3) | B | PR-2 |
| 8 | Delete or rewrite `configs/README.md` (B7) | B | PR-2 |
| 9 | Delete `examples/` (B8) | B | PR-2 |
| 10 | `package.json` doc-shape fields (B10) | B | PR-2 |
| 11 | `package.json` `"private": true` (B11) | B | PR-2 |
| 12 | `.github/copilot-instructions.md` audit (B12) | B | PR-2 |
| 13 | `.github/ISSUE_TEMPLATE/*` audit (B13) | B | PR-2 |
| 14 | `.coderabbit.yaml` audit (B14) | B | PR-2 |
| 15 | `src/lib/README.md` Stability section (B16) | B | PR-2 |
| 16 | CONTRIBUTING.md decision + execute (B17) | B | PR-2 |
| 17 | `src/lib/index.ts:5` JSDoc cleanup (B18) | B | PR-2 |
| 18 | CHANGELOG `[Unreleased]` entry (B9) | B | PR-2 |
| 19 | Run final grep coverage + `npm pack --dry-run` | B | PR-2 |

| PR | Includes | Est. Files | Review Complexity | Can Start After |
|----|----------|------------|-------------------|-----------------|
| PR-1 | 1 — retire obsolete todos | 3 | Low — pure deletes; verification table in body | Immediately |
| PR-2 | 2–19 — full decoupling | ~20 | Low/Medium — many files but each change is small and independently reviewable. Body should use sub-headers per step. | Immediately, parallel with PR-1 |

**Parallel development:** PR-1 and PR-2 are independent. PR-2 internally has a single
sequencing constraint (step 6 before step 7).

## References & Research

### Internal — verified against current code

- Resolving commit for all three todos: `482439b harden config validation, cache utilities, add filterpreset descriptions (2.1.2)`
- `src/lib/extensible/mcp-curl-server.ts:121-131` — already-implemented `.configure()` validation (warn + explicit pick)
- `src/lib/extensible/mcp-curl-server.ts:313-320` — already-implemented `utilities()` cache; reset at `:405` and `:489`
- `src/lib/schema/types.ts:79` — already-implemented `description?: string` on filterPresets
- `src/lib/schema/validator.ts:62` — already-implemented Zod validation for description
- `src/lib/schema/generator.ts:470-474` — already-implemented description consumption with jqFilter fallback
- `configs/pagespeed.yaml:77,80,83` — descriptions populated for all three presets
- `package.json:2-4, 33-40, 51-57` — name/description/repository/homepage/bugs/keywords still upstream-pointing
- `src/lib/index.ts:5` — JSDoc example references `from "mcp-curl"`
- `LICENSE:3` — `Copyright (c) 2026 Sixees Labs` (no upstream-author attribution to preserve)
- `.github/copilot-instructions.md`, `.github/ISSUE_TEMPLATE/`, `.coderabbit.yaml` — verified present, content not yet audited

### External — cited in research

- [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) — no formal split-point convention; community pattern is `### Changed` line in past tense
- [Common Changelog](https://common-changelog.org/) — same conclusion
- [Semantic Versioning 2.0.0](https://semver.org/) — major bump for project rename/scope is community consensus, not codified
- [Node.js Modules — `imports` field](https://nodejs.org/api/packages.html) — relevant for the deferred package rename (replace self-import `from "mcp-curl"` with `#lib/*` subpath alias)
- [GitHub — Detaching a fork](https://github.com/github/docs/blob/main/content/pull-requests/collaborating-with-pull-requests/working-with-forks/detaching-a-fork.md) — Support-only flow; worth doing so the fork badge clears on the GitHub UI

### Files touched by this plan

- **Delete**: `docs/todos/{configure-unknown-fields,cache-utilities,filter-preset-description}.md`,
  `docs/upstream-contributions.md`, `examples/basic/`, `examples/with-hooks/`,
  `examples/from-yaml/`, `configs/README.md` (or rewrite), `docs/work/` (currently
  empty post-handoff-deletion)
- **Rewrite**: `README.md`, `CLAUDE.md`, `docs/README.md`, `CHANGELOG.md`,
  `package.json` (metadata only), `.github/copilot-instructions.md`,
  `.github/ISSUE_TEMPLATE/*.md` (if upstream-pointing), `.coderabbit.yaml` (if
  upstream-pointing), `src/lib/README.md` (add Stability section), `src/lib/index.ts`
  (JSDoc only)
- **Relocate**: `docs/custom-tools.md` → `docs/internal/custom-tools.md`,
  `docs/hooks.md` → `docs/internal/hooks.md` (each with one-line preface)
- **Add**: `CONTRIBUTING.md` (recommended) or one-line README contribution note
- **Git config**: remove `upstream` remote

### Out-of-scope follow-ups (mentioned in CHANGELOG entry)

- Rename `package.json#name` `"mcp-curl"` → `"mcp-pagespeed"` and remove
  `"private": true`. Requires updating the self-import in `configs/pagespeed.ts:23`
  (`from "mcp-curl"`) — recommended approach is `package.json#imports` `#lib/*`
  subpath alias.
- Rename `bin: curl-mcp` → `mcp-pagespeed` (or remove if no CLI is shipped).
- Rename `McpCurlServer` class and `src/lib/extensible/mcp-curl-server.ts`.
- Strip generic library scaffolding (`src/lib/api-server.ts`, prompts/, HTTP
  transport, `configs/example.yaml.template`).

## Conflicts noted during deepening (resolved)

- *Simplicity reviewer wanted 1 PR; architecture-strategist wanted 3.* Resolved at 2 —
  PR-1 (todos) is genuinely independent; PR-2 (decoupling) is a single coherent change
  that benefits from atomicity (no half-decoupled state on `main`).
- *Simplicity reviewer wanted to drop the Risks section; plan-critic wanted more
  user-confirmation steps.* Resolved by trimming Risks to material items only and
  pre-deciding B6/B7/B8 with documented defaults (relocate, delete, delete) — git
  history is the undo button.
- *Simplicity reviewer wanted to drop "Out of Scope" detail; plan-critic wanted the
  rename in scope.* Resolved by keeping Out of Scope (it's the bridge to the next
  plan) but adding `private: true` as the safety guardrail that closes the most
  user-visible gap (publish footgun) without touching code.

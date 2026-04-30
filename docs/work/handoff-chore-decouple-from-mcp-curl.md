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

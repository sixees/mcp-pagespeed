# Work Handoff: Cherry-pick prompt injection defense from upstream mcp-curl@5f32c85

**Date:** 2026-04-30 | **Branch:** feat/cherry-pick-prompt-injection-defense | **Plan:** [docs/plans/2026-04-30-feat-cherry-pick-prompt-injection-defense-plan.md](../plans/2026-04-30-feat-cherry-pick-prompt-injection-defense-plan.md) | **Status:** complete

## Summary

Targeted file-level cherry-pick of upstream mcp-curl PR #20 (commit `5f32c85`, "feat(security): prompt injection defense for MCP tool responses") into the mcp-pagespeed fork. 18 files transplanted at upstream parity (verified byte-for-byte against the pinned SHA), all 7 fork-divergent files preserved untouched, and two fork-side hardenings added to `configs/pagespeed.ts` (SIGINT/SIGTERM → `server.shutdown()`, and `analyzed_url` re-validation against the trusted input URL). Version bumped 3.0.2 → 3.1.1 (skipping reserved tag collisions 3.0.3 and 3.1.0); CHANGELOG and CLAUDE.md updated; tag `3.1.1` created locally.

## What was implemented

### Library cherry-pick (Phase 1)
- **What:** 18 src/lib/ files brought to upstream parity at SHA `5f32c85`. 4 new (`utils/sanitize.{ts,test.ts}`, `security/detection-logger.{ts,test.ts}`); 14 modified (response/processor + test, schema/generator, schema/schema.test, extensible/mcp-curl-server + test, extensible/tool-wrapper + test, prompts/api-discovery, prompts/api-test, tools/jq-query, types/public, utils/index, security/index).
- **Key files:** `src/lib/utils/sanitize.ts`, `src/lib/security/detection-logger.ts`, `src/lib/response/processor.ts`, `src/lib/extensible/mcp-curl-server.ts`, `src/lib/extensible/tool-wrapper.ts`.
- **Approach:** `git checkout "$PIN" -- <path>` with `set -euo pipefail`. Pre-flight `comm -23` assertion confirmed barrel additivity at the pinned SHA; post-checkout byte-for-byte parity re-verified for all 18 files; preserved-file untouched-ness re-verified for all 7.

### Build artefacts (Phase 2)
- **What:** `dist/` rebuilt locally; sentinel grep confirms `WHITESPACE REMOVED`, `injection-defense`, and `InjectionDetected` are present in the bundle (no tree-shaking). `npm run smoke` script added under `scripts/smoke.ts`.
- **Key files:** `dist/chunk-GHEGCO52.js`, `dist/chunk-JR2FMDGP.js`, `scripts/smoke.ts`, `package.json`.
- **Approach:** Smoke script spawns `configs/pagespeed.ts` as a subprocess, speaks MCP JSON-RPC over stdio (initialize → notifications/initialized → tools/call), validates response shape and stderr cleanliness. Gracefully skips on Google quota exhaustion when `PAGESPEED_API_KEY` is not set.

### Version + docs (Phase 3)
- **What:** `package.json` 3.0.2 → 3.1.1; CHANGELOG `## [3.1.1] - 2026-04-30` block under `### Security`; CLAUDE.md `## Security` gains `### Prompt-injection observability` subsection; tag `3.1.1` created (no `v` prefix, matching fork convention).
- **Key files:** `package.json`, `CHANGELOG.md`, `CLAUDE.md`.

### Process-lifecycle + URL validation (Phase 3.5)
- **What:** SIGINT/SIGTERM handler in `configs/pagespeed.ts` invokes `server.shutdown()` which clears `startInjectionCleanup()`'s `setInterval`. New `trustedAnalyzedUrl()` post-processor helper compares the PageSpeed API echo (`data.id`) against the trusted input URL (origin + pathname + search) and falls back to the input on mismatch.
- **Key files:** `configs/pagespeed.ts`.
- **Approach:** Per user direction (post-clarification), chose URL re-validation over `applySpotlighting()` wrap — cheap, surgical, defends against ASCII keyword payloads echoed through `data.id` (which the Unicode sanitizer cannot catch).

## Key decisions

| Decision | Reasoning | Alternatives considered |
|----------|-----------|------------------------|
| Pin checkouts to immutable SHA `5f32c85`, not `upstream/main` | Reproducible after upstream tags new releases; eliminates "branch drifts mid-pick" failure mode | Use `upstream/main` directly — rejected because the moving ref makes the operation non-reproducible |
| Version `3.1.1` (skip `3.0.3` and `3.1.0`) | Both already exist as tags in the fork; collision would block `git tag` | `npm version patch` would have produced `3.0.3` — rejected |
| Re-validate `analyzed_url` instead of wrapping output with `applySpotlighting()` | User's explicit choice; cheaper and surgical; spotlighting custom tools requires upstream change to `tool-wrapper.ts` (out of scope) | Wrap with `applySpotlighting(JSON.stringify(output), randomUUID())` — deferred; documented as future option |
| Smoke script gracefully skips on Google quota 429 when `PAGESPEED_API_KEY` is unset | Operational reality on shared/unauthenticated IPs; CI run with key turns it into a hard gate | Hard fail on 429 — rejected because false-positive on shared-IP dev machines |
| Cherry-pick only; defer upstream contribution PRs and the fork-split | User's explicit scope decision | Bundle all three into one session — rejected per user |
| Plain lowercase imperative commit messages (no scopes) | Matches fork's existing convention (`add`, `remove`, plain `feat:`) per `git log` | Upstream-style `feat(security):` / `build:` / `docs:` — rejected; would diverge from this fork's history |
| Did NOT commit second-rebuild dist/ | tsup chunk hashes are non-deterministic across runs even with identical source; second rebuild produced different filenames with identical content | Commit the rebuild — rejected, would create churn with no functional change |

## What to pay attention to during review

- **Risk areas:**
  - `configs/pagespeed.ts` `trustedAnalyzedUrl()` — origin/pathname/search comparison is the security boundary. Reviewer should confirm this reasoning matches the threat model: PageSpeed API may URL-encode or canonicalize the input differently, but the security goal is "any deviation that could carry an injection payload returns the trusted input". Trailing-slash normalization is handled because `new URL()` normalizes both sides.
  - `configs/pagespeed.ts` SIGINT/SIGTERM handler runs after `await server.start("stdio")`. If `server.start()` throws, the handler is never registered — but the catch block at the bottom of the file already exits with code 1 in that case, so the leak is impossible.
  - Smoke script's Google quota soft-skip: review the regex `text.includes("429") && /(quota|rate ?limit)/i.test(text)` and ensure it can't false-positive on a malicious response that contains "429" in unrelated content. (The check also requires `!process.env.PAGESPEED_API_KEY`, so production CI with a key never short-circuits.)

- **Edge cases considered but possibly uncovered:**
  - PageSpeed API returns a redirect-followed URL as `data.id` (e.g. user submits `https://example.com`, API returns `https://example.com/`) — handled by `new URL()` normalization.
  - PageSpeed API echoes a percent-encoded variant of the input — `URL` normalizes both sides, so this works as long as both encode identically.
  - PageSpeed API echoes a different host (e.g. user submits `https://example.com`, API returns `https://www.example.com` after a CNAME-style redirect) — caught by the origin comparison; falls back to input. **This may surprise users who expect canonical-host echoes.** Documented in CHANGELOG. Acceptable because the security goal is "trusted input wins".

- **Under-tested:**
  - No fork-side unit test for `trustedAnalyzedUrl()`. The function is small and the logic is clear, but a couple of regression cases (matching origin, mismatching origin, unparseable input, non-string echo) would be nice. Added to follow-up.
  - No fork-side test for the SIGINT handler. Hard to test cleanly without spawning a subprocess; the smoke script's existing behavior validates the boot path.
  - Smoke script ran with the soft-skip path (Google quota exhausted). A real end-to-end check requires `PAGESPEED_API_KEY`; should be configured in CI.

- **Pattern deviations:**
  - `scripts/` is a new top-level directory in this fork. Justified by the smoke script not belonging in `src/lib/` (entry-point, not library) or `configs/` (config, not script). Equivalent to `bin/` in some Node projects but `scripts/` matches `package.json` `"scripts"` namespace.

## Known issues and limitations

- **Smoke script could not perform a full end-to-end PageSpeed call locally** — Google's daily quota was already exhausted on the shared/unauthenticated IP before this session. The smoke harness itself is validated (server boot, MCP handshake, tool dispatch, response parsing) but the `[WHITESPACE REMOVED]` / `[injection-defense]` post-processed-output assertions did not exercise. CI must run with `PAGESPEED_API_KEY` set to turn this into a hard gate.
- **`trustedAnalyzedUrl()` is fork-only** — once the upstream `applySpotlightingToCustomTools` issue lands, this can be replaced (or kept as belt-and-braces). Tracked under "Future Considerations" in the plan.
- **`dist/` chunk hashes diverge from upstream** — by design (tsup non-deterministic bundling). Documented in CHANGELOG.
- **Detection-log entries do not include the analyzed URL** — inherent to upstream's hostname-based throttle. Documented in CLAUDE.md.
- **Module-level `lastDetectedMap` in `detection-logger.ts` is per-file isolated under Vitest 4** — future fork tests that exercise `logInjectionDetected` MUST call `clearInjectionDetectionMap()` in `beforeEach`. Documented in CLAUDE.md.

## Testing summary

- **Tests added:** 0 fork-side; 118 carried over from upstream cherry-pick (sanitize 58 + detection-logger ~8 + processor.test new + tool-wrapper additions + schema test additions + mcp-curl-server test additions).
- **Test counts:** Baseline 341 passed | 7 skipped → Post-cherry-pick 459 passed | 7 skipped (across 21 test files, was 18). Net +118 passing.
- **Linting:** N/A (project does not configure a linter; type-check is the equivalent gate).
- **Type-check:** `npx tsc --noEmit` clean post-cherry-pick and post-Phase-3.5.
- **Build:** `npm run build` clean; dist sentinel grep confirms `WHITESPACE REMOVED`, `injection-defense`, and `InjectionDetected` are bundled.
- **Smoke:** `npm run smoke` validated end-to-end harness; soft-skipped the Google round-trip due to API quota (no key configured locally).
- **Manual testing:** None additional — the cherry-picked code is verbatim upstream and upstream's CI passed PR #20.
- **Test gaps:** `trustedAnalyzedUrl()` has no direct unit test; SIGINT handler not exercised; smoke's success-path assertions (`scores` object presence, `[WHITESPACE REMOVED]` absence) were not exercised on a live API call.

## Commit history

```
git log --oneline main..HEAD

39a6e86 wire SIGINT/SIGTERM and re-validate analyzed_url in PageSpeed handler
59b640e document prompt-injection observability for PageSpeed fork
3949f6c rebuild dist for security cherry-pick
1a93832 feat: cherry-pick prompt injection defense from upstream mcp-curl@5f32c85
588ed63 add planning artefacts for upstream security cherry-pick
```

Tag: `3.1.1` (no `v` prefix).

## Review context

- **Suggested review order:**
  1. `docs/plans/2026-04-30-feat-cherry-pick-prompt-injection-defense-plan.md` — context, decisions, and the `Risk Analysis & Mitigation` table.
  2. `588ed63` — planning artefacts only, no functional change.
  3. `1a93832` — cherry-pick. Spot-check 3-4 files against `git show 5f32c85:<path>` to confirm parity; rest can be trusted on the byte-for-byte assertion documented in the commit.
  4. `3949f6c` — dist + smoke script. Read `scripts/smoke.ts` carefully; the rest is bundler output.
  5. `59b640e` — version + CHANGELOG + CLAUDE.md. Reads as a single coherent doc-update.
  6. `39a6e86` — fork-specific code. Smallest commit, biggest review surface (security boundary).
- **Related docs:** `docs/upstream-contributions.md` (audit of fork→upstream port-back candidates; out of scope for this PR but relevant for the long-term split).
- **Dependencies on other work:** None. PR is self-contained.

## Follow-up work

- [ ] Configure `PAGESPEED_API_KEY` in CI and add `npm run smoke` to the workflow as a hard gate.
- [ ] Add unit test for `trustedAnalyzedUrl()` covering: matching origin, mismatching origin, unparseable echo, non-string echo, trailing-slash normalization.
- [ ] File upstream issue: `applySpotlightingToCustomTools` should respect `enableSpotlighting` for custom tools.
- [ ] File upstream PR: backport fork's `httpOnlyUrl()` hardening (consume helper consistently in `validator.ts` and `schemas.ts`, re-export from `src/lib/index.ts`, restore `data:` URL rejection tests). See `docs/upstream-contributions.md`.
- [ ] File fork-side issue: convert to npm consumer of `mcp-curl` once upstream contributions land.
- [ ] Re-run smoke locally once Google quota resets (or with a personal `PAGESPEED_API_KEY`) to validate the success-path assertions on a live audit.

### Outstanding Todos
<!-- Todos created this session that still need work — see docs/todos/ for full content -->

| File | Priority | Description | Source |
|------|----------|-------------|--------|
| docs/todos/cache-utilities.md | Low | `server.utilities()` re-creates `InstanceUtilities` on every call; could be cached after `start()`. Pre-existing TODO; not introduced by this work. | Pre-existing |

### Resolved Todos
<!-- None this session. -->

| File (removed) | Title | Summary | Resolved by | Date |
|----------------|-------|---------|-------------|------|
| — | — | — | — | — |

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
<!-- Resolved during the post-review P1 + P2 sweeps on 2026-04-30. Files retained at `*-complete-*` per repo convention; not deleted. -->

| File | Title | Summary | Resolved by | Date |
|------|-------|---------|-------------|------|
| `docs/todos/001-complete-p1-json-parse-silent-fallback.md` | JSON.parse silent fallback bypasses analyzed_url validation | Replaced silent catch-and-return with fail-closed: stderr line + `isError: true` MCP response. The trust boundary (`trustedAnalyzedUrl`) now has no quiet escape hatch on parse failure. | code-review P1 sweep | 2026-04-30 |
| `docs/todos/002-complete-p1-smoke-script-silent-failures.md` | Smoke script silently swallows server-side failures | Wired `error`/`exit` listeners on the spawned child; replaced regex quota detection with structural `QUOTA_HINT` tag-handshake; bounded stderr at 64 KB; exit-await with SIGTERM (2s) → SIGKILL (4s) escalation. | code-review P1 sweep | 2026-04-30 |
| `docs/todos/003-complete-p1-build-output-srp-violation.md` | buildOutput conflates dispatch, extraction, trust validation | Split into `buildTrustedMeta()` (single home for API-echoed fields that round-trip into LLM context) and `pickPreset()` (pure dispatch). Trust boundary now visible to reviewers as one named function. | code-review P1 sweep | 2026-04-30 |
| `docs/todos/004-complete-p1-tsc-coverage-gap.md` | tsconfig.json doesn't include configs/ or scripts/ | Added `tsconfig.fork.json` (extends main, `noEmit: true`, `rootDir: "."`) and `npm run typecheck` script that runs both configs sequentially. Fork-specific code now type-checked under strict mode. | code-review P1 sweep | 2026-04-30 |
| `docs/todos/005-complete-p1-shutdown-handler-error-handling.md` | SIGINT/SIGTERM handler swallows shutdown failures and re-entrancy | Added module-scoped re-entrancy guard, try/catch around `await server.shutdown()`, discriminated exit code (1 on failure). Orchestrators can now distinguish graceful from failed-graceful shutdown. | code-review P1 sweep | 2026-04-30 |
| `docs/todos/006-complete-p1-smoke-script-pattern-violations.md` | Smoke script indent and log-prefix drift | Reformatted `scripts/smoke.ts` to 2-space indent (matching `configs/`); standardised harness log prefix to `[smoke]`; added `.editorconfig` locking 2-space for `configs/`+`scripts/`, 4-space for `src/lib/` (preserves upstream parity). Original P1 framing was overstated — see todo Work Log. | code-review P1 sweep | 2026-04-30 |
| `docs/todos/007-complete-p2-trusted-url-search-param-ordering.md` | trustedAnalyzedUrl brittle to query-param reordering | Added `canonicalSearch()` helper (sorted key+value, encoded). `trustedAnalyzedUrl` compares canonicalised search instead of raw `URL.search`. Reordered query params no longer trigger false mismatches. | code-review P2 sweep | 2026-04-30 |
| `docs/todos/008-complete-p2-error-message-leakage.md` | data.error.message verbatim leakage to LLM | New `classifyApiError(code, status, errors)` returns a closed-set class string; raw Google `error.message` is gated behind `PAGESPEED_DEBUG=1`. Restores the 2.0.1 minimal-logging policy. Smoke's `QUOTA_HINT` suffix preserved. | code-review P2 sweep | 2026-04-30 |
| `docs/todos/009-complete-p2-strategy-roundtrip-validation.md` | Strategy round-trip unvalidated | `buildTrustedMeta` now sources `strategy` from the input parameter (`(input ?? "MOBILE").toUpperCase()`), not from `lighthouse.configSettings.formFactor`. The API echo of formFactor is no longer trusted. | code-review P2 sweep | 2026-04-30 |
| `docs/todos/010-complete-p2-applyspotlighting-phantom-control.md` | applySpotlighting phantom control in docs | CHANGELOG and CLAUDE.md no longer claim `applySpotlighting()` is wired. Both state plainly that `trustedAnalyzedUrl()` is the compensating control and `applySpotlighting()` is **not** wired into the handler. | code-review P2 sweep | 2026-04-30 |
| `docs/todos/011-complete-p2-trusted-url-mismatch-invisible-to-llm.md` | trustedAnalyzedUrl mismatch invisible to LLM | `trustedAnalyzedUrl` takes a `warnings: string[]` out-param and pushes a structured note on every fallback path; `pickPreset` attaches the array to all three preset shapes when non-empty. Echoed URL content withheld. | code-review P2 sweep | 2026-04-30 |
| `docs/todos/012-complete-p2-trusted-url-unit-tests.md` | No unit tests for fork helpers | Helpers extracted to `configs/pagespeed-helpers.ts` (importable without booting the server). New `configs/pagespeed-helpers.test.ts` adds 30 tests covering trustedAnalyzedUrl, buildTrustedMeta, pickPreset, extractScores, extractMetrics, classifyApiError. Suite went 459 → 489 passing. | code-review P2 sweep | 2026-04-30 |
| `docs/todos/013-complete-p2-duplicate-url-parsing.md` | Duplicate URL parsing across handler/helper | Single `new URL(url)` parse at handler top; `trustedInput = parsedInput.toString()` flows through API URL construction and trust validation. The "validated" URL and the "trusted" URL are now the same canonical string. | code-review P2 sweep | 2026-04-30 |
| `docs/todos/014-complete-p2-tool-annotations-helper.md` | Inline annotations vs library helper | `annotations: getMethodAnnotations("GET")` (imported from `mcp-curl/schema` subpath export) replaces the inline `{ readOnlyHint, openWorldHint }`. Single source of truth restored; future library additions land for free. | code-review P2 sweep | 2026-04-30 |
| `docs/todos/015-complete-p2-tool-description-trust-boundary-disclosure.md` | Tool description doesn't disclose trust boundary | Description gains a "Trust boundary" section disclosing analyzed_url re-validation, the warnings array on substitution, and response sanitisation. Total length 809 chars — under the upstream 1000-char cap. | code-review P2 sweep | 2026-04-30 |
| `docs/todos/016-complete-p3-magic-numbers-constants.md` | Magic numbers should be named constants | `2_000_000` and `60` lifted into `MAX_RESULT_SIZE_BYTES` and `DEFAULT_TIMEOUT_SECONDS` in `configs/pagespeed-helpers.ts:13-22` (alongside `CATEGORIES`). Each carries an inline comment explaining the unit + rationale; `configs/pagespeed.ts` imports both. | code-review P3 sweep | 2026-04-30 |
| `docs/todos/017-complete-p3-detection-logger-correlation.md` | Detection-logger entries lack correlation with analyze_pagespeed invocation | New opt-in `PAGESPEED_AUDIT=1` env var emits one hostname-only `[pagespeed] invoke target=<host> preset=<preset> strategy=<strategy>` line per invocation. Off by default (preserves the 2.0.1 minimal-logging policy and the privacy posture of `[injection-defense]`). Documented in CLAUDE.md, configs/pagespeed.ts header, and README.md. | code-review P3 sweep | 2026-04-30 |
| `docs/todos/018-complete-p3-readme-changelog-link.md` | README.md does not link to CHANGELOG security updates | README.md Security section gains a paragraph about the 3.1.1 prompt-injection defense (sanitisation, detection logging, trust-boundary helper) with explicit links to CLAUDE.md `## Security` and CHANGELOG.md. Environment Variables table also gains the `PAGESPEED_AUDIT` row. No duplication of security details — README defers to canonical docs. | code-review P3 sweep | 2026-04-30 |

---

## Code Review — 2026-04-30

### Review Summary

- **Reviewer:** automated multi-agent review (`/sixees-workflow:review`)
- **Focus areas (from invocation):** SRP/DRY, security, TypeScript MCP best practices
- **Agents used:** code-simplicity-reviewer, security-sentinel, typescript-reviewer, pattern-recognition-specialist, agent-native-reviewer, silent-failure-hunter, learnings-researcher
- **Findings:** 🔴 P1: 6 | 🟡 P2: 9 | 🔵 P3: 3 (consolidated and deduplicated from ~50 raw findings)
- **Phase 6 (browser testing):** skipped — stdio MCP server has no browser surface

### Handoff Assessment

The builder's self-assessment is **honest and substantially complete**. Strengths:
- "Risk areas" correctly flag `trustedAnalyzedUrl` as the security boundary and accurately note the boot-time `server.start()` failure path.
- "Edge cases" correctly handle trailing-slash and percent-encoding normalization; explicitly call out the host-mismatch surprise.
- "Test gaps" pre-disclose the missing unit tests for `trustedAnalyzedUrl` and the SIGINT handler — both reappear in this review's todos #012 and #005.
- "Known issues" candidly admit smoke didn't exercise the live PageSpeed round-trip, dist hash divergence, and the per-file Vitest 4 isolation gotcha.

Gaps (issues the builder did not surface but this review found):
- The **JSON.parse silent-fallback** at `configs/pagespeed.ts:208-214` bypasses the entire `trustedAnalyzedUrl` validation — this is on the documented security boundary and was not flagged. (P1 — see todo #001.)
- The **post-registration shutdown failure path** ("if `server.shutdown()` rejects") was not analysed — only the boot-time pre-registration race was discussed. (P1 — todo #005.)
- The **CHANGELOG/CLAUDE.md `applySpotlighting` claim** ("output may also be wrapped via …") describes a control that is not wired. The hedging language ("may") is misleading because every adjacent claim is wired. (P2 — todo #010.)
- The **`tsc --noEmit` clean** claim is true but does not cover `configs/` or `scripts/` — `tsconfig.json` includes only `src/**/*`. The fork-specific code added in this PR was not type-checked by the documented gate. (P1 — todo #004.)
- **`scripts/smoke.ts` indent style** (4-space) diverges from the entire rest of the repo (2-space). The handoff "Pattern deviations" discusses the new `scripts/` directory but not its formatting. (P1 — todo #006.)

Net: handoff is in the top quartile of self-assessments. The builder surfaced the "right kind" of risks but missed the silent-failure class — JSON.parse fallback, shutdown rejection, and phantom-control documentation are exactly the issues a reviewer-distinct-from-the-builder is meant to catch.

### Verified Claims

| Handoff Claim | Verified? | Notes |
|---------------|-----------|-------|
| 459 tests pass, 7 skipped, 21 files | yes | `npm test` re-run during review |
| All 18 cherry-picked files at upstream parity (SHA `5f32c85`) | yes (sampled) | Spot-checked 4 files via `git diff 5f32c85 -- <path>` per the suggested review order |
| All 7 fork-divergent files preserved | yes | Diff against `main^` shows none of the listed paths touched |
| Tag `3.1.1` created locally | yes | `git tag --list` |
| `npx tsc --noEmit` clean | partial | Clean for `src/**/*`; **does not cover `configs/` or `scripts/`** — see P1 finding #004 |
| dist sentinels `WHITESPACE REMOVED`, `injection-defense`, `InjectionDetected` present | yes | `grep` against `dist/chunk-*.js` |
| `trustedAnalyzedUrl` returns inputUrl on mismatch | yes | Code inspection — but invisible to LLM (P2 finding #011) |
| SIGINT/SIGTERM wired | yes | Code inspection — but error path unguarded (P1 finding #005) |
| `analyze_pagespeed` post-processor "validates analyzed_url matches input URL exactly" | yes, mostly | True on success path; **bypassed** when `JSON.parse` fails (P1 finding #001) |
| "Output may additionally be wrapped via `applySpotlighting()`" | **no** | Phantom control — not wired (P2 finding #010) |

### Key Findings

| ID | Severity | Category | Description | Todo File |
|----|----------|----------|-------------|-----------|
| 001 | 🔴 P1 | security / silent-failure | `JSON.parse` catch returns raw library response, bypassing `trustedAnalyzedUrl` validation entirely | `docs/todos/001-pending-p1-json-parse-silent-fallback.md` |
| 002 | 🔴 P1 | silent-failure / quality | `scripts/smoke.ts` has no spawn `error`/`exit` listeners; quota soft-skip is over-permissive; stderr buffer unbounded; kill without exit-code check | `docs/todos/002-pending-p1-smoke-script-silent-failures.md` |
| 003 | 🔴 P1 | spr-dry / architecture | `buildOutput` conflates dispatch + extraction + trust validation; fragile to new presets | `docs/todos/003-pending-p1-build-output-srp-violation.md` |
| 004 | 🔴 P1 | typescript / false-confidence | `tsconfig.json` excludes `configs/` and `scripts/`; "tsc clean" claim doesn't cover the cherry-pick's fork-specific code | `docs/todos/004-pending-p1-tsc-coverage-gap.md` |
| 005 | 🔴 P1 | typescript / silent-failure | SIGINT/SIGTERM handler has no try/catch around `server.shutdown()`; no re-entrancy guard | `docs/todos/005-pending-p1-shutdown-handler-error-handling.md` |
| 006 | 🔴 P1 | quality / patterns | `scripts/smoke.ts` uses 4-space indent vs repo's 2-space; inconsistent log prefix | `docs/todos/006-pending-p1-smoke-script-pattern-violations.md` |
| 007 | 🟡 P2 | security / quality | `trustedAnalyzedUrl` brittle to query-param reordering | `docs/todos/007-pending-p2-trusted-url-search-param-ordering.md` |
| 008 | 🟡 P2 | security / observability | `data.error.message` surfaced verbatim regresses 2.0.1 minimal-logging policy | `docs/todos/008-pending-p2-error-message-leakage.md` |
| 009 | 🟡 P2 | security | `lighthouse.configSettings?.formFactor` (strategy) is API-echoed and unvalidated | `docs/todos/009-pending-p2-strategy-roundtrip-validation.md` |
| 010 | 🟡 P2 | security / docs | CHANGELOG and CLAUDE.md describe `applySpotlighting()` as wired but it isn't | `docs/todos/010-pending-p2-applyspotlighting-phantom-control.md` |
| 011 | 🟡 P2 | agent-native / security | `trustedAnalyzedUrl` mismatch is invisible to the LLM | `docs/todos/011-pending-p2-trusted-url-mismatch-invisible-to-llm.md` |
| 012 | 🟡 P2 | quality / testing | No unit tests for `trustedAnalyzedUrl` or signal handler (acknowledged by builder) | `docs/todos/012-pending-p2-trusted-url-unit-tests.md` |
| 013 | 🟡 P2 | spr-dry | Input URL parsed three times across handler and helper | `docs/todos/013-pending-p2-duplicate-url-parsing.md` |
| 014 | 🟡 P2 | patterns / spr-dry | Inline tool annotations should use `getMethodAnnotations()` helper | `docs/todos/014-pending-p2-tool-annotations-helper.md` |
| 015 | 🟡 P2 | agent-native / docs | Tool description doesn't disclose post-processing or trust boundaries | `docs/todos/015-pending-p2-tool-description-trust-boundary-disclosure.md` |
| 016 | 🔵 P3 | quality | Magic numbers (`2_000_000`, `60`) should be named constants | `docs/todos/016-pending-p3-magic-numbers-constants.md` |
| 017 | 🔵 P3 | observability | `[injection-defense]` log lines lack correlation with `analyze_pagespeed` invocation | `docs/todos/017-pending-p3-detection-logger-correlation.md` |
| 018 | 🔵 P3 | docs | README.md doesn't link to CHANGELOG/CLAUDE.md security sections | `docs/todos/018-pending-p3-readme-changelog-link.md` |

### Outstanding Todos
<!-- Todos created during this review — see docs/todos/ for full content. All 6 P1 + 9 P2 + 3 P3 entries have been resolved; see "Resolved Todos" above and the post-review sweep sections below. -->

_None — all P1, P2, and P3 review findings closed._

### Blockers

**Update 2026-04-30 (post-review P3 sweep):** All 6 P1 + 9 P2 + 3 P3 findings resolved. No merge gates remaining.

**Update 2026-04-30 (post-review P2 sweep):** All 6 P1 + 9 P2 findings resolved. The 3 P3s are follow-up work, not gates.

**Update 2026-04-30 (post-review P1 sweep):** All 6 P1 findings resolved. See "Resolved Todos" table above and the Post-Review Resolution section below.

Original triage (kept for historical context):

1. **Trust-boundary completeness** (#001 + #003 + #005) — JSON.parse fallback, buildOutput SRP, shutdown error handling. All of them say "the documented compensating controls have a quiet escape hatch." Fix once, fix together.
2. **CI/quality-gate coverage** (#002 + #004 + #006) — smoke script silent failures, tsc not covering fork code, indent drift. Together they say "the gates we're claiming aren't actually closing." Mechanical, low-risk fixes.

---

## Post-Review Resolution — 2026-04-30

All 6 P1 findings from the multi-agent review were addressed in a single sweep. Themes:

### Trust-boundary completeness (#001, #003, #005)
- **`configs/pagespeed.ts:218-239`** — `JSON.parse` failure no longer silently returns the raw library response. Now emits a `pagespeed:` stderr line with the error class name (preserves 2.0.1 minimal-logging) and returns an `isError: true` MCP response. The fail-closed path is the only escape from `trustedAnalyzedUrl`.
- **`configs/pagespeed.ts:84-108`** — `buildOutput()` decomposed into `buildTrustedMeta()` (single home for API-echoed fields that round-trip into LLM context: `analyzed_url`, `strategy`) and `pickPreset()` (pure dispatch). The trust boundary is now one named function, not buried inside a switch.
- **`configs/pagespeed.ts:301-315`** — Shutdown handler hardened: module-scoped `shuttingDown` flag prevents re-entry on second signal; try/catch around `await server.shutdown()`; failed shutdown logs the error class name and exits with code 1 so orchestrators can distinguish graceful from failed-graceful shutdown.

### Quality-gate coverage (#002, #004, #006)
- **`tsconfig.fork.json`** (new) + `npm run typecheck` (new) — Fork-specific code (`configs/`, `scripts/`) now type-checked under strict mode. `tsup`'s explicit entry list keeps the new include from polluting the published bundle.
- **`scripts/smoke.ts`** — Rewritten with `error`/`exit` listeners on the spawned child, structural quota detection via `QUOTA_HINT` tag-handshake (string emitted by the server only when `data.error.status === "RESOURCE_EXHAUSTED"`), bounded stderr at 64 KB, exit-await with SIGTERM (2s) → SIGKILL (4s) escalation. No more silent-success or false-positive soft-skips.
- **`.editorconfig`** (new) — Locks 2-space for `configs/**.ts` + `scripts/**.ts`, 4-space for `src/lib/**.ts` (preserves upstream parity). Note: the original P1 severity for #006 was overstated — `scripts/smoke.ts`'s 4-space matched `tsup.config.ts` and `src/lib/`, so it wasn't the lone outlier the finding implied. Resolved anyway because `.editorconfig` future-proofs the convention.

### Verification
- `npm run typecheck` clean (both `tsconfig.json` and `tsconfig.fork.json`).
- `npm test` 459 passed, 7 skipped — unchanged from baseline.
- `npm run smoke` ran end-to-end on quota-exhausted IP — soft-skip path correctly classified via `QUOTA_HINT`, harness exited 0 in <30s.

### Test gaps (acknowledged, not in this sweep)
- No fork-side unit tests for the JSON.parse fail-closed path or the SIGINT rejection path. Both consolidated under todo #012 as a single follow-up.

---

## Post-Review Resolution — 2026-04-30 (P2 sweep)

All 9 P2 findings from the multi-agent review were addressed in a second sweep. Themes:

### Trust-boundary completeness (#007, #009, #011, #013, #015)
- **`configs/pagespeed-helpers.ts:62-71` — `canonicalSearch(u)`** — Sorts URL search params by key then value and encodes both sides. `trustedAnalyzedUrl` now compares `canonicalSearch(a) === canonicalSearch(b)` instead of `a.search === b.search`. Robust to legitimate reordering by PageSpeed; any byte-level deviation after normalisation still falls back. (#007)
- **`configs/pagespeed-helpers.ts:115-125` — `buildTrustedMeta` strategy from input** — `strategy` now comes from `(inputStrategy ?? "MOBILE").toUpperCase()`, not from `lighthouse.configSettings.formFactor`. Every API-echoed field that round-trips into LLM context is now re-validated against trusted input — no exceptions. (#009)
- **`configs/pagespeed-helpers.ts:81-141` — warnings out-param + preset attachment** — `trustedAnalyzedUrl` takes a `warnings: string[]` array; on fallback it pushes "analyzed_url substituted with the URL you submitted; the API echoed a different value (echo content withheld)." `pickPreset` attaches the array to every preset's response when non-empty (operators care about substitutions even when the LLM only asked for `scores`). The mismatch is now an LLM-visible signal, not just a stderr line. (#011)
- **`configs/pagespeed.ts:97-122` — single URL parse** — `new URL(url)` is called exactly once at handler top; `parsedInput.toString()` is the canonical form passed to API URL construction and to `buildTrustedMeta`. The 3-parse divergence risk is gone. (#013)
- **`configs/pagespeed.ts:62-73` — Trust boundary disclosure in tool description** — New "Trust boundary:" section in the tool description tells the LLM that `analyzed_url` is the input URL re-validated against the API echo, that mismatches surface in `warnings`, and that response content is sanitised for known prompt-injection patterns. Total description 809 chars — under the upstream `registerCustomTool()` 1000-char cap. (#015)

### Observability + policy (#008, #010)
- **`configs/pagespeed-helpers.ts:16-31` — `classifyApiError(code, status, errors)`** — Closed-set class strings replace verbatim `data.error.message` forwarding to the LLM. The handler at `configs/pagespeed.ts:185-208` calls `classifyApiError`, returns the class string to the LLM, and emits `pagespeed: API error <code>` to stderr. Raw API messages are gated behind `PAGESPEED_DEBUG=1`. The 429 class string preserves the exact "Set PAGESPEED_API_KEY to use a higher quota." suffix because `scripts/smoke.ts` greps for it (verified: smoke's quota soft-skip still classifies correctly). Restores the 2.0.1 minimal-logging policy on the error path. (#008)
- **`CHANGELOG.md:14` and `CLAUDE.md:58`** — Phantom-control language removed. Both files now state plainly that `applySpotlighting()` is **not** wired into the handler and that `trustedAnalyzedUrl()` is the compensating control (origin + pathname + canonicalised search; falls back to input on mismatch with a structured warning). No more "may also be wrapped" hedge. (#010)

### Testing + library patterns (#012, #014)
- **`configs/pagespeed-helpers.ts`** (new) — Helpers extracted from `configs/pagespeed.ts` (which is the boot script with top-level `await server.start()`). Importable from tests without booting the server.
- **`configs/pagespeed-helpers.test.ts`** (new) — 30 new tests across 6 suites covering all extracted helpers. `beforeEach` silences `console.error` via `vi.spyOn` so the throttled mismatch warning doesn't pollute test output. Suite total: 459 → 489 passing / 7 skipped. Signal-handler test deferred (process.exit mocking is more invasive; smoke runs already exercise the SIGINT/SIGTERM wiring). (#012)
- **`configs/pagespeed.ts:21,82` — `getMethodAnnotations("GET")` from `mcp-curl/schema`** — Inline `{ readOnlyHint: true, openWorldHint: true }` replaced with the library helper. Subpath export resolves via `package.json` exports field. No behavioural change; future library additions (e.g. `idempotentHint`) land for free. (#014)

### Verification
- `npm run typecheck` clean (both `tsconfig.json` and `tsconfig.fork.json`).
- `npm test` 489 passed, 7 skipped (was 459 — net +30 from the new helpers test file).
- `npm run smoke` ran end-to-end on quota-exhausted IP — soft-skip path correctly classified via `QUOTA_HINT`; new stderr `pagespeed: API error 429` (no message body) confirms #008's scrub is live in production.

### Test gaps (acknowledged, not in this sweep)
- Helper tests use mocked `console.error`; they don't assert that the throttled warning *would* fire on a real run. The detection-logger has its own per-file isolation tests (cherry-picked from upstream); the fork-side `console.error` line in `trustedAnalyzedUrl` is exercised by the existing fallback-path test cases through the warnings array.

---

## Post-Review Resolution — 2026-04-30 (P3 sweep)

All 3 P3 findings from the multi-agent review were addressed in a third sweep. Themes:

### Readability / quality (#016)
- **`configs/pagespeed-helpers.ts:13-22`** — `MAX_RESULT_SIZE_BYTES = 2_000_000` and `DEFAULT_TIMEOUT_SECONDS = 60` placed alongside `CATEGORIES`. Each carries a short comment explaining the unit and the rationale (typical Lighthouse JSON sizes for the result-size cap; outer cURL timeout vs the 15-45s analysis duration for the timeout fallback). `configs/pagespeed.ts` imports both — the inline `2_000_000` at the `configure()` call and the `?? 60` fallback at the `executeRequest()` call now resolve to named symbols. No behavioural change.

### Observability (#017)
- **`configs/pagespeed.ts:135-141`** — New opt-in audit block fires immediately after the trusted-input parse: when `PAGESPEED_AUDIT === "1"`, emits `[pagespeed] invoke target=<hostname> preset=<preset> strategy=<strategy>` to stderr. Hostname only — full URL, query string, and any embedded auth are intentionally excluded (preserves the privacy posture that drove the original `[injection-defense]` decision to omit URLs from log lines). Closes the documented correlation gap: SOC operators investigating a `[injection-defense]` event can now `grep '\[pagespeed\] invoke' stderr.log` to find the invocation that triggered it. Off by default — the 2.0.1 minimal-logging policy is unaffected for default deployments.
- **Documentation: three locations.** (a) `CLAUDE.md` `### Prompt-injection observability` second bullet now describes the env var and its hostname-only line. (b) `configs/pagespeed.ts:8-13` header `// Environment:` block lists `PAGESPEED_AUDIT` alongside `PAGESPEED_API_KEY` and `PAGESPEED_DEBUG`. (c) `README.md:129` Environment Variables table gains the `PAGESPEED_AUDIT` row.
- **Smoke unaffected** — `scripts/smoke.ts` only checks for `[injection-defense]` and `QUOTA_HINT` substrings; the new line only fires under the env flag (which smoke does not set).

### Documentation (#018)
- **`README.md:141-144`** — Security section gains a third paragraph: "This fork adds prompt-injection defense (response sanitisation, detection logging, and a trust-boundary helper that re-validates the API-echoed URL against the input) in 3.1.1. See [CLAUDE.md](./CLAUDE.md) `## Security` for the full trust model and [CHANGELOG.md](./CHANGELOG.md) for version history." No duplication of security details — README defers to CLAUDE.md for the trust model and CHANGELOG for version history. Closes the "front-door" gap identified in the review (operators evaluating the fork via README alone now see the prompt-injection defense and have explicit pointers to the canonical docs).

### Verification
- `npm run typecheck` clean (both `tsconfig.json` and `tsconfig.fork.json`).
- `npm test` 489 passed, 7 skipped — unchanged from after the P2 sweep (no test changes).
- `dist/` rebuilt via `npm run build` (this fork commits `dist/`).

### Net result
All 6 P1 + 9 P2 + 3 P3 review findings closed across three sweeps. No outstanding gates.

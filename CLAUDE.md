# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

PageSpeed Insights MCP server — exposes an `analyze_pagespeed` tool for running Google Lighthouse analysis
via the PageSpeed Insights API v5, plus a sandboxed `jq_query` helper for inspecting saved responses.

## Build Commands

```bash
npm install          # Install deps; the `prepare` script bundles dist/ via tsup
npm run build        # Re-bundle dist/ via tsup
npm run dev          # tsup --watch
npm run typecheck    # tsc --noEmit on tsconfig.json + tsconfig.fork.json
npm test             # Run vitest (vitest run)
npm run smoke        # End-to-end smoke test (scripts/smoke.ts)
npx tsx configs/pagespeed.ts  # Run the PageSpeed MCP server directly
```

## Architecture

The repository has two layers:

- **`configs/`** — PageSpeed-specific entry point and helpers.
- **`src/lib/`** — Vendored, internal-only library that provides the `PageSpeedServer` (legacy alias
  `McpCurlServer`) extension system, security layer, schema generation, and transport. Originally derived
  from `sixees/mcp-curl`, now tracked here. No public API guarantees — consumed only by `configs/`. See
  [`docs/internal/`](docs/internal/) for the API reference (`registerCustomTool`, hooks).

Key files in `configs/`:

- `configs/pagespeed.ts` — Entry point. Instantiates `PageSpeedServer`, calls `.disableCurlExecute()`
  (the tool stays listed in `tools/list` but errors at call time), and registers a custom
  `analyze_pagespeed` tool with TypeScript post-processing (scores as 0-100 integers, Core Web Vitals
  extraction). Uses `generateInputSchema()` for the Zod schema from YAML, `getAuthConfig()` for the API
  key, `getMethodAnnotations()` for the tool annotations, and `server.utilities().executeRequest()` for
  the HTTP call. Wires `SIGINT`/`SIGTERM` to `server.shutdown()` with a re-entrancy guard so a second
  signal force-exits.
- `configs/pagespeed-helpers.ts` — Pure helpers: the `PageSpeedResponseSchema` Zod boundary (with
  `.passthrough()` for additive API drift), `CATEGORIES`/`PRESETS`/`DEFAULT_PRESET`,
  `MAX_RESULT_SIZE_BYTES` (2 MB), `classifyApiError`, `extractScores`, `extractMetrics`,
  `trustedAnalyzedUrl`, `buildTrustedMeta`, and the pure `pickPreset` dispatch. Co-located unit tests
  (`pagespeed-helpers.test.ts`) cover these without booting the server.
- `configs/pagespeed.yaml` — YAML API definition. Loaded at runtime for config values (baseUrl, timeout,
  headers, auth) and input schema generation. The jqFilter/filterPresets exist only to drive
  `generateInputSchema()` — actual response processing is in TypeScript.
- `configs/pagespeed-agent-test.ts` — Agent integration test (spawns the server and drives it via the
  MCP client SDK).
- `scripts/smoke.ts` — Leaner CI quality gate; spawns the server, performs the MCP handshake, calls
  `analyze_pagespeed`, and asserts response shape, no `[WHITESPACE REMOVED]` markers, and no
  `[injection-defense]` log lines on a clean URL. Treats anonymous-quota exhaustion as a `[SKIP]`.

Note: `configs/pagespeed.ts` imports from `"mcp-pagespeed"` and `"mcp-pagespeed/schema"`. Those bare
specifiers are self-imports — they resolve to the local vendored library at `src/lib/` via
`package.json#name` + `#exports`. There is no external `mcp-pagespeed` package dependency on npm.

### Key Design Decisions

- `curl_execute` disabled at call time (still listed); replaced by the custom `analyze_pagespeed` tool
- `jq_query` intentionally kept enabled — sandboxed to temp/output/cwd, useful for querying auto-saved
  results (rare in practice because `MAX_RESULT_SIZE_BYTES = 2_000_000` keeps responses inline)
- TypeScript post-processing instead of jq because the built-in jq engine can't do object construction
  or arithmetic
- API responses validated through a Zod boundary schema (`PageSpeedResponseSchema` in
  `configs/pagespeed-helpers.ts`) with `.passthrough()` for additive Google version drift; the
  `lighthouseResult` subtree stays `unknown` and is walked leniently by `extractScores`/`extractMetrics`
  with `?.`/`??` since a tighter schema would just duplicate that leniency
- YAML schema used for config and input schema generation, not for tool handler generation
- API error responses are detected via `data.error` before checking for `lighthouseResult`. The LLM-
  visible error string is a class-of-error from `classifyApiError()` (e.g. `"PageSpeed API rate-limited.
  Set PAGESPEED_API_KEY to use a higher quota."`) rather than Google's raw `error.message`; the raw
  message goes to stderr only when `PAGESPEED_DEBUG=1`. The 429 string preserves the exact
  `Set PAGESPEED_API_KEY to use a higher quota.` suffix that `scripts/smoke.ts` greps for
- Non-JSON or shape-mismatched responses are rejected at the boundary (`"…non-JSON response."` /
  `"…unexpected response shape."`) — the trust-boundary helper can't run without parsed data
- The handler hoists the resolved `preset` and upper-cased `strategy` once and reuses them for the
  audit log, the API URL, and `pickPreset`, so the audit line can never disagree with what was actually
  executed
- The handler appends repeated `&category=PERFORMANCE/ACCESSIBILITY/BEST_PRACTICES/SEO` to the API URL
  because the YAML schema can't express repeated parameters

## Tools

- **`analyze_pagespeed`** — Lighthouse analysis with `filter_preset` for scores, metrics, or summary output
- **`jq_query`** — Query saved JSON response files (provided by the vendored library)

## Security

The vendored library enforces SSRF protection, DNS rebinding prevention, rate limiting, input validation,
file access controls, and resource limits. `curl_execute` is disabled at call time — it remains in
`tools/list` (vendored MCP convention) but its handler returns an error, so only `analyze_pagespeed` can
make requests.

### Prompt-injection observability

- HTTP response bodies are sanitized in `processResponse()` before reaching the LLM (Unicode attack-vector strip + 50+-space collapse).
- Detection-only logger emits `[injection-defense] [pagespeedonline.googleapis.com] InjectionDetected` at most once per minute when a known injection keyword pattern is observed in a sanitized response. The analyzed `url` is intentionally NOT in the log — set `PAGESPEED_AUDIT=1` to enable a hostname-only audit trail (`[pagespeed] invoke target=<host> preset=<preset> strategy=<strategy>`) so operators can correlate detection events with the invocation that triggered them. Off by default; opt in only where the privacy/observability tradeoff favours observability.
- The `enableSpotlighting` config flag does NOT auto-apply to `analyze_pagespeed`. Spotlighting wrappers in `tool-wrapper.ts` only run for the built-in `curl_execute` / `jq_query` tools; custom tools are dispatched via `server.registerTool()` and bypass the wrapper. `applySpotlighting()` is **not** wired into the `analyze_pagespeed` handler. The compensating control is `trustedAnalyzedUrl()` in `configs/pagespeed-helpers.ts`, which compares the API-echoed `data.id` against the input URL on origin + pathname + canonicalised search (sorted params); on mismatch it falls back to the input URL and pushes a structured note into the response's `warnings` array (echo content withheld).
- `configs/pagespeed.ts` wires `SIGINT`/`SIGTERM` to `server.shutdown()` so `startInjectionCleanup()`'s `setInterval` is cleared on process termination — required for clean container shutdown.
- Detection-logger uses a module-level `lastDetectedMap`. Tests that exercise `logInjectionDetected` MUST call `clearInjectionDetectionMap()` (from `src/lib/security/detection-logger.js`) in `beforeEach` — Vitest 4 isolates per file, not per test.

## Code Style

- Modern ES6+ with strict TypeScript, ESM modules
- Zod for runtime schema validation
- Prefer async/await, pure functions, early returns

## Testing

- `npm test` runs vitest (`vitest run`)
- `npm run smoke` runs the end-to-end smoke check (`scripts/smoke.ts`) — spawns the server, drives MCP
  over stdio, asserts response shape and clean stderr; treats anonymous-quota exhaustion as `[SKIP]`
- `npx tsx configs/pagespeed-agent-test.ts` is the agent integration test (uses the official MCP client
  SDK; honours `TEST_URL` / `STRATEGY` env vars)
- Test files are co-located: `*.test.ts` next to source files
- `pagespeed-helpers.test.ts` covers the pure helpers without booting the server; `self-import.test.ts`
  pins the bare-specifier self-import (`"mcp-pagespeed"` resolving to `src/lib/`) so a future
  `package.json#exports` change fails fast

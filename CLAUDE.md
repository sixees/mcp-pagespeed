# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

PageSpeed Insights MCP server — exposes an `analyze_pagespeed` tool for running Google Lighthouse analysis
via the PageSpeed Insights API v5, plus a sandboxed `jq_query` helper for inspecting saved responses.

## Build Commands

```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript to dist/
npm run dev          # Watch mode compilation
npm test             # Run vitest tests
npx tsx configs/pagespeed.ts  # Run the PageSpeed MCP server
```

## Architecture

The repository has two layers:

- **`configs/`** — PageSpeed-specific entry point and helpers.
- **`src/lib/`** — Vendored, internal-only library that provides the `McpCurlServer` extension system,
  security layer, schema generation, and transport. Originally derived from `sixees/mcp-curl`, now tracked
  here. No public API guarantees — consumed only by `configs/`. See [`docs/internal/`](docs/internal/) for
  the API reference (`registerCustomTool`, hooks).

Key files in `configs/`:

- `configs/pagespeed.ts` — Entry point. Creates an `McpCurlServer`, disables `curl_execute`, registers a
  custom `analyze_pagespeed` tool with TypeScript post-processing (scores as 0-100 integers, Core Web Vitals
  extraction). Uses `generateInputSchema()` for Zod schema from YAML, `getAuthConfig()` for API key, and
  `server.utilities().executeRequest()` for the actual HTTP call.
- `configs/pagespeed.yaml` — YAML API definition. Loaded at runtime for config values (baseUrl, timeout,
  headers, auth) and input schema generation. The jqFilter/filterPresets exist only to drive
  `generateInputSchema()` — actual response processing is in TypeScript.

Note: `configs/pagespeed.ts` imports from `"mcp-curl"`. That bare specifier resolves to the local vendored
library via `package.json#name`; there is no external `mcp-curl` package dependency.

### Key Design Decisions

- `curl_execute` disabled; replaced by custom `analyze_pagespeed` tool
- `jq_query` intentionally kept enabled — sandboxed to temp/output/cwd, useful for querying auto-saved results
- TypeScript post-processing instead of jq because the built-in jq engine can't do object construction or arithmetic
- `Record<string, any>` for API response types — external API with version-dependent shape; `?.`/`??` handle missing fields at runtime
- YAML schema used for config and input schema generation, not for tool handler generation
- API error responses (rate limits, auth failures, bad URLs) are detected via `data.error` before checking for `lighthouseResult`, so Google's error code and message are surfaced directly to the caller

## Tools

- **`analyze_pagespeed`** — Lighthouse analysis with `filter_preset` for scores, metrics, or summary output
- **`jq_query`** — Query saved JSON response files (provided by the vendored library)

## Security

The vendored library enforces SSRF protection, DNS rebinding prevention, rate limiting, input validation,
file access controls, and resource limits. `curl_execute` is disabled — only `analyze_pagespeed` can make
requests.

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
- Test files are co-located: `*.test.ts` next to source files

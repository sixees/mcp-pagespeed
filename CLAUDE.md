# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

PageSpeed Insights MCP server — a fork of [mcp-curl](https://github.com/sixees/mcp-curl) that exposes a
single `analyze_pagespeed` tool for running Google Lighthouse analysis via the PageSpeed Insights API v5.

## Build Commands

```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript to dist/
npm run dev          # Watch mode compilation
npm test             # Run vitest tests
npx tsx configs/pagespeed.ts  # Run the PageSpeed MCP server
```

## Architecture

Fork-specific code lives in `configs/`:

- `configs/pagespeed.ts` — Entry point. Creates an `McpCurlServer`, disables `curl_execute`, registers a
  custom `analyze_pagespeed` tool with TypeScript post-processing (scores as 0-100 integers, Core Web Vitals
  extraction). Uses `generateInputSchema()` for Zod schema from YAML, `getAuthConfig()` for API key, and
  `server.utilities().executeRequest()` for the actual HTTP call.
- `configs/pagespeed.yaml` — YAML API definition. Loaded at runtime for config values (baseUrl, timeout,
  headers, auth) and input schema generation. The jqFilter/filterPresets exist only to drive
  `generateInputSchema()` — actual response processing is in TypeScript.

The underlying mcp-curl library provides the `McpCurlServer` extension system, security layer, and transport.
See [upstream docs](https://github.com/sixees/mcp-curl) for the full library API.

### Key Design Decisions

- `curl_execute` disabled; replaced by custom `analyze_pagespeed` tool
- `jq_query` intentionally kept enabled — sandboxed to temp/output/cwd, useful for querying auto-saved results
- TypeScript post-processing instead of jq because the built-in jq engine can't do object construction or arithmetic
- `Record<string, any>` for API response types — external API with version-dependent shape; `?.`/`??` handle missing fields at runtime
- YAML schema used for config and input schema generation, not for tool handler generation
- API error responses (rate limits, auth failures, bad URLs) are detected via `data.error` before checking for `lighthouseResult`, so Google's error code and message are surfaced directly to the caller

## Tools

- **`analyze_pagespeed`** — Lighthouse analysis with `filter_preset` for scores, metrics, or summary output
- **`jq_query`** — Query saved JSON response files (inherited from mcp-curl)

## Security

All mcp-curl security applies: SSRF protection, DNS rebinding prevention, rate limiting, input validation,
file access controls, resource limits. `curl_execute` is disabled — only `analyze_pagespeed` can make requests.

## Code Style

- Modern ES6+ with strict TypeScript, ESM modules
- Zod for runtime schema validation
- Prefer async/await, pure functions, early returns

## Testing

- `npm test` runs vitest (`vitest run`)
- Test files are co-located: `*.test.ts` next to source files

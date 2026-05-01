# Configuration Reference

Configuration for the PageSpeed Insights MCP server lives in two places: environment variables and `configs/pagespeed.yaml`.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `PAGESPEED_API_KEY` | Recommended | Google API key. Without it, the anonymous quota is shared and quickly exhausted. |
| `PAGESPEED_DEBUG` | Optional | When set to `1`, stderr includes raw API error bodies (Google's `error.message`) for debugging. Off by default — keeps the minimal-logging policy and prevents URL fragments / PII from leaking into logs. |
| `PAGESPEED_AUDIT` | Optional | When set to `1`, stderr emits one hostname-only audit line per invocation (`[pagespeed] invoke target=<host> preset=<preset> strategy=<strategy>`) so operators can correlate `[injection-defense]` events with the call that triggered them. Off by default. |

### PAGESPEED_API_KEY

The key is sent as a `?key=` query parameter per Google's documented method. Use a key restricted to the **PageSpeed Insights API** to limit exposure if it appears in proxy logs.

```bash
export PAGESPEED_API_KEY=AIza...
```

Or pass it inline when running the server:

```bash
PAGESPEED_API_KEY=AIza... npx tsx configs/pagespeed.ts
```

Or set it in your MCP client config:

```json
{
  "mcpServers": {
    "pagespeed": {
      "command": "npx",
      "args": ["tsx", "/path/to/configs/pagespeed.ts"],
      "env": { "PAGESPEED_API_KEY": "AIza..." }
    }
  }
}
```

## Tool Parameters

### url

The public URL to analyze. Must use `http://` or `https://`. The URL must be reachable from Google's infrastructure. The handler parses the URL with `new URL()` once; non-`http(s)` schemes return `Error: Only http and https URLs are supported.` and unparseable inputs return `Error: Invalid URL provided.` (both with `isError: true`).

### strategy

| Value | Description |
|---|---|
| `MOBILE` | Simulate a mid-tier mobile device (default) |
| `DESKTOP` | Simulate a desktop browser |

The handler upper-cases whatever is passed before forwarding it to the API and before reporting `strategy` in the `summary` output.

### filter_preset

Controls the shape of the response. The accepted values come from `configs/pagespeed.yaml#endpoints[0].response.filterPresets[].name`, mirrored at runtime in `PRESETS` in `configs/pagespeed-helpers.ts`. When omitted the handler defaults to `summary`.

| Value | Returns | Use When |
|---|---|---|
| `summary` | Scores + metrics + `analyzed_url` + `strategy` (default) | General analysis |
| `scores` | Category scores as integers 0–100 | Comparing sites or tracking trends |
| `metrics` | Core Web Vitals with raw and display values | Diagnosing performance issues |

#### scores output

```json
{
  "performance": 100,
  "accessibility": 96,
  "best_practices": 96,
  "seo": 40
}
```

Each value is `Math.round((category.score ?? 0) * 100)` — Lighthouse stores scores as 0–1 floats, the handler converts them to 0–100 integers. Missing categories collapse to `0`.

#### metrics output

```json
{
  "lcp": { "value": 800, "display": "0.8 s" },
  "fcp": { "value": 800, "display": "0.8 s" },
  "cls": { "value": 0,   "display": "0" },
  "tbt": { "value": 0,   "display": "0 ms" },
  "tti": { "value": 800, "display": "0.8 s" }
}
```

`value` is the raw `numericValue` (a number, possibly fractional, or `null` if Lighthouse omitted the audit); `display` is Lighthouse's pre-formatted string or `"N/A"` when missing.

Metric keys map to Lighthouse audit IDs:

| Key | Audit ID | Metric |
|---|---|---|
| `lcp` | `largest-contentful-paint` | Largest Contentful Paint |
| `fcp` | `first-contentful-paint` | First Contentful Paint |
| `cls` | `cumulative-layout-shift` | Cumulative Layout Shift |
| `tbt` | `total-blocking-time` | Total Blocking Time |
| `tti` | `interactive` | Time to Interactive |

#### summary output

```json
{
  "scores": { "performance": 100, "...": "..." },
  "metrics": { "lcp": { "value": 800, "display": "0.8 s" }, "...": "..." },
  "analyzed_url": "https://www.example.com/",
  "strategy": "MOBILE"
}
```

`analyzed_url` is the **trusted** input URL — `trustedAnalyzedUrl()` re-validates the value PageSpeed echoes back in `data.id` against the URL the caller submitted (origin + pathname + canonicalised search). On a match the input URL is returned unchanged; on a mismatch the handler falls back to the input URL and appends a `warnings` array entry instead of forwarding the API echo:

```json
{
  "scores": { "...": "..." },
  "metrics": { "...": "..." },
  "analyzed_url": "https://www.example.com/",
  "strategy": "MOBILE",
  "warnings": [
    "analyzed_url substituted with the URL you submitted; the API echoed a different value (echo content withheld)."
  ]
}
```

`warnings` is added to **all** preset shapes when present (a substitution is meaningful even when the LLM picked `filter_preset=scores` and never sees `analyzed_url` itself).

## pagespeed.yaml

The YAML file at `configs/pagespeed.yaml` drives two things at startup:

1. **Server config** — `baseUrl`, `timeout`, and request headers are read into `PageSpeedServer.configure()` (the class is exported as both `PageSpeedServer` and the legacy alias `McpCurlServer` from the vendored library).
2. **Input schema generation** — `generateInputSchema()` reads the endpoint's `parameters` and `filterPresets` to produce the Zod schema for `analyze_pagespeed`'s input validation.

It does **not** drive the tool handler — response processing happens in TypeScript (`configs/pagespeed.ts` plus helpers in `configs/pagespeed-helpers.ts`).

See [YAML Schema Reference](./api-schema.md) for the full format.

## Server-Level Config

The server is configured in `configs/pagespeed.ts`; the constants live in `configs/pagespeed-helpers.ts`:

| Option | Value | Source |
|---|---|---|
| `baseUrl` | `https://pagespeedonline.googleapis.com` | `pagespeed.yaml` |
| `defaultTimeout` | 60 seconds | `pagespeed.yaml` |
| `defaultHeaders` | `Accept: application/json` | `pagespeed.yaml` |
| `maxResultSize` | 2,000,000 bytes (`MAX_RESULT_SIZE_BYTES`) | `configs/pagespeed-helpers.ts` |

`maxResultSize` is large enough to keep the response inline rather than auto-saving to disk via the vendored library's file path. Lighthouse JSON for a typical page is 200–600 KB; 2 MB gives headroom for sites with many third-party scripts.

The handler also forces all four Lighthouse categories (`PERFORMANCE`, `ACCESSIBILITY`, `BEST_PRACTICES`, `SEO`) by appending repeated `&category=` params to the API URL — the YAML schema can't express repeated parameters, so this is done in code.

## Error Responses

When the API returns an error (rate limit, invalid key, unreachable URL), the tool returns `isError: true` with a class-of-error string from `classifyApiError()`. Google's raw `error.message` is **not** forwarded to the LLM; it is only printed to stderr when `PAGESPEED_DEBUG=1`.

| Trigger | LLM-visible message |
|---|---|
| `error.status === "RESOURCE_EXHAUSTED"` or any `errors[].reason === "rateLimitExceeded"` | `Error: PageSpeed API rate-limited. Set PAGESPEED_API_KEY to use a higher quota.` |
| `error.code === 400` | `Error: PageSpeed API rejected the request (likely invalid URL).` |
| `error.code === 401` or `403` | `Error: PageSpeed API authentication failed.` |
| `error.code === 404` | `Error: PageSpeed API endpoint not found.` |
| Any other `error.code` | `Error: PageSpeed API returned an error (HTTP <code>).` |
| Response is not valid JSON | `Error: PageSpeed API returned a non-JSON response.` |
| Response JSON fails the Zod boundary schema | `Error: PageSpeed API returned an unexpected response shape.` |
| Response has no `lighthouseResult` and no `error` | `Error: PageSpeed API did not return lighthouse results. The URL may be unreachable or the API may be experiencing issues.` |

The 429-class message preserves the exact `Set PAGESPEED_API_KEY to use a higher quota.` suffix that `scripts/smoke.ts` greps for to classify quota-exhausted runs as smoke-test skips rather than failures.

Common HTTP causes:

| Code | Likely cause |
|---|---|
| 400 | Invalid or unreachable URL |
| 429 | Quota exhausted — set `PAGESPEED_API_KEY` |
| 401 / 403 | API key invalid or PageSpeed API not enabled |

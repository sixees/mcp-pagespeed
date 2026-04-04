# Configuration Reference

Configuration for the PageSpeed Insights MCP server lives in two places: environment variables and `configs/pagespeed.yaml`.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `PAGESPEED_API_KEY` | Recommended | Google API key. Without it, the anonymous quota is shared and quickly exhausted. |

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

The public URL to analyze. Must use `http://` or `https://`. The URL must be accessible from Google's infrastructure.

### strategy

| Value | Description |
|---|---|
| `MOBILE` | Simulate a mid-tier mobile device (default) |
| `DESKTOP` | Simulate a desktop browser |

### filter_preset

Controls the shape of the response.

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

Metric keys:

| Key | Metric |
|---|---|
| `lcp` | Largest Contentful Paint |
| `fcp` | First Contentful Paint |
| `cls` | Cumulative Layout Shift |
| `tbt` | Total Blocking Time |
| `tti` | Time to Interactive |

#### summary output

```json
{
  "scores": { "performance": 100, ... },
  "metrics": { "lcp": { "value": 800, "display": "0.8 s" }, ... },
  "analyzed_url": "https://www.example.com/",
  "strategy": "MOBILE"
}
```

## pagespeed.yaml

The YAML file at `configs/pagespeed.yaml` drives two things at startup:

1. **Server config** — `baseUrl`, `timeout`, and request headers are read into `McpCurlServer.configure()`
2. **Input schema generation** — `generateInputSchema()` reads the endpoint's `parameters` and `filterPresets` to produce the Zod schema for `analyze_pagespeed`'s input validation

It does **not** drive the tool handler — response processing happens in TypeScript (`configs/pagespeed.ts`).

See [YAML Schema Reference](./api-schema.md) for the full format.

## Server-Level Config

The server is configured in `configs/pagespeed.ts` with these hardcoded values:

| Option | Value | Notes |
|---|---|---|
| `baseUrl` | `https://pagespeedonline.googleapis.com` | From YAML |
| `defaultTimeout` | 60 seconds | From YAML |
| `defaultHeaders` | `Accept: application/json` | From YAML |
| `maxResultSize` | 2,000,000 bytes | Set in code — large enough to keep responses inline |

To change these, edit `configs/pagespeed.ts` or `configs/pagespeed.yaml`.

## Error Responses

When the API returns an error (rate limit, invalid key, unreachable URL), the tool returns `isError: true` with the HTTP error code and message from Google:

```
Error: PageSpeed API returned 429: Quota exceeded for quota metric 'Queries'... Set PAGESPEED_API_KEY to use a higher quota.
```

Common errors:

| Code | Cause |
|---|---|
| 400 | Invalid or unreachable URL |
| 429 | Quota exhausted — set `PAGESPEED_API_KEY` |
| 403 | API key invalid or PageSpeed API not enabled |

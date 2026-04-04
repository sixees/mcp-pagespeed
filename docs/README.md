# PageSpeed Insights MCP Server

An MCP (Model Context Protocol) server that exposes Google PageSpeed Insights analysis to AI assistants like Claude. Built as a fork of [mcp-curl](https://github.com/sixees/mcp-curl).

## What It Does

Connects an AI assistant to the [Google PageSpeed Insights API v5](https://developers.google.com/speed/docs/insights/v5/get-started), returning Lighthouse scores and Core Web Vitals for any public URL.

## Available Tools

| Tool | Description |
|---|---|
| `analyze_pagespeed` | Run Lighthouse analysis on a URL — scores, Core Web Vitals, or both |
| `jq_query` | Query previously saved JSON response files (inherited from mcp-curl) |

`curl_execute` is intentionally disabled — all HTTP access is through `analyze_pagespeed`.

## Quick Setup

**1. Install dependencies:**

```bash
npm install
```

**2. Set your API key** (strongly recommended — without it the anonymous quota is exhausted quickly):

```bash
export PAGESPEED_API_KEY=your-google-api-key
```

Get a key at [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials).

**3. Run the server:**

```bash
npx tsx configs/pagespeed.ts
```

**4. Connect your AI client** — see [Getting Started](./getting-started.md).

## analyze_pagespeed Tool

| Parameter | Type | Required | Description |
|---|---|---|---|
| `url` | string | Yes | The public URL to analyze |
| `strategy` | `MOBILE` \| `DESKTOP` | No | Analysis strategy (default: `MOBILE`) |
| `filter_preset` | `scores` \| `metrics` \| `summary` | No | Output format (default: `summary`) |

### Output Formats

**`scores`** — Category scores as integers 0–100:
```json
{
  "performance": 100,
  "accessibility": 96,
  "best_practices": 96,
  "seo": 40
}
```

**`metrics`** — Core Web Vitals with raw and display values:
```json
{
  "lcp": { "value": 800, "display": "0.8 s" },
  "fcp": { "value": 800, "display": "0.8 s" },
  "cls": { "value": 0, "display": "0" },
  "tbt": { "value": 0, "display": "0 ms" },
  "tti": { "value": 800, "display": "0.8 s" }
}
```

**`summary`** (default) — Scores + metrics + analyzed URL + strategy.

## Guides

- [Getting Started](./getting-started.md) — Connecting Claude Desktop, Claude Code, and other clients
- [Configuration](./configuration.md) — API key, strategy, and output options
- [YAML Schema Reference](./api-schema.md) — `pagespeed.yaml` configuration format
- [Custom Tools](./custom-tools.md) — Extending the server with additional tools (library reference)
- [Hooks](./hooks.md) — Request/response interception (library reference)

## Architecture

```text
configs/
├── pagespeed.ts    # Entry point — McpCurlServer + custom analyze_pagespeed tool
└── pagespeed.yaml  # API config — baseUrl, auth, defaults, input schema generation
```

See [CLAUDE.md](../CLAUDE.md) for full architecture notes.

# PageSpeed Insights MCP Server

An MCP server that gives LLMs the ability to run Google PageSpeed Insights analysis. Built as a fork of
[mcp-curl](https://github.com/sixees/mcp-curl) using its extension system.

## Setup

```bash
git clone https://github.com/sixees/mcp-pagespeed.git
cd mcp-pagespeed && npm install && npm run build
```

## MCP Configuration

### Claude Code

```bash
claude mcp add pagespeed -- npx tsx /absolute/path/to/mcp-pagespeed/configs/pagespeed.ts
```

Or add to `.mcp.json`:

```json
{
  "mcpServers": {
    "pagespeed": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/mcp-pagespeed/configs/pagespeed.ts"],
      "env": {
        "PAGESPEED_API_KEY": "your-api-key"
      }
    }
  }
}
```

### Claude Desktop

Add to your config file:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "pagespeed": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/mcp-pagespeed/configs/pagespeed.ts"],
      "env": {
        "PAGESPEED_API_KEY": "your-api-key"
      }
    }
  }
}
```

### Other MCP Clients

Run the server directly on stdio:

```bash
npx tsx configs/pagespeed.ts
```

Any MCP client that supports stdio transport can connect by spawning `npx tsx /path/to/configs/pagespeed.ts`.

## Tool: `analyze_pagespeed`

Analyzes a URL with Google PageSpeed Insights API v5. Returns Lighthouse category scores and Core Web Vitals.
Analysis typically takes 15-45 seconds.

### Parameters

| Parameter       | Type   | Required | Description                              |
|-----------------|--------|----------|------------------------------------------|
| `url`           | string | yes      | The URL to analyze (publicly accessible) |
| `strategy`      | string | no       | `MOBILE` (default) or `DESKTOP`          |
| `filter_preset` | string | no       | `summary` (default), `scores`, `metrics` |

### Filter Presets

**scores** — Category scores as 0-100 integers:

```json
{
  "performance": 87,
  "accessibility": 95,
  "best_practices": 100,
  "seo": 92
}
```

**metrics** — Core Web Vitals as value/display pairs:

```json
{
  "lcp": { "value": 1842.5, "display": "1.8 s" },
  "fcp": { "value": 982, "display": "1.0 s" },
  "cls": { "value": 0.003, "display": "0" },
  "tbt": { "value": 150, "display": "150 ms" },
  "tti": { "value": 2100, "display": "2.1 s" }
}
```

**summary** (default) — Both scores and metrics, plus `analyzed_url` and `strategy`.

### Example

```json
{
  "url": "https://example.com",
  "strategy": "MOBILE",
  "filter_preset": "scores"
}
```

## Tool: `jq_query`

Query saved PageSpeed response files without making new API calls. Inherited from mcp-curl — useful when
a large response triggers auto-save to file.

## Environment Variables

| Variable            | Description                                          |
|---------------------|------------------------------------------------------|
| `PAGESPEED_API_KEY` | Google API key (optional, higher rate limits)        |

Without an API key, the PageSpeed API is rate-limited to ~25 queries per 100 seconds.

## Security

All security features from mcp-curl apply: SSRF protection, rate limiting, input validation, file access
controls. See the [mcp-curl security documentation](https://github.com/sixees/mcp-curl#security-highlights)
for details.

The `curl_execute` tool is disabled — only the purpose-built `analyze_pagespeed` tool can make HTTP requests.

## Upstream

This fork is based on [mcp-curl](https://github.com/sixees/mcp-curl). To pull upstream changes:

```bash
git remote add upstream https://github.com/sixees/mcp-curl.git
git fetch upstream
git merge upstream/main --allow-unrelated-histories
```

See the [mcp-curl documentation](https://github.com/sixees/mcp-curl) for the full library API, YAML schema
reference, hooks, custom tools, and configuration options.

## License

MIT

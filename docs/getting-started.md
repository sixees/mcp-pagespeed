# Getting Started

This guide walks you through connecting the PageSpeed Insights MCP server to an AI client.

## Prerequisites

- Node.js 18 or later (the project uses native `fetch` and ESM)
- A Google API key with the PageSpeed Insights API enabled (strongly recommended)
- An MCP client: Claude Desktop, Claude Code, or any MCP-compatible client

### Getting a Google API Key

Without an API key the server uses an anonymous shared quota that is typically exhausted very quickly. To get your own key:

1. Go to [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials)
2. Create a new API key
3. (Optional but recommended) Restrict the key to the **PageSpeed Insights API**

Set it as an environment variable before running the server:

```bash
export PAGESPEED_API_KEY=your-key-here
```

## Installation

```bash
git clone https://github.com/sixees/mcp-pagespeed.git
cd mcp-pagespeed
npm install
```

`npm install` triggers the `prepare` script which builds `dist/` via `tsup`. Re-run `npm run build` (or `npm run dev` for watch mode) any time you edit `src/` or `configs/`.

## Running the Server Manually

```bash
npx tsx configs/pagespeed.ts
```

The server starts on stdio, ready for an MCP client to connect. You should see:

```
cURL MCP server running on stdio
```

(The startup message comes from the vendored library and still uses its original "cURL" wording — see [CLAUDE.md](../CLAUDE.md) for the architecture note on why.)

## Connecting Claude Desktop

Add the server to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "pagespeed": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/mcp-pagespeed/configs/pagespeed.ts"],
      "env": {
        "PAGESPEED_API_KEY": "your-key-here"
      }
    }
  }
}
```

Restart Claude Desktop. The `analyze_pagespeed` tool will be available in your conversations.

## Connecting Claude Code

Either register it via the CLI:

```bash
claude mcp add pagespeed -- npx tsx /absolute/path/to/mcp-pagespeed/configs/pagespeed.ts
```

…or add to your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "pagespeed": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/mcp-pagespeed/configs/pagespeed.ts"],
      "env": {
        "PAGESPEED_API_KEY": "your-key-here"
      }
    }
  }
}
```

## Using the Tool

Once connected, ask your AI assistant:

> "Analyze the PageSpeed performance of https://example.com"

Or call it directly (for testing):

> "Use analyze_pagespeed with url=https://example.com, strategy=DESKTOP, filter_preset=scores"

**Note:** Analysis takes 15–45 seconds — the server is running a full Lighthouse audit via Google's infrastructure.

## Testing the Connection

### Agent integration test

Run the agent integration test to verify everything works end-to-end:

```bash
PAGESPEED_API_KEY=your-key npx tsx configs/pagespeed-agent-test.ts
```

This spawns `configs/pagespeed.ts` as a stdio MCP server, connects with the official MCP client SDK, and asserts that:

- `analyze_pagespeed` is registered (and `jq_query` is still available)
- the tool input schema contains `url`, the `strategy` enum, and the `filter_preset` enum
- a `scores` call returns the four expected keys as integers in 0–100
- a `summary` call returns `scores`, `metrics`, and `analyzed_url`
- an obviously invalid URL returns `isError: true`

You can override the target URL or strategy:

```bash
TEST_URL=https://yoursite.com STRATEGY=DESKTOP PAGESPEED_API_KEY=your-key \
  npx tsx configs/pagespeed-agent-test.ts
```

### Smoke test

`npm run smoke` (or `npx tsx scripts/smoke.ts`) is the leaner CI quality gate. It spawns the server, performs the MCP handshake, calls `analyze_pagespeed` against `SMOKE_URL` (default `https://example.com`), and fails the run on any deviation — non-zero server exit, missing `scores` object, or a `[injection-defense]` log line on a clean URL. It treats anonymous-quota exhaustion as a `[SKIP]` instead of a failure when `PAGESPEED_API_KEY` is unset.

### Unit tests

```bash
npm test
```

Runs the vitest suite (`vitest run`). Tests are co-located with the code they cover (`*.test.ts`).

## Troubleshooting

**`Error: PageSpeed API rate-limited. Set PAGESPEED_API_KEY to use a higher quota.`** — The anonymous quota is shared and frequently exhausted. Set `PAGESPEED_API_KEY`.

**`Error: PageSpeed API rejected the request (likely invalid URL).`** — The URL is malformed or not publicly reachable from Google's infrastructure.

**`Error: Only http and https URLs are supported.` / `Error: Invalid URL provided.`** — The handler validates the URL before hitting the API. Confirm the input parses as a `http://` or `https://` URL.

**Analysis takes longer than 60 seconds** — The server has a 60-second timeout (the `defaults.timeout` in `configs/pagespeed.yaml`). Slow or large pages occasionally exceed this. Try again or use a simpler URL.

**Tool not appearing in Claude** — Restart the client after editing the config. Check that the path in `args` is absolute and correct.

**Need to see Google's raw error body** — Set `PAGESPEED_DEBUG=1`. The server will log the original `error.message` to stderr (still without forwarding it to the LLM).

**Need to correlate `[injection-defense]` events with calls** — Set `PAGESPEED_AUDIT=1`. The server will emit one hostname-only `[pagespeed] invoke target=…` line per call.

## Next Steps

- [Configuration](./configuration.md) — API key, strategy, filter presets, error responses, and observability env vars
- [YAML Schema Reference](./api-schema.md) — How `pagespeed.yaml` drives config and input schema generation

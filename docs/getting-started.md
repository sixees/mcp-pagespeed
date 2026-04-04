# Getting Started

This guide walks you through connecting the PageSpeed Insights MCP server to an AI client.

## Prerequisites

- Node.js 18 or later
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

## Running the Server Manually

```bash
npx tsx configs/pagespeed.ts
```

The server starts on stdio, ready for an MCP client to connect. You should see:

```
cURL MCP server running on stdio
```

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

Add to your project's `.mcp.json`:

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

Run the integration test script to verify everything works end-to-end:

```bash
PAGESPEED_API_KEY=your-key npx tsx configs/pagespeed-agent-test.ts
```

This simulates an AI agent connecting to the server and calling `analyze_pagespeed`. All checks should pass.

You can also test a different URL or strategy:

```bash
TEST_URL=https://yoursite.com STRATEGY=DESKTOP PAGESPEED_API_KEY=your-key npx tsx configs/pagespeed-agent-test.ts
```

## Troubleshooting

**"PageSpeed API returned 429: Quota exceeded"** — Set `PAGESPEED_API_KEY`. The anonymous quota is shared and frequently exhausted.

**"PageSpeed API returned 400"** — The URL is malformed or not publicly reachable.

**Analysis takes longer than 60 seconds** — The server has a 60-second timeout. Slow or large pages occasionally exceed this. Try again or use a simpler URL.

**Tool not appearing in Claude** — Restart Claude Desktop after editing the config. Check that the path in `args` is absolute and correct.

## Next Steps

- [Configuration](./configuration.md) — API key, strategy, and output options
- [YAML Schema Reference](./api-schema.md) — How `pagespeed.yaml` drives config and input schema generation

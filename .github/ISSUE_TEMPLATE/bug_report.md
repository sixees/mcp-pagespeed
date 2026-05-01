---
name: Bug report
about: Report a problem with the mcp-pagespeed MCP server
title: ''
labels: bug
assignees: ''

---

**Describe the bug**
A clear, concise description of what went wrong. If you got a tool error from
the MCP client, include the literal error string.

**To reproduce**
Steps to reproduce the behaviour:
1. Run the server with `...`
2. Invoke `analyze_pagespeed` with `{ url: ..., strategy: ..., filter_preset: ... }`
3. Observe the error / unexpected output

**Expected behaviour**
What you expected to happen instead.

**Environment**
 - mcp-pagespeed version: [e.g. 3.1.1, or commit hash]
 - Node version: [`node --version`]
 - OS: [e.g. macOS 14.5, Ubuntu 22.04]
 - MCP client: [Claude Desktop / Claude Code / `npx tsx configs/pagespeed.ts` / other]
 - Transport: [stdio / HTTP]
 - `PAGESPEED_API_KEY`: [set / unset]

**Logs / output**
Sanitised stderr or response output. **Redact API keys and any PII before
pasting.** If the bug involves an injection-defense detection or audit event,
include the `[injection-defense]` / `[pagespeed]` log lines.

If you can run with `PAGESPEED_DEBUG=1` and/or `PAGESPEED_AUDIT=1`, those
logs are especially helpful.

```text
<paste here>
```

**Additional context**
Anything else that helps triage — frequency, recent config changes, whether
it reproduces against a specific URL.

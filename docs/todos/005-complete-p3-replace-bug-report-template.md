---
status: complete
priority: p3
issue_id: 005
tags: [code-review, github, hygiene]
dependencies: []
---

# Replace web-app `.github/ISSUE_TEMPLATE/bug_report.md`

## Problem Statement

`.github/ISSUE_TEMPLATE/bug_report.md` is GitHub's stock browser/iOS/desktop
boilerplate. It asks for "Browser [chrome/safari]", "Smartphone — iPhone6",
and an OS dropdown. None of this is meaningful for an MCP server invoked over
stdio by an LLM client.

The handoff defers this as out-of-scope, but the PR's thesis is "fork doc shape
removed", and this template still reads as scaffolding from someone else's
web-app fork.

## Findings

`.github/ISSUE_TEMPLATE/bug_report.md:24-35`:

```text
**Desktop (please complete the following information):**
 - OS: [e.g. iOS]
 - Browser [e.g. chrome, safari]
 - Version [e.g. 22]
**Smartphone (please complete the following information):**
 - Device: [e.g. iPhone6]
 - OS: [e.g. iOS8.1]
 - Browser [e.g. stock browser, safari]
 - Version [e.g. 22]
```

## Proposed Solutions

### Option A: rewrite for MCP context

Replace browser/device fields with:
- MCP client (Claude Desktop / Claude Code / `npx tsx configs/pagespeed.ts` / other)
- Node version (`node --version`)
- Transport mode (stdio / HTTP)
- API key behaviour (set / unset; status code on failure)
- `PAGESPEED_AUDIT` / `PAGESPEED_DEBUG` output (sanitised, no secrets)

- Pros: surfaces the data we actually need to triage MCP issues.
- Effort: XS.

### Option B: delete the template, rely on GitHub's free-form issue form

- Pros: zero maintenance.
- Cons: no structured triage signals.
- Effort: XS.

**Recommendation:** Option A.

## Acceptance Criteria

- [ ] `bug_report.md` reflects MCP-server reality (no browser/iOS/desktop sections).
- [ ] Asks for transport mode, Node version, MCP client, sanitised log output.

## Resources

- Review finding: pattern-recognition-specialist (P2)
- Handoff: deferred under "Known issues"

## Work Log

**2026-05-01** — Option A executed. Rewrote `.github/ISSUE_TEMPLATE/bug_report.md`
to reflect MCP-server reality: removed browser/iOS/desktop sections; replaced
with prompts for mcp-pagespeed version, Node version, OS, MCP client (Claude
Desktop / Claude Code / direct stdio / other), transport (stdio / HTTP),
`PAGESPEED_API_KEY` status, and sanitised log output (with explicit redaction
guidance and pointers to `PAGESPEED_DEBUG=1` / `PAGESPEED_AUDIT=1`). The
"To reproduce" section now scaffolds an `analyze_pagespeed` invocation rather
than a browser flow. Acceptance criteria met.

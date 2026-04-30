---
name: README.md does not link to CHANGELOG security updates
description: The fork's README doesn't reference the 3.1.1 security additions or the CHANGELOG — operators evaluating the fork via README alone won't see the prompt-injection defense
type: task
status: complete
priority: p3
issue_id: 018
tags: [code-review, documentation]
resolved_date: 2026-04-30
resolution: README.md Security section gains a paragraph describing the 3.1.1 prompt-injection defense (response sanitisation, detection logging, trust-boundary helper) with explicit links to CLAUDE.md `## Security` and CHANGELOG.md. Environment Variables table also gains the new `PAGESPEED_AUDIT` row.
---

# README.md does not link to CHANGELOG security updates

## Problem Statement

`README.md` is the front door for anyone evaluating this fork. The 3.1.1 security additions (sanitization, detection logger, trust-boundary helper) are documented in `CHANGELOG.md` and `CLAUDE.md` — but `README.md` does not link to either, and a casual reader doesn't see the security posture upfront.

## Proposed Solution

Add a brief "Security" section to `README.md`:
```markdown
## Security

This fork inherits mcp-curl's SSRF, rate limiting, and input validation, plus prompt-injection defense (response sanitization, detection logging) added in 3.1.1. See [CLAUDE.md](./CLAUDE.md) "Security" section for the full trust model and [CHANGELOG.md](./CHANGELOG.md) for version history.
```

- **Effort:** XS
- **Risk:** None.

## Acceptance Criteria

- [x] README.md links to CHANGELOG.md and CLAUDE.md security sections.
- [x] No duplication of security details; README defers to the canonical docs.

## Work Log

- 2026-04-30: Filed during code review.
- 2026-04-30: Resolved. `README.md:141-144` adds a third paragraph to the existing Security section: "This fork adds prompt-injection defense (response sanitisation, detection logging, and a trust-boundary helper that re-validates the API-echoed URL against the input) in 3.1.1. See [CLAUDE.md](./CLAUDE.md) `## Security` for the full trust model and [CHANGELOG.md](./CHANGELOG.md) for version history." No duplication of security details — README defers to CLAUDE.md for the trust model and CHANGELOG for version history. The Environment Variables table at `README.md:125-129` also gains a `PAGESPEED_AUDIT` row (resolved alongside #017).

## Resources

- `README.md`
- `CHANGELOG.md` 3.1.1
- `CLAUDE.md` `## Security`

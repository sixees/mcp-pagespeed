---
name: README.md does not link to CHANGELOG security updates
description: The fork's README doesn't reference the 3.1.1 security additions or the CHANGELOG — operators evaluating the fork via README alone won't see the prompt-injection defense
type: task
status: pending
priority: p3
issue_id: 018
tags: [code-review, documentation]
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

- [ ] README.md links to CHANGELOG.md and CLAUDE.md security sections.
- [ ] No duplication of security details; README defers to the canonical docs.

## Work Log

- 2026-04-30: Filed during code review.

## Resources

- `README.md`
- `CHANGELOG.md` 3.1.1
- `CLAUDE.md` `## Security`

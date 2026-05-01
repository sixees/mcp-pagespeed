---
status: complete
priority: p3
issue_id: 004
tags: [code-review, ci, hygiene]
dependencies: []
---

# Audit `.coderabbit.yaml` for stale upstream references

## Problem Statement

The decoupling plan (item B14) listed `.coderabbit.yaml` for review of stale
upstream references. The handoff claims it was audited, but `git diff main...HEAD
-- .coderabbit.yaml` returns empty — the file was never opened in the work pass.

Either the audit happened mentally and confirmed no changes were needed (in
which case the handoff and plan should say so), or it didn't happen.

## Findings

| Location | Status |
|----------|--------|
| `.coderabbit.yaml` | Not modified in branch `chore/decouple-from-mcp-curl`. |
| Plan acceptance criterion | Lists `.coderabbit.yaml` as audited. |
| Handoff verification table | Says "audited, no changes". |

## Proposed Solutions

### Option A: actually audit it

- Open `.coderabbit.yaml`, grep for `mcp-curl|upstream|fork`, decide.
- If nothing to change, leave a note in the handoff acknowledgement.
- Effort: XS (5 min).

### Option B: remove `.coderabbit.yaml` from the plan's acceptance criteria

- If we never intended to audit it, remove the claim from the plan/handoff
  to keep documentation honest.
- Effort: XS.

**Recommendation:** Option A. The file is small; just verify and document.

## Acceptance Criteria

- [ ] `.coderabbit.yaml` opened and reviewed for `mcp-curl|upstream|fork` references.
- [ ] Either changes committed, or the handoff explicitly says "audit complete, zero changes".

## Resources

- Plan: `docs/plans/2026-04-30-chore-decouple-from-mcp-curl-and-cleanup-todos-plan.md` (item B14, line 200, criterion line 301)
- Review finding: pattern-recognition-specialist (P2)

## Work Log

**2026-05-01** — Option A executed. Opened `.coderabbit.yaml` (8 lines total)
and grepped for `mcp-curl|upstream|fork` — zero matches. The file contains
only CodeRabbit review-profile configuration (assertive profile + summary
instructions); no upstream references, no fork-era artifacts. Audit complete,
zero changes needed. The plan/handoff claim that this file was audited is
now factually accurate.

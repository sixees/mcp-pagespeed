---
status: pending
priority: p3
issue_id: 006
tags: [code-review, packaging, hygiene, pre-existing]
dependencies: []
---

# Gitignore `dist/` and rebuild from source on release

## Problem Statement

`dist/` is currently git-tracked (15 committed build artifacts: `chunk-*.js`,
`lib.js`, etc.). This pre-existed on `main` — not a regression of the
decoupling PR — but the security review surfaced it as a hygiene issue worth
addressing because:

- `package.json#files` includes `"dist"`, so a publish would ship stale
  compiled bytes that may not match `src/`.
- Mitigated for now by `"private": true` (added in this PR), but that's a
  guardrail, not a contract.

## Findings

| Location | Status |
|----------|--------|
| `dist/` | 15 files tracked in git. |
| `.gitignore` | Does not list `dist`. |
| `package.json#files` | Includes `"dist"`. |
| `package.json#scripts.prepublishOnly` | Runs `npm run build` — would regenerate dist on real publish. |

## Proposed Solutions

### Option A: gitignore `dist/`, rebuild on every consumer install/publish
- Add `dist/` to `.gitignore`.
- `git rm -r --cached dist/`.
- Trust `prepublishOnly` to rebuild.
- Pros: no stale bytes; smaller diffs; matches the convention for tsup-built
  packages in the wider ecosystem.
- Cons: `git clone && node dist/index.js` no longer works without a build
  step. (For an `mcp-pagespeed` consumer: not a real workflow because the
  package is `private`.)
- Effort: S.

### Option B: keep dist tracked, add a CI check
- CI fails if `dist/` is out-of-date relative to `src/` at commit time.
- Pros: keeps `git clone && run` ergonomic.
- Cons: brittle CI; extra noise on every PR.
- Effort: M.

**Recommendation:** Option A.

## Acceptance Criteria

- [ ] `dist/` in `.gitignore`.
- [ ] `dist/` removed from git history (`git rm -r --cached dist/`).
- [ ] `npm run build` produces a working `dist/index.js` from a clean checkout.
- [ ] README documents that consumers must `npm run build` before invoking the bin.

## Resources

- Review finding: security-sentinel (P3, pre-existing)

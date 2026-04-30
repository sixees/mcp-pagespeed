---
name: scripts/smoke.ts uses 4-space indentation and inconsistent log prefix
description: The new smoke script uses 4-space indent vs the repo's 2-space convention (see configs/pagespeed.ts) and mixes log prefix styles — small but visible deviations that future hands will copy
type: task
status: pending
priority: p1
issue_id: 006
tags: [code-review, quality, patterns]
---

# scripts/smoke.ts uses 4-space indentation and inconsistent log prefix

## Problem Statement

`scripts/smoke.ts` is the only file in the repo with 4-space indentation. Every other TypeScript file (including the file it spawns, `configs/pagespeed.ts`, and the entire `src/lib/` tree) uses 2-space indentation.

This is a P1 here because:
1. It's the canonical example for any future fork-side script (the repo doesn't have other scripts).
2. There's no `.editorconfig`, `.prettierrc`, or eslint config in this fork to mechanically enforce — the precedent set by this file becomes the implicit standard.
3. The handoff calls out `scripts/` as a brand-new top-level directory ("Pattern deviations"), making the indent choice doubly load-bearing.

Secondary: log prefix is inconsistent with the rest of the codebase:
- `configs/pagespeed.ts` uses `pagespeed:` (e.g. `pagespeed: API error 429: ...`) and `[pagespeed]` (in the signal handler).
- `scripts/smoke.ts` uses `[server]` (line 36), `[SKIP]` (line 117), `[FAIL]` (lines 152, 161), `[OK]` (line 156).

These aren't *wrong* in isolation — but the lack of convention is itself the problem.

## Findings

- **File:** `scripts/smoke.ts` — 4-space indent throughout (verified at lines 26, 33, 41, 60, 79, 144).
- **Repo standard:** 2-space (see `configs/pagespeed.ts`, `src/lib/**/*.ts`).
- **No mechanical enforcement** — no `.editorconfig`, no Prettier, no ESLint config in this repo.

## Proposed Solutions

### Option A — Reformat to 2-space and unify log prefix
- Reformat the file (mechanical: `prettier --tab-width 2 --write scripts/smoke.ts` or hand-edit).
- Standardise on `[smoke]` for harness-level logs and pass server stderr through unchanged (already what happens — drop the `[server]` decoration since stderr is already prefixed by the server's own format).

- **Pros:** Aligns with repo norm; small mechanical change.
- **Cons:** None significant.
- **Effort:** XS
- **Risk:** Trivial.

### Option B — Add `.editorconfig` and reformat
Same as A, plus check in a minimal `.editorconfig`:
```
root = true
[*.ts]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
```

- **Pros:** Future-proofs the convention; editors auto-apply.
- **Cons:** New file; some teams treat editorconfig as out-of-scope tooling.
- **Effort:** XS
- **Risk:** Trivial.

**Recommendation:** Option B. The cherry-pick is the right time to set the precedent because `scripts/` is a new directory and there's no prior art to defer to.

## Acceptance Criteria

- [ ] `scripts/smoke.ts` reformatted to 2-space indent.
- [ ] Log prefix standardised across the file (`[smoke]` for harness, untouched server stderr).
- [ ] Optional but recommended: `.editorconfig` checked in.
- [ ] No behavioural change; `npm run smoke` still passes.

## Work Log

- 2026-04-30: Filed during code review of `feat/cherry-pick-prompt-injection-defense`.

## Resources

- `scripts/smoke.ts` — entire file
- `configs/pagespeed.ts` — repo's reference style
- Handoff "Pattern deviations" — discusses the new `scripts/` directory but not its indent style

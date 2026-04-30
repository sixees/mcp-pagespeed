---
status: pending
priority: p2
issue_id: 002
tags: [code-review, architecture, packaging]
dependencies: []
---

# Narrow `package.json#files` to exclude `docs/plans` and `docs/work`

## Problem Statement

`package.json#files` is `["dist", "docs"]`. Anything inside `docs/` is therefore
packaged into `npm pack` output. After the decoupling, `docs/` now contains:

- `docs/plans/` — planning artifacts (LLM-generated work plans)
- `docs/work/` — handoff documents per branch
- `docs/todos/` — review todos
- `docs/internal/` — contributor-only internal library reference
- `docs/README.md`, `docs/api-schema.md`, `docs/stdio-mode.md` — user-facing

`"private": true` stops `npm publish`, so the bloat never ships in practice.
But that's a guardrail, not a contract — the moment someone flips `private`
or runs `npm pack` for inspection, the planning/handoff trail (which can
contain LLM prompts and operational context) lands in the tarball.

## Findings

`package.json:30-33`:
```json
"files": [
  "dist",
  "docs"
],
```

## Proposed Solutions

### Option A: explicit allow-list in `files`
```json
"files": [
  "dist",
  "docs/README.md",
  "docs/api-schema.md",
  "docs/stdio-mode.md",
  "docs/internal"
],
```
- Pros: explicit; new doc files don't auto-leak.
- Cons: every new user-facing doc must update this list.
- Effort: XS.

### Option B: drop `docs` from `files` entirely
- Rely on README/CHANGELOG (always packaged) plus repository links.
- Pros: zero leak surface.
- Cons: contributors who `npm pack` lose internal docs.
- Effort: XS.

### Option C: `.npmignore` for `docs/plans`, `docs/work`, `docs/todos`
- Pros: explicit deny-list; preserves current `files: ["dist","docs"]`.
- Cons: introduces a second source of truth for packaging rules.
- Effort: XS.

**Recommendation:** Option A. Allow-list aligns with the project's small,
deliberate surface and matches the philosophy of `src/lib/README.md`'s
Stability section.

## Acceptance Criteria

- [ ] `npm pack --dry-run` output does not list any file under `docs/plans/`,
      `docs/work/`, or `docs/todos/`.
- [ ] User-facing docs (`README.md`, CHANGELOG, `docs/api-schema.md`,
      `docs/stdio-mode.md`, `docs/internal/`) still appear in the pack.

## Resources

- Review finding: architecture-strategist (P3, "acknowledged by builder")
- Builder handoff: noted under "Known issues" but not actioned.

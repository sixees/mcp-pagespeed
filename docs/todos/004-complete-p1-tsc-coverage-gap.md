---
name: tsconfig.json doesn't include configs/ or scripts/
description: tsconfig.json's include is "src/**/*" so npx tsc --noEmit silently skips configs/pagespeed.ts and scripts/smoke.ts — the handoff's "type-check clean" claim does not cover the fork-specific code at all
type: task
status: complete
priority: p1
issue_id: 004
tags: [code-review, typescript, false-confidence]
resolved_date: 2026-04-30
resolution: Option A (separate tsconfig.fork.json + npm typecheck script)
---

# tsconfig.json doesn't type-check configs/ or scripts/

## Problem Statement

`tsconfig.json` declares `"include": ["src/**/*"]` and `"rootDir": "./src"`. The cherry-pick adds:
- `configs/pagespeed.ts` (modified — new helpers, signal handlers, post-processor)
- `scripts/smoke.ts` (new — 163 lines of MCP JSON-RPC client logic)

Neither path is in `include`, so `npx tsc --noEmit` does not type-check them.

The handoff says **"Type-check: `npx tsc --noEmit` clean post-cherry-pick and post-Phase-3.5"**. That statement is technically true but misleading — the fork-specific code (which is what this PR actually changed) was *never* gated by tsc.

A targeted check (`tsc --noEmit configs/pagespeed.ts scripts/smoke.ts` with the right module/target flags) is necessary to validate the claim. Until then, type errors in fork code can land silently.

## Findings

- **File:** `tsconfig.json`
- **Evidence:**
  ```json
  "rootDir": "./src",
  "include": ["src/**/*"]
  ```
- **`configs/pagespeed.ts:146`** uses `args as { url: string; strategy?: string; filter_preset?: string }` — an *unverified* cast that tsc would not flag against the actual `ToolCallback<z.ZodObject<z.ZodRawShape>>` signature anyway, but at least with tsc covering this file the surrounding code gets baseline type checking.
- **`scripts/smoke.ts:22`** uses `result?: any` and `error?: { code: number; message: string }` — these would benefit from baseline type checking against the imported `child_process` types.

## Proposed Solutions

### Option A — Add a second tsconfig for fork code
Create `tsconfig.fork.json`:
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "noEmit": true, "rootDir": "." },
  "include": ["configs/**/*.ts", "scripts/**/*.ts"]
}
```
Add an npm script: `"typecheck": "tsc --noEmit -p tsconfig.json && tsc -p tsconfig.fork.json"`.

- **Pros:** Keeps build (`tsup`) ignoring fork code while typecheck covers everything. Doesn't change `outDir` or `rootDir` for the library build.
- **Cons:** Two config files.
- **Effort:** S
- **Risk:** Low.

### Option B — Extend the main `include`
Add `"configs/**/*"` and `"scripts/**/*"` to `tsconfig.json`'s `include`, and bump `rootDir` to `"."`.

- **Pros:** Single config.
- **Cons:** Risks `tsup` picking up these files into the published bundle if its config lifts from `tsconfig.json`. Need to verify `tsup.config.ts` entries are explicit (and they probably are, but worth checking).
- **Effort:** S
- **Risk:** Medium — touches the build path.

**Recommendation:** Option A — additive, isolated, lets the handoff's "type-check clean" claim become true once the new `npm run typecheck` runs in CI.

## Acceptance Criteria

- [ ] `npm run typecheck` (or equivalent) verifies all of `src/`, `configs/`, and `scripts/` with strict mode.
- [ ] CI runs the new typecheck script alongside `npm test`.
- [ ] `configs/pagespeed.ts` and `scripts/smoke.ts` produce zero type errors under strict mode.
- [ ] The handoff's "Testing summary" gets updated when this lands so future reviewers can rely on the claim.

## Work Log

- 2026-04-30: Filed during code review of `feat/cherry-pick-prompt-injection-defense`.
- 2026-04-30: **Resolved.** Added `tsconfig.fork.json` extending the main config with `noEmit: true`, `rootDir: "."`, and `include: ["configs/**/*.ts", "scripts/**/*.ts"]`. Added `"typecheck": "tsc --noEmit -p tsconfig.json && tsc -p tsconfig.fork.json"` to `package.json` scripts. `tsup`'s explicit entry list (verified in `tsup.config.ts`) means the new include doesn't pull configs/scripts into the published bundle.
  - Baseline run (before any other P1 fixes) was clean — no latent type errors in the fork code despite never being checked. Re-running after the #001/#003/#005 refactor of `configs/pagespeed.ts` and the #002/#006 rewrite of `scripts/smoke.ts` is also clean.
  - Followups: CI should call `npm run typecheck` alongside `npm test` (handoff's "Configure PAGESPEED_API_KEY in CI" item is the natural place to bundle this).

## Resources

- `tsconfig.json`
- `configs/pagespeed.ts:146` — `as` cast that could hide type drift
- `scripts/smoke.ts` — entire file currently unchecked

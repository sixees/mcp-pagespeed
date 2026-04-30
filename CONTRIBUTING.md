# Contributing

Thanks for your interest in `mcp-pagespeed` — an MCP server for Google PageSpeed Insights.

This is a small project. Most contributions are bug fixes, doc improvements, or minor extensions to the
`analyze_pagespeed` tool. Larger architectural changes are best discussed in an issue first.

## Project layout

```text
configs/            PageSpeed-specific entry point and helpers
  pagespeed.ts      Server entry: registers analyze_pagespeed
  pagespeed.yaml    API definition (baseUrl, auth, defaults)

src/lib/            Vendored, internal-only library. No public API guarantees.
                    See src/lib/README.md `## Stability`.

docs/               User-facing PageSpeed documentation
  internal/         Reference for the vendored library (contributors only)
```

See [`CLAUDE.md`](./CLAUDE.md) for the architecture and security model.

## Development workflow

```bash
npm install            # Install dependencies
npm run build          # Compile TypeScript to dist/
npm run dev            # Watch-mode build
npm test               # Run vitest
npx tsx configs/pagespeed.ts   # Run the server (stdio)
```

Tests live next to the source as `*.test.ts`. Add tests when you change behaviour, especially anything in
the security layer or response-processing pipeline.

## Coding style

- Modern TypeScript, ESM modules, strict mode
- Zod for runtime schema validation at boundaries
- Prefer pure functions, async/await, early returns
- Match the existing patterns in `configs/pagespeed.ts` and `configs/pagespeed-helpers.ts`

## Pull requests

1. Open a branch from `main` (no separate develop branch)
2. Add a `[Unreleased]` entry to `CHANGELOG.md` describing user-visible changes
3. Run `npm test` and `npm run build` before pushing
4. Keep PRs focused — one logical change per PR

## Security-sensitive changes

Any change that touches `src/lib/security/`, `processResponse()`, or the `analyze_pagespeed` URL trust
boundary needs an explicit note in the PR description explaining the threat model and the new behaviour.
The relevant trust-model documentation lives in `CLAUDE.md` `## Security`.

## Reporting issues

Use [GitHub Issues](https://github.com/sixees/mcp-pagespeed/issues). For security issues, please use the
private security advisory feature on GitHub rather than opening a public issue.

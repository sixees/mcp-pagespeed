# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **Decoupled from upstream `mcp-curl`** — removed the `upstream` git remote and reframed documentation
  (`README.md`, `CLAUDE.md`, `docs/README.md`) so the project is described as a standalone PageSpeed MCP
  server. The vendored library under `src/lib/` is now tracked solely in this repository with no public
  API guarantees and is consumed only by `configs/`. Future versions will not pull from `mcp-curl`.
- **Internal library docs relocated** — `docs/custom-tools.md` and `docs/hooks.md` moved to
  `docs/internal/` and reframed as internal-only references (the vendored library is not a published
  package).
- **`package.json` metadata updated** — `name`, `description`, `repository`, `homepage`, `bugs`,
  `keywords`, and `bin` now reflect this project rather than the upstream library.

### Removed

- **`docs/upstream-contributions.md`** — fork→upstream contribution audit, no longer relevant.
- **`configs/README.md`** — generic library template (this repo only ships one config).
- **`examples/basic`, `examples/with-hooks`, `examples/from-yaml`** — pure library demos, not
  PageSpeed-relevant.
- **`docs/todos/*`** — three resolved TODOs (`configure-unknown-fields`, `cache-utilities`,
  `filter-preset-description`) deleted after verifying their fixes are in place.

### Added

- **`CONTRIBUTING.md`** — brief contributor guide.
- **`docs/internal/`** — landing area for internal library reference docs.
- **`src/lib/README.md` Stability section** — documents the vendored, internal-only nature of the library.

### Security

- **`"private": true` in `package.json`** — prevents accidental `npm publish`. Combined with the legacy
  `prepublishOnly` script and the historical name `mcp-curl`, this is a guardrail against pushing this
  fork to the wrong namespace on npm.

## [3.1.1] - 2026-04-30

### Security

- **Prompt injection defense for HTTP response bodies** — cherry-picked from upstream mcp-curl `5f32c85` (PR #20). Sanitizes Unicode attack vectors (bidi overrides, zero-width chars, Tags block, variation selectors, soft hyphen) and collapses 50+-space whitespace-padding runs. Detection-only logger fires `[injection-defense] [hostname] InjectionDetected` to stderr at most once per hostname per minute on suspicious patterns; content is never suppressed (observability only)
- **Tool metadata sanitization** — `registerCustomTool()` now sanitizes `title` and `description` and truncates description to 1000 chars; the `analyze_pagespeed` tool benefits transparently
- **Spotlighting decision** — `enableSpotlighting` is intentionally NOT enabled in `configs/pagespeed.ts` because custom tools registered via `registerCustomTool()` bypass `tool-wrapper.ts`'s auto-wrap. The compensating control for `analyze_pagespeed` is the post-processor's `trustedAnalyzedUrl()` which re-validates that the API-echoed URL matches the input (origin + pathname + canonicalised search) and falls back to the trusted input on mismatch. `applySpotlighting()` is **not** wired into the handler. See `CLAUDE.md` `## Security`
- **Process-lifecycle hardening** — `configs/pagespeed.ts` now wires `SIGINT`/`SIGTERM` to `server.shutdown()` so `startInjectionCleanup()`'s `setInterval` is cleared on process termination

### Notes

- Versions `3.0.3` and `3.1.0` are reserved (already-existing tags); the next free patch is `3.1.1`
- `dist/` is rebuilt locally; bundle hashes diverge from upstream by design

## [3.0.2] - 2026-04-04

### Changed

- **`httpOnlyUrl()` scheme check hardened** — replaced `url.split(":")[0]` heuristic with `new URL(url).protocol`, consistent with the SSRF layer; eliminates an implicit dependency on Zod v4's URL normalisation order
- **URL scheme validation centralised** — `CurlExecuteSchema.url` and `ApiInfoSchema.baseUrl` now use `httpOnlyUrl()` from `utils/url.ts` (single source of truth); previously each had an inline copy of the same `z.url().refine()` logic
- **`httpOnlyUrl()` unit tests added** — 9 new test cases in `url.test.ts` covering valid schemes, blocked schemes (`ftp://`, `file://`, `data:`, `javascript:`), and invalid URLs; documents which layer rejects each case

## [3.0.1] - 2026-04-04

### Changed

- **Upgraded base to mcp-curl 3.0.1** — merged upstream breaking changes:
  - Zod `^3.23.8` → `^4.0.0`: `z.record()` now requires two type arguments; `z.string().url()` replaced by `z.url()` with http/https `.refine()`
  - `@modelcontextprotocol/sdk` `^1.12.0` → `^1.29.0`: tool handler `extra` parameter is now required (non-optional)
  - URL validation error code changed from `invalid_string` to `invalid_format`
- **`configs/pagespeed.ts` handler updated** — `async (args)` → `async (args, _extra)` to match SDK 1.29.0 type requirements

## [2.0.1] - 2026-02-17

### Security

- **cURL protocol restriction** – Added `--proto=http,https` to all requests as defense-in-depth alongside URL
  validation, preventing protocol confusion between Node's URL parser and cURL's parser

- **cURL size abort** – Added `--max-filesize` (10MB) to abort early when `Content-Length` exceeds the limit (cURL exit
  code 63), before data streams into Node. Chunked/streaming responses without Content-Length still rely on the
  Node-level backstop in `command-executor.ts`

- **Minimal error logging** – Server-side `console.error` now logs only `[hostname]` or `[filename]` with error class
  name. Previously could leak auth headers from `-v` mode, URLs with tokens, cURL stderr fragments, file content
  snippets, or system paths. User-facing error messages are unchanged

## [1.1.5] - 2026-01-27

### Added

- **New `jq_query` tool** - Query saved JSON files without making new HTTP requests
    - Restricted to safe directories (temp, output_dir, cwd)
    - 10MB file size limit
    - Same jq_filter syntax as curl_execute

- **Large response handling** – Automatic handling of responses up to 10MB
    - `jq_filter` parameter for extracting specific JSON data
    - Dot notation for arrays (`.results.0` same as `.results[0]`)
    - Multiple paths support (`.name,.email` returns array, max 20 paths)
    - Array slicing (`.users[0:5]`)
    - Auto-save to file when result exceeds `max_result_size` (default 500KB)
    - `save_to_file` parameter for explicit file saving
    - `output_dir` parameter with `MCP_CURL_OUTPUT_DIR` env var fallback

### Security

- **SSRF protection** – Blocks requests to private networks and internal hosts
    - Private IP ranges: 10.x, 172.16-31.x, 192.168.x, 169.254.x
    - IPv4-mapped IPv6 addresses
    - IPv6 private ranges (loopback, link-local, unique local)
    - Internal TLDs: .local, .internal, .corp, .lan, .localhost (case-insensitive)
    - Cloud metadata hostnames: `metadata.google.internal`, `instance-data.ec2.internal`, `metadata.azure.com`
    - DNS rebinding services: `*.nip.io`, `*.sslip.io`, `*.xip.io`

- **DNS rebinding prevention** – DNS resolved before validation, cURL pinned to validated IP via `--resolve`

- **Protocol whitelist** - Only `http://` and `https://` allowed; `file://`, `ftp://`, UNC paths blocked

- **Symlink security** – All paths resolved via `realpath()` before validation to prevent symlink escape attacks

- **Path traversal protection** - Explicit `..` blocking in both `output_dir` and `filepath` parameters

- **Authentication** – Optional bearer token via `MCP_AUTH_TOKEN` env var for HTTP transport

- **Rate limiting** – Dual limits prevent abuse
    - Per-hostname: 60 requests/minute
    - Per-client: 300 requests/minute total

- **Resource limits**
    - jq filter parsing timeout: 100ms (prevents ReDoS)
    - Global memory limit: 100MB across concurrent requests
    - Session idle timeout: 1 hour with automatic cleanup

- **Command allowlist** – `executeCommand()` restricted to `"curl"` only via TypeScript literal type and runtime guard

- **Input validation**
    - CRLF injection protection for headers, user-agent, auth values
    - Per-request unique metadata separator prevents response injection
    - Strict jq_filter validation (unclosed quotes/brackets, leading zeros, safe integer bounds)

- **Localhost access** – Blocked by default; `MCP_CURL_ALLOW_LOCALHOST=true` enables with port restrictions

### Changed

- Maximum response size increased to 10MB for processing (inline result limit remains configurable)
- Negative indices are no longer supported in jq_filter for simplicity and security

## [1.0.2] - 2026-01-23

### Changed

- Increased the maximum response size from 1MB to 4MB to support larger API responses

## [1.0.0] - 2025-12-12

### Added

- Initial release
- `curl_execute` tool for structured HTTP requests with typed parameters
- Support for common HTTP methods (GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS)
- Authentication options (basic auth, bearer token)
- Request customization (headers, body, form data, user agent)
- Response options (follow redirects, include headers, compressed responses)
- Timeout configuration (1-300 seconds)
- SSL verification control
- JSON metadata output option
- Built-in API documentation resource (`curl://docs/api`)
- Prompt templates for API testing and discovery
- Stdio and HTTP transport support
- Session management for HTTP transport

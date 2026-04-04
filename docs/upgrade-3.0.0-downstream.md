# mcp-curl 3.0.0 — Downstream Upgrade Guide

This document is for planning agents working on MCP servers that extend or embed
`mcp-curl` as a root dependency. It covers every breaking change introduced in
`mcp-curl@3.0.0` and tells you exactly what to find and fix in downstream code.

---

## Summary of what changed

| Area | Old | New |
|---|---|---|
| Zod | `^3.23.8` | `^4.0.0` |
| MCP SDK | `^1.12.0` | `^1.29.0` |
| `headers` / `form` schema | `z.record(z.string())` | `z.record(z.string(), z.string())` |
| URL schema helper | `z.string().url()` | `z.url()` + `.refine()` for http/https |
| URL validation error code | `invalid_string` | `invalid_format` |
| `ZodIssue.invalid_type` | includes `received` field | `received` field removed |
| Tool handler `extra` param | `extra?: {sessionId?: string}` | `extra: {sessionId?: string}` (not optional) |

---

## Breaking change 1 — Zod v4 upgrade

### What to update in `package.json`

```jsonc
// Before
"zod": "^3.23.8"

// After
"zod": "^4.0.0"
```

Run `npm install` after updating.

### Why this matters for downstream servers

If a downstream server imports any Zod-typed values from `mcp-curl` (e.g.
`CurlExecuteInput`, `JqQueryInput`, `ApiSchemaValidationError`) and still has its
own `zod@^3.x` in its own `package.json`, TypeScript will produce type mismatch
errors at compile time because the two Zod versions are distinct type namespaces.
**Both must be on Zod v4.**

---

## Breaking change 2 — `z.record()` now requires two type arguments

This is the most common runtime crash you will encounter. Zod v4 changed the
single-argument form of `z.record()`:

```ts
// Before (Zod v3) — key type defaulted to z.string()
z.record(z.string())           // meant Record<string, string> ✓

// After (Zod v4) — single argument is now the VALUE type only
// BUT it silently compiles and crashes at parse time with a confusing error.
z.record(z.string())           // BROKEN at runtime in Zod v4

// Correct Zod v4 form — always pass key type explicitly
z.record(z.string(), z.string())  // Record<string, string> ✓
```

**Search your downstream codebase for every `z.record(` call and verify it has
two arguments.** The single-argument form will not produce a compile error but
will crash at runtime when the schema is parsed.

This affects any tool schema that defines `headers`, `form`, `defaultHeaders`, or
similar string-to-string maps.

**Concrete example from mcp-curl's own schemas:**

```ts
// Before
headers: z.record(z.string()).optional()
form:    z.record(z.string()).optional()

// After
headers: z.record(z.string(), z.string()).optional()
form:    z.record(z.string(), z.string()).optional()
```

---

## Breaking change 3 — `z.string().url()` → `z.url()`

Zod v4 promotes `url` to a top-level validator. The chained form still compiles
but emits a deprecation warning at build time.

```ts
// Before
z.string().url("Must be a valid URL")

// After
z.url("Must be a valid URL")
```

### Critical: `z.url()` in Zod v4 accepts ALL WHATWG-valid URLs

In Zod v3, `z.string().url()` rejected non-http/https schemes. In Zod v4,
`z.url()` accepts **any** WHATWG-valid URL, including `ftp://`, `file:///`,
`data:`, and `javascript:`. You **must** add a `.refine()` if your schema is
supposed to allow only http/https:

```ts
// WRONG — allows ftp://, file://, javascript:, etc.
url: z.url()

// CORRECT — http/https only
url: z.url().refine(
    (url) => ["http", "https"].includes(url.split(":")[0].toLowerCase()),
    { message: "URL must use http or https scheme" }
)
```

mcp-curl exports a ready-made helper for this — use it in downstream servers
rather than duplicating the logic:

```ts
import { httpOnlyUrl } from "mcp-curl/lib";   // or relative import if vendored

// In a Zod schema:
url: httpOnlyUrl("The endpoint URL")
```

### URL validation error code changed

If any downstream test or error-handling code matches on `issue.code`, update it:

```ts
// Before
if (issue.code === "invalid_string") { ... }

// After
if (issue.code === "invalid_format") { ... }
```

---

## Breaking change 4 — `ZodIssue` structure changed

Zod v4 removed the `received` field from `invalid_type` issues. If downstream
code inspects issue structure (e.g. in custom error formatters or test assertions):

```ts
// Before — safe in Zod v3
const msg = `expected ${issue.expected}, received ${issue.received}`;

// After — `issue.received` does not exist; use `issue.message` instead
const msg = issue.message;
```

---

## Breaking change 5 — Tool handler `extra` parameter is no longer optional

In MCP SDK 1.29.0 the `ToolCallback` type changed the second parameter from
optional to required. If a downstream server defines custom tool handlers with
the old pattern:

```ts
// Before — extra was optional
server.registerTool("my-tool", meta,
    ((params, extra?: { sessionId?: string }) => {
        const id = extra?.sessionId;
        ...
    }) as ToolCallback<typeof MySchema>
);

// After — extra is always provided; no optional chaining needed on the param
server.registerTool("my-tool", meta,
    (params, extra) => {
        const id = extra.sessionId;   // extra itself is guaranteed
        ...
    }
);
```

Also note: you no longer need to cast handlers with `as ToolCallback<...>`. In
SDK 1.29.0 the types are inferred correctly when the schema is passed to
`registerTool()` and the handler is written as a properly typed function (not a
cast expression). Removing the cast is recommended — keeping it masks type errors.

---

## Breaking change 6 — YAML schema `baseUrl` validation tightened

If your downstream server uses the YAML-driven schema system (`loadApiSchema()` /
`ApiSchemaValidator`), the `baseUrl` field in API definitions is now validated
against the http/https scheme allowlist in addition to URL format. Any existing
YAML files with `ftp://` or other non-http/https base URLs will now throw
`ApiSchemaValidationError` at load time.

---

## Non-breaking changes worth knowing

### `z.ZodRawShape` → `Record<string, z.ZodTypeAny>`

If downstream code accumulates schema fields into a shape object and types it as
`z.ZodRawShape`, this type still exists in Zod v4 but `Record<string, z.ZodTypeAny>`
is more precise and avoids an implicit `any` in strict TypeScript configs. Consider
updating for cleaner builds.

### `buildStringEnum` / `buildNumberUnion` helpers (internal)

The generator now uses internal helpers that correctly handle single-element
arrays (`z.enum()` and `z.union()` still require 2+ elements in Zod v4). If your
downstream server generates schemas from data arrays, apply the same pattern:

```ts
function buildStringEnum(values: string[]): z.ZodTypeAny {
    if (values.length === 1) return z.literal(values[0]);
    return z.enum(values as [string, ...string[]]);
}
```

### `@modelcontextprotocol/sdk` 1.29.0

Other than the `extra` parameter change documented above, the tool registration
surface (`server.registerTool()`, `McpServer`, transports) is compatible.

---

## Checklist for downstream planning agents

Work through this list in dependency order (schemas first, then handlers):

- [ ] Update `"zod"` in `package.json` to `"^4.0.0"` and run `npm install`
- [ ] Update `"@modelcontextprotocol/sdk"` to `"^1.29.0"` and run `npm install`
- [ ] Find every `z.record(z.string())` — change to `z.record(z.string(), z.string())`
- [ ] Find every `z.string().url()` — change to `z.url()` (+ `.refine()` for http/https enforcement)
- [ ] Audit all URL schema fields — confirm each has the http/https `.refine()` or uses `httpOnlyUrl()`
- [ ] Find any `issue.code === "invalid_string"` checks on URL fields — update to `"invalid_format"`
- [ ] Find any `issue.received` accesses on `invalid_type` issues — replace with `issue.message`
- [ ] Find all `server.registerTool()` handlers — remove `as ToolCallback<...>` casts, make `extra` non-optional
- [ ] If using YAML schema system: verify all `baseUrl` values in YAML files use `http://` or `https://`
- [ ] Run `npm test` — all tests should pass with zero Zod deprecation warnings

---

## Integration test reference

`scripts/integration-test.mjs` in the mcp-curl root is a working end-to-end
test that connects to the server as an MCP client would (via stdio), lists tools,
and calls `curl_execute`. It confirmed:

- The Zod v4 `headers` schema requires a **record object** `{ "Key": "Value" }` —
  passing an array of `{ key, value }` pairs produces a validation error with
  `"expected record, received array"`.
- `curl_execute` and `jq_query` register and respond correctly under MCP SDK 1.29.0.

Run a similar end-to-end test on each downstream server after completing the
checklist above.

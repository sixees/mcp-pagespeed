# YAML Schema Reference

The file `configs/pagespeed.yaml` configures the PageSpeed Insights MCP server. It is loaded at startup by `configs/pagespeed.ts` for two purposes:

1. **Server configuration** — `api.baseUrl`, `defaults.timeout`, and `defaults.headers` are passed to `PageSpeedServer.configure()` (the class is exported from the vendored library at `src/lib/` as both `PageSpeedServer` and the legacy alias `McpCurlServer`).
2. **Input schema generation** — `generateInputSchema()` reads the endpoint's `parameters` and `response.filterPresets` to produce the Zod input schema for `analyze_pagespeed` (`url`, `strategy`, and the `filter_preset` enum).

The `jqFilter` and `filterPresets[].jqFilter` values are **not used at runtime** for `analyze_pagespeed` — response processing is done in TypeScript (`configs/pagespeed-helpers.ts`) because the built-in jq engine cannot do object construction or arithmetic. They remain in the YAML only as documentation of intent.

## pagespeed.yaml

The file shipped at `configs/pagespeed.yaml`:

```yaml
apiVersion: "1.0"

api:
  name: pagespeed-insights
  title: Google PageSpeed Insights
  description: >
    Analyze web page performance using Google PageSpeed Insights API v5.
    Returns category scores (Performance, Accessibility, Best Practices, SEO)
    and Core Web Vitals (LCP, FCP, CLS, TBT, TTI).
    Analysis typically takes 15-45 seconds.
  version: "5.0.0"
  baseUrl: https://pagespeedonline.googleapis.com

auth:
  apiKey:
    type: query         # Sent as ?key=...
    name: key
    envVar: PAGESPEED_API_KEY
    required: false     # Server starts without a key; quota is very limited

defaults:
  timeout: 60           # Seconds — PageSpeed analysis takes 15-45s
  headers:
    Accept: application/json

endpoints:
  - id: analyze_pagespeed
    path: /pagespeedonline/v5/runPagespeed
    method: GET
    title: Analyze PageSpeed
    description: >
      Run PageSpeed Insights analysis on a URL. Returns category scores
      and Core Web Vitals. Analysis takes 15-45 seconds.
      Without PAGESPEED_API_KEY, rate-limited to ~25 queries/100s.
    parameters:
      - name: url
        in: query
        type: string
        required: true
        description: The URL to analyze (must be publicly accessible)
      - name: strategy
        in: query
        type: string
        required: false
        description: Analysis strategy
        default: MOBILE
        enum: [MOBILE, DESKTOP]
    response:
      jqFilter: ".lighthouseResult"     # informational only
      filterPresets:
        - name: scores
          jqFilter: ".lighthouseResult.categories"
          description: "Category scores as 0-100 integers (performance, accessibility, best_practices, seo)"
        - name: metrics
          jqFilter: ".lighthouseResult.audits"
          description: "Core Web Vitals as value/display pairs (lcp, fcp, cls, tbt, tti)"
        - name: summary
          jqFilter: ".lighthouseResult"
          description: "Both scores and metrics plus analyzed URL and strategy"
```

## Schema Field Reference

### apiVersion

Must be `"1.0"`.

### api

| Field | Description |
|---|---|
| `name` | Machine-readable identifier |
| `title` | Human-readable name |
| `description` | Free-form description (used by upstream YAML-driven tool generation; informational for `analyze_pagespeed`'s custom handler) |
| `version` | API version string |
| `baseUrl` | Base URL prepended to `endpoints[].path` |

### auth

The PageSpeed Insights API accepts an optional API key as a query parameter.

```yaml
auth:
  apiKey:
    type: query       # "query" sends key as ?key=value; "header" sends as a header
    name: key         # The query parameter name
    envVar: PAGESPEED_API_KEY
    required: false   # If true, server fails to start when the env var is missing
```

`getAuthConfig()` reads this block at runtime and returns the query params object that `configs/pagespeed.ts` merges onto the outgoing API URL (`?key=<value>`).

### defaults

```yaml
defaults:
  timeout: 60         # Passed to PageSpeedServer as defaultTimeout
  headers:
    Accept: application/json   # Passed as defaultHeaders
```

### endpoints

Each endpoint entry drives `generateInputSchema()`. For `analyze_pagespeed` the YAML-generated tool handler is **not** used — `configs/pagespeed.ts` registers the tool via `registerCustomTool()` with its own handler so it can repeat `&category=` query params (the YAML schema is single-value per parameter) and post-process the response in TypeScript.

| Field | Description |
|---|---|
| `id` | Tool name — must match the name passed to `registerCustomTool()` |
| `path` | URL path appended to `api.baseUrl` |
| `method` | HTTP method (used by `getMethodAnnotations()` for the tool annotations) |
| `title` | Tool title, surfaced to the MCP client |
| `description` | Used as the base of the tool description shown to the LLM (the entry script appends filter-preset and trust-boundary text) |
| `parameters` | Drives the generated Zod schema's input fields |
| `response.filterPresets` | Their `name` values become the `filter_preset` enum on the input schema |

### parameters

```yaml
parameters:
  - name: url
    in: query
    type: string
    required: true
    description: The URL to analyze (must be publicly accessible)
  - name: strategy
    in: query
    type: string
    required: false
    default: MOBILE
    enum: [MOBILE, DESKTOP]
```

| Field | Type | Description |
|---|---|---|
| `name` | string | Parameter name in the generated schema |
| `in` | `query` \| `path` \| `header` \| `body` | Where to place the parameter (informational for `analyze_pagespeed`; the custom handler builds its own URL) |
| `type` | `string` \| `number` \| `integer` \| `boolean` | Zod type |
| `required` | boolean | Whether the field is required (default: false) |
| `default` | any | Default value documented in the Zod schema |
| `enum` | array | Restricts values to an enum |
| `description` | string | Shown to the LLM |

### response.filterPresets

```yaml
response:
  filterPresets:
    - name: scores
      description: "Category scores as 0-100 integers"
    - name: metrics
      description: "Core Web Vitals with value/display pairs"
    - name: summary
      description: "Scores + metrics + analyzed_url + strategy"
```

The `name` values are sanitised (Unicode attack-vector strip) and emitted by `generateInputSchema()` as a `filter_preset` enum on the tool's input schema. Duplicate names after sanitisation cause schema generation to throw at startup. The `jqFilter` field is ignored for `analyze_pagespeed`; the runtime list of presets accepted by the handler lives in `configs/pagespeed-helpers.ts` as `PRESETS` and must stay in lockstep with this block.

## How the YAML Drives the Server

```typescript
// configs/pagespeed.ts (excerpt)
import {
  PageSpeedServer,
  loadApiSchema,
  generateInputSchema,
  getAuthConfig,
  type ApiSchema,
} from "mcp-pagespeed";
import { getMethodAnnotations } from "mcp-pagespeed/schema";

const schema: ApiSchema = await loadApiSchema(schemaPath);
const endpoint = schema.endpoints[0];

// 1. Server config from YAML
const server = new PageSpeedServer()
  .configure({
    baseUrl: schema.api.baseUrl,                // https://pagespeedonline.googleapis.com
    defaultTimeout: schema.defaults?.timeout,   // 60
    defaultHeaders: schema.defaults?.headers,   // { Accept: application/json }
    maxResultSize: MAX_RESULT_SIZE_BYTES,       // 2_000_000 (set in pagespeed-helpers.ts)
  })
  .disableCurlExecute();

// 2. Input schema from YAML parameters + filterPresets
const inputSchema = generateInputSchema(endpoint);
// Produces: z.object({ url, strategy, filter_preset })

// 3. Auth config from YAML auth block
const { queryParams } = getAuthConfig(schema.auth);
// Produces: { key: process.env.PAGESPEED_API_KEY } (if set)

// 4. Method annotations from the YAML method
const annotations = getMethodAnnotations("GET");

// 5. Custom handler — NOT generated from YAML
server.registerCustomTool(endpoint.id, { title, description, inputSchema, annotations }, handler);
```

The actual API request, JSON parsing, trust-boundary validation, and response shaping are handled entirely in TypeScript (`configs/pagespeed.ts` + `configs/pagespeed-helpers.ts`) — the YAML does not generate a tool handler for `analyze_pagespeed`.

The bare specifiers `"mcp-pagespeed"` and `"mcp-pagespeed/schema"` are self-imports — they resolve to the local vendored library at `src/lib/` via `package.json#name` + `#exports`. There is no external `mcp-pagespeed` package on npm.

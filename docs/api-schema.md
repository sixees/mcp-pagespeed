# YAML Schema Reference

The file `configs/pagespeed.yaml` configures the PageSpeed Insights MCP server. It is loaded at startup by `configs/pagespeed.ts` for two purposes:

1. **Server configuration** — `api.baseUrl`, `defaults.timeout`, and `defaults.headers` are passed to `McpCurlServer.configure()`
2. **Input schema generation** — `generateInputSchema()` reads the endpoint's `parameters` and `response.filterPresets` to produce the Zod input schema for `analyze_pagespeed`

The `jqFilter` and `filterPresets[].jqFilter` values are **not used at runtime** — response processing is done in TypeScript because the built-in jq engine cannot do object construction or arithmetic.

## pagespeed.yaml

```yaml
apiVersion: "1.0"

api:
  name: pagespeed-insights
  title: Google PageSpeed Insights
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
    parameters:
      - name: url
        in: query
        type: string
        required: true
      - name: strategy
        in: query
        type: string
        required: false
        default: MOBILE
        enum: [MOBILE, DESKTOP]
    response:
      filterPresets:
        - name: scores
        - name: metrics
        - name: summary
```

## Schema Field Reference

### apiVersion

Must be `"1.0"`.

### api

| Field | Description |
|---|---|
| `name` | Machine-readable identifier |
| `title` | Human-readable name |
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

`getAuthConfig()` reads this block at runtime and appends `?key=<value>` to the API URL.

### defaults

```yaml
defaults:
  timeout: 60         # Passed to McpCurlServer as defaultTimeout
  headers:
    Accept: application/json   # Passed as defaultHeaders
```

### endpoints

Each endpoint entry is used by `generateInputSchema()` to build the Zod schema for that tool.

| Field | Description |
|---|---|
| `id` | Tool name — must match the name passed to `registerCustomTool()` |
| `path` | URL path appended to `api.baseUrl` |
| `method` | HTTP method (informational only for custom tools) |
| `parameters` | Drives the generated Zod schema's input fields |
| `response.filterPresets` | Their `name` values become the `filter_preset` enum |

### parameters

```yaml
parameters:
  - name: url
    in: query
    type: string
    required: true
    description: The URL to analyze
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
| `in` | `query` \| `path` \| `header` \| `body` | Where to place the parameter |
| `type` | `string` \| `number` \| `integer` \| `boolean` | Zod type |
| `required` | boolean | Whether the field is required (default: false) |
| `default` | any | Default value in the Zod schema |
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

The `name` values are collected by `generateInputSchema()` and emitted as a `filter_preset` enum on the tool's input schema. The `jqFilter` field (if present) is ignored for custom tools.

## How the YAML Drives the Server

```typescript
// Load schema
const schema: ApiSchema = await loadApiSchema(schemaPath);
const endpoint = schema.endpoints[0];

// 1. Server config from YAML
server.configure({
    baseUrl: schema.api.baseUrl,         // https://pagespeedonline.googleapis.com
    defaultTimeout: schema.defaults?.timeout,   // 60
    defaultHeaders: schema.defaults?.headers,   // { Accept: application/json }
});

// 2. Input schema from YAML parameters + filterPresets
const inputSchema = generateInputSchema(endpoint);
// Produces: z.object({ url, strategy, filter_preset })

// 3. Auth config from YAML auth block
const { queryParams } = getAuthConfig(schema.auth);
// Produces: { key: process.env.PAGESPEED_API_KEY } (if set)
```

The actual API request and response processing are handled entirely in TypeScript — the YAML does not generate a tool handler for custom tools.

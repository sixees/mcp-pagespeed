// src/lib.ts
// Main entry point for the vendored, internal-only library backing
// `mcp-pagespeed`. Resolved by Node when consumers do
//   import { ... } from "mcp-pagespeed";
// via package.json#name + #exports.
//
// This is not a published package and provides no public API guarantees.
// See ./lib/README.md `## Stability` for details.
//
// Surface area is intentionally minimal — re-exports only what the in-tree
// consumer (`configs/pagespeed.ts`) actually imports. Adding a new tool to
// `configs/` may require adding a re-export here. That's the deliberate
// trade-off: a smaller surface keeps cold-start light and signals that the
// library is internal, not a published API.

// Server class. `PageSpeedServer` is the preferred name; `McpCurlServer`
// is retained for the in-tree library internals which still use the original
// class name (see src/lib/extensible/mcp-curl-server.ts).
export { McpCurlServer, McpCurlServer as PageSpeedServer } from "./lib/extensible/index.js";
export type { CustomToolMeta } from "./lib/extensible/index.js";

// Schema loading + input-schema generation + auth + the ApiSchema type are
// the only schema-module symbols `configs/pagespeed.ts` reaches for via the
// `.` entry. `getMethodAnnotations` lives on the `./schema` subpath.
export { loadApiSchema, generateInputSchema, getAuthConfig } from "./lib/schema/index.js";
export type { ApiSchema } from "./lib/schema/index.js";

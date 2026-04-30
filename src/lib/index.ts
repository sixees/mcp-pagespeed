// src/lib/index.ts
// Barrel export for the vendored, internal-only library.
//
// Imported via the `mcp-pagespeed` self-import (see package.json#name +
// #exports), e.g.:
//   import { McpCurlServer, createApiServer } from "mcp-pagespeed";
//
// This is not a published package and provides no public API guarantees.
// See ./README.md `## Stability` for details.

// Extensible server class and utilities
export { McpCurlServer, createInstanceUtilities } from "./extensible/index.js";
export type { CustomToolMeta, InstanceUtilities, ExecuteRequestParams } from "./extensible/index.js";

// API server factory
export { createApiServer, createApiServerSync } from "./api-server.js";
export type { CreateApiServerOptions } from "./api-server.js";

// Public types
export type {
    McpCurlConfig,
    TransportMode,
    HookContext,
    BeforeRequestResult,
    BeforeRequestHook,
    AfterResponseHook,
    OnErrorHook,
    CurlExecuteInput,
    JqQueryInput,
} from "./types/public.js";

// URL validation helper
export { httpOnlyUrl } from "./utils/url.js";

// Server schemas (Zod schemas for input validation)
export { CurlExecuteSchema, JqQuerySchema } from "./server/schemas.js";

// Execution utilities
export { executeCurlRequest } from "./tools/curl-execute.js";
export { executeJqQuery } from "./tools/jq-query.js";

// Server factory and registration
export { createServer } from "./server/server-factory.js";
export { registerAllResources } from "./resources/index.js";
export { registerAllPrompts } from "./prompts/index.js";

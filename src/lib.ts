// src/lib.ts
// Main entry point for the vendored, internal-only library backing
// `mcp-pagespeed`. Resolved by Node when consumers do
//   import { ... } from "mcp-pagespeed";
// via package.json#name + #exports.
//
// This is not a published package and provides no public API guarantees.
// See ./lib/README.md `## Stability` for details.

// Main server class
export { McpCurlServer } from "./lib/extensible/index.js";
export type { CustomToolMeta } from "./lib/extensible/index.js";

// Instance utilities for direct tool execution
export { createInstanceUtilities } from "./lib/extensible/index.js";
export type { InstanceUtilities, ExecuteRequestParams } from "./lib/extensible/index.js";

// API server factory (creates servers from YAML schema definitions)
export { createApiServer, createApiServerSync } from "./lib/api-server.js";
export type { CreateApiServerOptions } from "./lib/api-server.js";

// Schema types and utilities
export type {
    // Schema types
    ApiSchemaVersion,
    AuthConfig,
    ParameterLocation,
    ParameterType,
    EndpointParameter,
    ResponseConfig,
    HttpMethod,
    EndpointDefinition,
    ApiInfo,
    ApiDefaults,
    ApiSchema,
    // Generator config
    GeneratorConfig,
} from "./lib/schema/index.js";

export {
    // Validation
    ApiSchemaValidator,
    ApiSchemaValidationError,
    validateApiSchema,
    // Loading
    ApiSchemaLoadError,
    loadApiSchema,
    loadApiSchemaFromString,
    // Generation
    AuthenticationError,
    generateInputSchema,
    buildUrl,
    getAuthConfig,
    registerEndpointTools,
    generateToolDefinitions,
} from "./lib/schema/index.js";

// Public API types
export type {
    // Configuration
    McpCurlConfig,
    TransportMode,

    // Hook types
    HookContext,
    BeforeRequestResult,
    BeforeRequestHook,
    AfterResponseHook,
    OnErrorHook,

    // Input types (for typing hook parameters)
    CurlExecuteInput,
    JqQueryInput,
} from "./lib/types/public.js";

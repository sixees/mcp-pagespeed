import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/** Tool result type returned by executeCurlRequest */
interface CurlExecuteResult {
    [key: string]: unknown;
    content: [{
        type: "text";
        text: string;
    }];
    isError?: boolean;
}
/** Extra context passed to tool handler */
interface CurlExecuteExtra {
    sessionId?: string;
    /** Override env var for allowing localhost requests (from McpCurlConfig) */
    allowLocalhost?: boolean;
}

/**
 * API Schema version for forward compatibility.
 * New versions can introduce breaking changes with migration support.
 */
type ApiSchemaVersion = "1.0";
/**
 * Authentication configuration for API requests.
 * Supports API key (query/header) and bearer token auth.
 * All values are injected from environment variables.
 */
interface AuthConfig {
    /** API key authentication */
    apiKey?: {
        /** Where to place the API key */
        type: "query" | "header";
        /** Parameter or header name (e.g., "key", "X-API-Key") */
        name: string;
        /** Environment variable name containing the API key */
        envVar: string;
        /** Whether auth is required (default: true) */
        required?: boolean;
    };
    /** Bearer token authentication */
    bearer?: {
        /** Environment variable name containing the bearer token */
        envVar: string;
        /** Whether auth is required (default: true) */
        required?: boolean;
    };
}
/**
 * Where a parameter is placed in the HTTP request.
 */
type ParameterLocation = "path" | "query" | "header" | "body";
/**
 * Supported parameter types for endpoints.
 */
type ParameterType = "string" | "number" | "boolean" | "integer";
/**
 * Single parameter definition for an endpoint.
 */
interface EndpointParameter {
    /** Parameter name */
    name: string;
    /** Where to place this parameter */
    in: ParameterLocation;
    /** Parameter type for validation */
    type: ParameterType;
    /** Whether the parameter is required (default: false) */
    required?: boolean;
    /** Description for LLM context */
    description?: string;
    /** Default value if not provided */
    default?: string | number | boolean;
    /** Allowed values (creates enum constraint) */
    enum?: (string | number)[];
}
/**
 * Response processing configuration for an endpoint.
 */
interface ResponseConfig {
    /** Default jq filter to apply to responses */
    jqFilter?: string;
    /** Named filter presets users can select */
    filterPresets?: Array<{
        /** Preset name for selection */
        name: string;
        /** jq filter expression */
        jqFilter: string;
        /** Human-readable description for LLM context */
        description?: string;
    }>;
}
/**
 * HTTP methods supported by endpoints.
 */
type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";
/**
 * Single endpoint definition that generates an MCP tool.
 */
interface EndpointDefinition {
    /** Tool name (lowercase with underscores, e.g., "get_user") */
    id: string;
    /** URL path with {param} placeholders (e.g., "/users/{id}") */
    path: string;
    /** HTTP method */
    method: HttpMethod;
    /** Human-readable title for the tool */
    title: string;
    /** Description providing LLM context */
    description: string;
    /** Parameter definitions */
    parameters?: EndpointParameter[];
    /** Response processing configuration */
    response?: ResponseConfig;
}
/**
 * API metadata in the schema.
 */
interface ApiInfo {
    /** Machine-readable API name */
    name: string;
    /** Human-readable API title */
    title: string;
    /** Description for LLM context */
    description: string;
    /** API version string */
    version: string;
    /** Base URL for all endpoints */
    baseUrl: string;
}
/**
 * Default settings applied to all endpoints.
 */
interface ApiDefaults {
    /** Default request timeout in seconds */
    timeout?: number;
    /** Default headers for all requests */
    headers?: Record<string, string>;
}
/**
 * Complete API schema definition.
 * This is the root structure of a YAML API definition file.
 */
interface ApiSchema {
    /** Schema version for compatibility */
    apiVersion: ApiSchemaVersion;
    /** API metadata */
    api: ApiInfo;
    /** Authentication configuration */
    auth?: AuthConfig;
    /** Default settings */
    defaults?: ApiDefaults;
    /** Endpoint definitions */
    endpoints: EndpointDefinition[];
}

/**
 * Error thrown when loading an API schema fails.
 */
declare class ApiSchemaLoadError extends Error {
    readonly cause?: Error | undefined;
    constructor(message: string, cause?: Error | undefined);
}
/**
 * Load and validate an API schema from a YAML file.
 *
 * SECURITY: This function reads from the filesystem. Ensure definitionPath
 * comes from a trusted source (not user input) to prevent path traversal attacks.
 * Path validation should be performed at the application boundary (CLI, HTTP handler).
 *
 * @param definitionPath - Path to the YAML definition file
 * @returns Validated ApiSchema
 * @throws ApiSchemaLoadError if file cannot be read or parsed
 * @throws ApiSchemaValidationError if schema validation fails
 */
declare function loadApiSchema(definitionPath: string): Promise<ApiSchema>;
/**
 * Load and validate an API schema from a YAML string.
 * Useful for testing or inline schema definitions.
 *
 * @param yamlContent - YAML content as a string
 * @returns Validated ApiSchema
 * @throws ApiSchemaLoadError if YAML parsing fails
 * @throws ApiSchemaValidationError if schema validation fails
 */
declare function loadApiSchemaFromString(yamlContent: string): ApiSchema;

/**
 * Error thrown when authentication is required but not available.
 */
declare class AuthenticationError extends Error {
    constructor(message: string);
}
/**
 * Configuration for generating endpoint tools.
 */
interface GeneratorConfig {
    /** Override auth config (for testing) */
    authOverride?: Record<string, string>;
    /** Custom timeout to apply */
    timeout?: number;
    /** Default headers to merge */
    defaultHeaders?: Record<string, string>;
    /** Override base URL (takes precedence over schema.api.baseUrl) */
    baseUrl?: string;
    /** Allow localhost requests (propagated to curl executor) */
    allowLocalhost?: boolean;
    /** Default User-Agent for all requests. Empty string disables. */
    defaultUserAgent?: string;
    /** Default Referer for all requests. Empty string disables. */
    defaultReferer?: string;
}
/**
 * Generate a Zod input schema from endpoint parameter definitions.
 *
 * @param endpoint - Endpoint definition with parameters
 * @returns Zod object schema for the endpoint
 */
declare function generateInputSchema(endpoint: EndpointDefinition): z.ZodObject<z.ZodRawShape>;
/**
 * Build the full URL with path parameter substitution and query params.
 *
 * @param baseUrl - API base URL
 * @param path - Endpoint path with {param} placeholders
 * @param pathParams - Values for path parameters
 * @param queryParams - Query parameters to append
 * @returns Fully constructed URL
 */
declare function buildUrl(baseUrl: string, path: string, pathParams: Record<string, unknown>, queryParams: Record<string, string>): string;
/**
 * Extract authentication headers and query params from environment variables.
 *
 * @param auth - Auth configuration from schema
 * @param override - Optional override values (for testing)
 * @returns Headers and query params to add to requests
 * @throws AuthenticationError if required auth is missing
 */
declare function getAuthConfig(auth: AuthConfig | undefined, override?: Record<string, string>): {
    headers: Record<string, string>;
    queryParams: Record<string, string>;
};
/**
 * Get MCP tool annotations based on HTTP method.
 * Indicates to clients the nature of the tool operation.
 *
 * @param method - HTTP method of the endpoint
 * @returns MCP tool annotations object
 */
declare function getMethodAnnotations(method: HttpMethod): {
    readOnlyHint: boolean;
    destructiveHint: boolean;
    idempotentHint: boolean;
    openWorldHint: boolean;
};
/**
 * Register all endpoints from an API schema as MCP tools.
 *
 * @param server - MCP server instance
 * @param schema - Validated API schema
 * @param config - Optional generator configuration
 */
declare function registerEndpointTools(server: McpServer, schema: ApiSchema, config?: GeneratorConfig): void;
/**
 * Generate tool definitions without registering them.
 * Useful for inspection or custom registration.
 *
 * @param schema - Validated API schema
 * @returns Array of tool definitions with handlers
 */
declare function generateToolDefinitions(schema: ApiSchema, config?: GeneratorConfig): Array<{
    id: string;
    title: string;
    description: string;
    method: HttpMethod;
    inputSchema: z.ZodObject<z.ZodRawShape>;
    handler: (params: Record<string, unknown>, extra?: CurlExecuteExtra) => Promise<CurlExecuteResult>;
}>;

export { type ApiSchema as A, type CurlExecuteResult as C, type EndpointDefinition as E, type GeneratorConfig as G, type HttpMethod as H, type ParameterLocation as P, type ResponseConfig as R, type ApiDefaults as a, type ApiInfo as b, ApiSchemaLoadError as c, type ApiSchemaVersion as d, type AuthConfig as e, AuthenticationError as f, type EndpointParameter as g, type ParameterType as h, buildUrl as i, generateInputSchema as j, generateToolDefinitions as k, getAuthConfig as l, getMethodAnnotations as m, loadApiSchema as n, loadApiSchemaFromString as o, registerEndpointTools as r };

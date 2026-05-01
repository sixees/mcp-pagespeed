import { ToolCallback, McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { C as CurlExecuteResult } from './generator-kKl-WuXG.js';
export { A as ApiSchema, j as generateInputSchema, l as getAuthConfig, n as loadApiSchema } from './generator-kKl-WuXG.js';

/**
 * Schema for structured cURL execution.
 * Validates all parameters for the curl_execute tool.
 */
declare const CurlExecuteSchema: z.ZodObject<{
    url: z.ZodURL;
    method: z.ZodOptional<z.ZodEnum<{
        GET: "GET";
        POST: "POST";
        PUT: "PUT";
        PATCH: "PATCH";
        DELETE: "DELETE";
        HEAD: "HEAD";
        OPTIONS: "OPTIONS";
    }>>;
    headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    data: z.ZodOptional<z.ZodString>;
    form: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    follow_redirects: z.ZodDefault<z.ZodBoolean>;
    max_redirects: z.ZodOptional<z.ZodNumber>;
    insecure: z.ZodDefault<z.ZodBoolean>;
    timeout: z.ZodOptional<z.ZodNumber>;
    user_agent: z.ZodOptional<z.ZodString>;
    basic_auth: z.ZodOptional<z.ZodString>;
    bearer_token: z.ZodOptional<z.ZodString>;
    verbose: z.ZodDefault<z.ZodBoolean>;
    include_headers: z.ZodDefault<z.ZodBoolean>;
    compressed: z.ZodDefault<z.ZodBoolean>;
    include_metadata: z.ZodDefault<z.ZodBoolean>;
    jq_filter: z.ZodOptional<z.ZodString>;
    max_result_size: z.ZodOptional<z.ZodNumber>;
    save_to_file: z.ZodOptional<z.ZodBoolean>;
    output_dir: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
/** Inferred TypeScript type from CurlExecuteSchema */
type CurlExecuteInput = z.infer<typeof CurlExecuteSchema>;
/**
 * Schema for jq_query tool (query JSON files without HTTP requests).
 */
declare const JqQuerySchema: z.ZodObject<{
    filepath: z.ZodString;
    jq_filter: z.ZodString;
    max_result_size: z.ZodOptional<z.ZodNumber>;
    save_to_file: z.ZodOptional<z.ZodBoolean>;
    output_dir: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
/** Inferred TypeScript type from JqQuerySchema */
type JqQueryInput = z.infer<typeof JqQuerySchema>;

/**
 * Configuration options for McpCurlServer.
 * These settings affect how all tool calls are processed.
 */
interface McpCurlConfig {
    /** Base URL prepended to relative URLs in curl_execute */
    baseUrl?: string;
    /** Default headers added to all curl_execute requests */
    defaultHeaders?: Record<string, string>;
    /** Default timeout in seconds (1-300) for curl_execute */
    defaultTimeout?: number;
    /** Default output directory for saved responses */
    outputDir?: string;
    /** Default max result size in bytes before auto-saving to file */
    maxResultSize?: number;
    /** Allow localhost requests (overrides MCP_CURL_ALLOW_LOCALHOST env) */
    allowLocalhost?: boolean;
    /** HTTP transport port (default: 3000) */
    port?: number;
    /** HTTP transport bind address (default: "127.0.0.1") */
    host?: string;
    /** HTTP auth token (overrides MCP_AUTH_TOKEN env) */
    authToken?: string;
    /** Allowed origins for HTTP transport Origin header validation (default: localhost) */
    allowedOrigins?: readonly string[];
    /** Default User-Agent for all requests. Empty string disables. */
    defaultUserAgent?: string;
    /** Default Referer for all requests. Empty string disables. */
    defaultReferer?: string;
    /**
     * Wrap responses in per-request sentinel tags to resist prompt injection (spotlighting).
     * Note: does not apply to tools registered via `generateToolDefinitions()` — those tools
     * return filtered JSON directly without passing through the spotlighting wrapper.
     */
    enableSpotlighting?: boolean;
}
/**
 * Context provided to hooks during tool execution.
 * Contains tool name, parameters, session info, and current config.
 */
interface HookContext<T = CurlExecuteInput | JqQueryInput> {
    /** Which tool is being executed */
    readonly tool: "curl_execute" | "jq_query";
    /** Tool parameters (may be modified by beforeRequest hooks) */
    params: T;
    /** Session ID for HTTP transport, undefined for stdio */
    readonly sessionId?: string;
    /** Current frozen configuration */
    readonly config: Readonly<McpCurlConfig>;
}
/**
 * Result type for beforeRequest hooks.
 * - void: continue with current params
 * - { params }: merge these params into current params
 * - { shortCircuit: true, response }: skip execution, return response immediately
 */
type BeforeRequestResult<T> = void | {
    params?: Partial<T>;
} | {
    shortCircuit: true;
    response: string;
    isError?: boolean;
};
/**
 * Hook called before tool execution.
 * Can modify params or short-circuit to return early.
 */
type BeforeRequestHook<T = CurlExecuteInput | JqQueryInput> = (ctx: HookContext<T>) => BeforeRequestResult<T> | Promise<BeforeRequestResult<T>>;
/**
 * Hook called after successful tool execution.
 * Receives the response for logging, metrics, caching, etc.
 */
type AfterResponseHook<T = CurlExecuteInput | JqQueryInput> = (ctx: HookContext<T> & {
    response: string;
    isError: boolean;
}) => void | Promise<void>;
/**
 * Hook called when tool execution throws an error.
 * Receives the error for logging or handling.
 */
type OnErrorHook<T = CurlExecuteInput | JqQueryInput> = (ctx: HookContext<T> & {
    error: Error;
}) => void | Promise<void>;
/**
 * Transport mode for the MCP server.
 * - stdio: Standard input/output (default, for CLI usage)
 * - http: HTTP/SSE transport (for web clients)
 */
type TransportMode = "stdio" | "http";

/** Tool result type returned by executeJqQuery */
interface JqQueryResult {
    [key: string]: unknown;
    content: [{
        type: "text";
        text: string;
    }];
    isError?: boolean;
}

/**
 * Partial curl_execute input with optional path for baseUrl resolution.
 */
interface ExecuteRequestParams extends Partial<CurlExecuteInput> {
    /** Path to append to baseUrl (alternative to url) */
    path?: string;
}
/**
 * Instance utilities interface returned by McpCurlServer.utilities().
 */
interface InstanceUtilities {
    /**
     * Execute a cURL request with config defaults applied.
     * Can use `path` with `baseUrl` or provide a full `url`.
     *
     * NOTE: This method calls executeCurlRequest directly and bypasses the hook
     * system (beforeRequest, afterResponse, onError). Use MCP tool invocation
     * if you need hooks to execute.
     */
    executeRequest(params: ExecuteRequestParams): Promise<CurlExecuteResult>;
    /**
     * Query a JSON file with config defaults applied.
     *
     * NOTE: This method calls executeJqQuery directly and bypasses the hook
     * system. Use MCP tool invocation if you need hooks to execute.
     */
    queryFile(filepath: string, jqFilter: string): Promise<JqQueryResult>;
}

/**
 * Metadata for a custom tool registration.
 */
interface CustomToolMeta {
    /** Human-readable title */
    title: string;
    /** Description for LLM context */
    description: string;
    /** Zod schema for input validation */
    inputSchema: z.ZodObject<z.ZodRawShape>;
    /** Optional MCP tool annotations */
    annotations?: {
        readOnlyHint?: boolean;
        destructiveHint?: boolean;
        idempotentHint?: boolean;
        openWorldHint?: boolean;
    };
}
declare class McpCurlServer {
    private _config;
    private _frozenConfig;
    private _hooks;
    private _tools;
    private _customTools;
    private _started;
    private _server;
    private _httpServer;
    private _sessionManager;
    private _rateLimitInterval;
    private _injectionCleanupInterval;
    private _utilities;
    /**
     * Configure server options.
     * Must be called before start().
     *
     * @param config - Configuration options to merge
     * @returns this for chaining
     * @throws Error if called after start()
     */
    configure(config: Partial<McpCurlConfig>): this;
    /**
     * Disable the curl_execute tool.
     * When disabled, calls to curl_execute return an error.
     *
     * @returns this for chaining
     * @throws Error if called after start()
     */
    disableCurlExecute(): this;
    /**
     * Disable the jq_query tool.
     * When disabled, calls to jq_query return an error.
     *
     * @returns this for chaining
     * @throws Error if called after start()
     */
    disableJqQuery(): this;
    /**
     * Register a beforeRequest hook.
     * Hooks run sequentially in registration order before tool execution.
     * Can modify params or short-circuit to return early.
     *
     * @param hook - Hook function
     * @returns this for chaining
     * @throws Error if called after start()
     */
    beforeRequest(hook: BeforeRequestHook): this;
    /**
     * Register an afterResponse hook.
     * Hooks run sequentially after successful tool execution.
     * Useful for logging, metrics, caching.
     *
     * @param hook - Hook function
     * @returns this for chaining
     * @throws Error if called after start()
     */
    afterResponse(hook: AfterResponseHook): this;
    /**
     * Register an onError hook.
     * Hooks run sequentially when tool execution throws.
     * Useful for error logging and reporting.
     *
     * @param hook - Hook function
     * @returns this for chaining
     * @throws Error if called after start()
     */
    onError(hook: OnErrorHook): this;
    /**
     * Register a custom tool.
     * Custom tools are registered on the MCP server during start().
     * Use this to add API-specific tools generated from schema definitions.
     *
     * Note: Custom tools are NOT wrapped with beforeRequest/afterResponse/onError hooks.
     * They are registered directly on the MCP server. If you need hook-like behavior,
     * implement it within the handler function itself.
     *
     * @param name - Tool name (must match /^[a-z][a-z0-9_]*$/)
     * @param meta - Tool metadata (title, description, inputSchema). title and description
     *   are sanitized automatically. inputSchema field descriptions (.describe() strings)
     *   are NOT sanitized — callers must sanitize any field descriptions sourced from
     *   external input using sanitizeDescription() before registering.
     * @param handler - Tool handler function
     * @returns this for chaining
     * @throws Error if called after start()
     * @throws Error if tool name conflicts with built-in tools
     * @throws Error if tool name format is invalid
     *
     * @example
     * ```typescript
     * server.registerCustomTool(
     *   "get_user",
     *   {
     *     title: "Get User",
     *     description: "Fetch user by ID",
     *     inputSchema: z.object({ id: z.string() }),
     *   },
     *   async (params) => {
     *     // Handle request
     *     return { content: [{ type: "text", text: "..." }] };
     *   }
     * );
     * ```
     */
    registerCustomTool(name: string, meta: CustomToolMeta, handler: ToolCallback<z.ZodObject<z.ZodRawShape>>): this;
    /**
     * Get the current (frozen after start) configuration.
     * Returns a deep-frozen snapshot to prevent mutation of nested objects.
     *
     * @returns Readonly configuration object
     */
    getConfig(): Readonly<McpCurlConfig>;
    /**
     * Get config-aware utility methods for direct tool execution.
     * Utilities apply configuration defaults automatically.
     *
     * @returns Instance utilities object
     */
    utilities(): InstanceUtilities;
    /**
     * Get the underlying MCP server instance.
     * Returns null if not yet started.
     *
     * @returns MCP server or null
     */
    getMcpServer(): McpServer | null;
    /**
     * Check if the server has been started.
     *
     * @returns true if started
     */
    isStarted(): boolean;
    /**
     * Start the server with the specified transport.
     * Configuration is frozen after this call.
     *
     * @param transport - Transport mode: "stdio" (default) or "http"
     * @throws Error if already started
     */
    start(transport?: TransportMode): Promise<void>;
    /**
     * Gracefully shutdown the server.
     * Closes all connections and cleans up resources.
     * Safe to call even if server was never started.
     */
    shutdown(): Promise<void>;
    /**
     * Create a fully configured MCP server instance.
     * Registers resources, prompts, and tools with hooks applied.
     * Used by both main server initialization and HTTP session creation.
     *
     * @returns Configured McpServer instance
     */
    private createConfiguredServer;
    /**
     * Register tools with hooks applied on a given server.
     *
     * @param server - MCP server to register tools on
     */
    private registerToolsOnServer;
    /**
     * Start stdio transport.
     */
    private startStdio;
    /**
     * Start HTTP transport with session management.
     * Delegates to shared createHttpApp() for route setup, auth, and Origin validation.
     */
    private startHttp;
    /**
     * Deep-freeze the current config to prevent mutation of nested objects.
     */
    private freezeConfig;
    /**
     * Ensure server has not been started.
     * @throws Error if started
     */
    private ensureNotStarted;
}

export { type CustomToolMeta, McpCurlServer, McpCurlServer as PageSpeedServer };

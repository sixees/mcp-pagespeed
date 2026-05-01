import { A as ApiSchema } from '../../generator-kKl-WuXG.js';
export { a as ApiDefaults, b as ApiInfo, c as ApiSchemaLoadError, d as ApiSchemaVersion, e as AuthConfig, f as AuthenticationError, E as EndpointDefinition, g as EndpointParameter, G as GeneratorConfig, H as HttpMethod, P as ParameterLocation, h as ParameterType, R as ResponseConfig, i as buildUrl, j as generateInputSchema, k as generateToolDefinitions, l as getAuthConfig, m as getMethodAnnotations, n as loadApiSchema, o as loadApiSchemaFromString, r as registerEndpointTools } from '../../generator-kKl-WuXG.js';
import { ZodIssue, z } from 'zod';
import '@modelcontextprotocol/sdk/server/mcp.js';

/**
 * Complete API schema validator.
 */
declare const ApiSchemaValidator: z.ZodObject<{
    apiVersion: z.ZodLiteral<"1.0">;
    api: z.ZodObject<{
        name: z.ZodString;
        title: z.ZodString;
        description: z.ZodString;
        version: z.ZodString;
        baseUrl: z.ZodURL;
    }, z.core.$strip>;
    auth: z.ZodOptional<z.ZodObject<{
        apiKey: z.ZodOptional<z.ZodObject<{
            type: z.ZodEnum<{
                query: "query";
                header: "header";
            }>;
            name: z.ZodString;
            envVar: z.ZodString;
            required: z.ZodDefault<z.ZodBoolean>;
        }, z.core.$strip>>;
        bearer: z.ZodOptional<z.ZodObject<{
            envVar: z.ZodString;
            required: z.ZodDefault<z.ZodBoolean>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    defaults: z.ZodOptional<z.ZodObject<{
        timeout: z.ZodOptional<z.ZodNumber>;
        headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, z.core.$strip>>;
    endpoints: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        path: z.ZodString;
        method: z.ZodEnum<{
            GET: "GET";
            POST: "POST";
            PUT: "PUT";
            PATCH: "PATCH";
            DELETE: "DELETE";
            HEAD: "HEAD";
            OPTIONS: "OPTIONS";
        }>;
        title: z.ZodString;
        description: z.ZodString;
        parameters: z.ZodOptional<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            in: z.ZodEnum<{
                path: "path";
                body: "body";
                query: "query";
                header: "header";
            }>;
            type: z.ZodEnum<{
                string: "string";
                number: "number";
                boolean: "boolean";
                integer: "integer";
            }>;
            required: z.ZodDefault<z.ZodBoolean>;
            description: z.ZodOptional<z.ZodString>;
            default: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean]>>;
            enum: z.ZodOptional<z.ZodArray<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>>;
        }, z.core.$strip>>>;
        response: z.ZodOptional<z.ZodObject<{
            jqFilter: z.ZodOptional<z.ZodString>;
            filterPresets: z.ZodOptional<z.ZodArray<z.ZodObject<{
                name: z.ZodString;
                jqFilter: z.ZodString;
                description: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
/**
 * Validation error with detailed information.
 */
declare class ApiSchemaValidationError extends Error {
    readonly issues: ZodIssue[];
    constructor(message: string, issues: ZodIssue[]);
}
/**
 * Validate parsed YAML against the API schema.
 * Returns a typed ApiSchema on success, throws on validation failure.
 *
 * @param data - Parsed YAML data (unknown type)
 * @returns Validated ApiSchema
 * @throws ApiSchemaValidationError if validation fails
 */
declare function validateApiSchema(data: unknown): ApiSchema;

export { ApiSchema, ApiSchemaValidationError, ApiSchemaValidator, validateApiSchema };

#!/usr/bin/env node
// PageSpeed Insights MCP Server
// Fork-specific configuration for Google PageSpeed Insights API v5
//
// Usage:
//   npx tsx configs/pagespeed.ts
//
// Environment:
//   PAGESPEED_API_KEY — Optional Google API key (higher rate limits)

import { fileURLToPath } from "url";
import { dirname, join } from "path";
import {
  McpCurlServer,
  loadApiSchema,
  generateInputSchema,
  getAuthConfig,
  type ApiSchema,
} from "mcp-curl";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CATEGORIES = ["PERFORMANCE", "ACCESSIBILITY", "BEST_PRACTICES", "SEO"];

// Preset extraction logic — TypeScript post-processing because the built-in
// jq engine can't do object construction ({ key: .value }) or arithmetic (* 100)

function extractScores(lighthouse: Record<string, any>) {
  const cats = lighthouse.categories ?? {};
  const toScore = (v: number | null | undefined) =>
    Math.round((v ?? 0) * 100);
  return {
    performance: toScore(cats.performance?.score),
    accessibility: toScore(cats.accessibility?.score),
    best_practices: toScore(cats["best-practices"]?.score),
    seo: toScore(cats.seo?.score),
  };
}

function extractMetrics(lighthouse: Record<string, any>) {
  const audits = lighthouse.audits ?? {};
  const get = (id: string) => ({
    value: audits[id]?.numericValue ?? null,
    display: audits[id]?.displayValue ?? "N/A",
  });
  return {
    lcp: get("largest-contentful-paint"),
    fcp: get("first-contentful-paint"),
    cls: get("cumulative-layout-shift"),
    tbt: get("total-blocking-time"),
    tti: get("interactive"),
  };
}

// PageSpeed echoes the requested URL back as `data.id`. That field is
// attacker-influenced (it round-trips into the LLM context). Sanitization
// strips Unicode attack vectors, but ASCII keyword payloads in the URL
// itself (e.g. `?q=ignore+previous+instructions`) round-trip intact.
// Compare normalized forms; if they don't match the trusted input, fall
// back to the input URL and emit a throttle-able warning to stderr.
function trustedAnalyzedUrl(echoed: unknown, inputUrl: string): string {
  if (typeof echoed === "string") {
    try {
      const a = new URL(echoed);
      const b = new URL(inputUrl);
      if (
        a.origin === b.origin &&
        a.pathname === b.pathname &&
        a.search === b.search
      ) {
        return inputUrl;
      }
    } catch {
      // fall through to mismatch path
    }
  }
  console.error(
    `pagespeed: analyzed_url mismatch (API echoed differs from input); using input URL`,
  );
  return inputUrl;
}

// Single home for every API-echoed field that round-trips into LLM context.
// Adding a new echoed field? Validate it here, not at the call site.
function buildTrustedMeta(
  data: Record<string, any>,
  lighthouse: Record<string, any>,
  inputUrl: string,
) {
  return {
    analyzed_url: trustedAnalyzedUrl(data.id, inputUrl),
    // Round-trip from input; not yet validated (see docs/todos/009).
    strategy: lighthouse.configSettings?.formFactor,
  };
}

// Pure dispatch. No security logic — that lives in buildTrustedMeta.
function pickPreset(
  preset: string,
  scores: ReturnType<typeof extractScores>,
  metrics: ReturnType<typeof extractMetrics>,
  meta: ReturnType<typeof buildTrustedMeta>,
) {
  if (preset === "scores") return scores;
  if (preset === "metrics") return metrics;
  return { scores, metrics, ...meta };
}

try {
  // Load YAML schema for config values and input schema generation
  const schemaPath = join(__dirname, "pagespeed.yaml");
  const schema: ApiSchema = await loadApiSchema(schemaPath);
  const endpoint = schema.endpoints[0];

  // Generate Zod input schema from YAML endpoint definition
  // (includes url, strategy, and filter_preset enum from filterPresets)
  const inputSchema = generateInputSchema(endpoint);

  // Create and configure server from schema
  const server = new McpCurlServer()
    .configure({
      baseUrl: schema.api.baseUrl,
      defaultTimeout: schema.defaults?.timeout,
      defaultHeaders: schema.defaults?.headers,
      maxResultSize: 2_000_000,
    })
    .disableCurlExecute(); // replaced by custom tool; jq_query stays enabled

  const utils = server.utilities();

  // Build description with filter_preset documentation (buildToolDescription
  // does this for YAML-generated tools, but we bypass that with a custom handler)
  const description = [
    endpoint.description,
    "",
    "Available filter_preset values:",
    "  - scores: category scores as 0-100 integers (performance, accessibility, best_practices, seo)",
    "  - metrics: Core Web Vitals as value/display pairs (lcp, fcp, cls, tbt, tti)",
    "  - summary (default): both scores and metrics plus analyzed_url and strategy",
  ].join("\n");

  // Register custom tool with YAML-derived metadata + custom handler
  server.registerCustomTool(
    endpoint.id,
    {
      title: endpoint.title,
      description,
      inputSchema,
      annotations: {
        readOnlyHint: true,
        openWorldHint: true,
      },
    },
    async (args, _extra) => {
      const { url, strategy, filter_preset } = args as {
        url: string;
        strategy?: string;
        filter_preset?: string;
      };

      // Validate URL locally before making a 15-45s API call
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          return {
            content: [
              {
                type: "text" as const,
                text: "Error: Only http and https URLs are supported.",
              },
            ],
            isError: true,
          };
        }
      } catch {
        return {
          content: [
            { type: "text" as const, text: "Error: Invalid URL provided." },
          ],
          isError: true,
        };
      }

      // Build API URL with all 4 categories (YAML schema can't repeat params)
      const apiUrl = new URL(`${schema.api.baseUrl}${endpoint.path}`);
      apiUrl.searchParams.set("url", url);
      apiUrl.searchParams.set("strategy", strategy ?? "MOBILE");
      for (const cat of CATEGORIES) {
        apiUrl.searchParams.append("category", cat);
      }

      // API key is sent as ?key=... per Google's documented method.
      // The key will be visible in proxy/access logs — use a restricted key.
      const { queryParams } = getAuthConfig(schema.auth);
      for (const [key, value] of Object.entries(queryParams)) {
        apiUrl.searchParams.set(key, value);
      }

      // Execute request via utilities (applies config defaults, SSRF checks)
      // maxResultSize=2MB configured on server; response returned inline for parsing
      const result = await utils.executeRequest({
        url: apiUrl.toString(),
        method: "GET",
        timeout: schema.defaults?.timeout ?? 60,
      });

      if (result.isError) {
        return result;
      }

      // Extract inline response text (maxResultSize=2MB keeps it inline)
      const resultText = result.content
        .filter((c): c is { type: "text"; text: string } => c.type === "text")
        .map((c) => c.text)
        .join("\n");

      // Parse JSON response. Fail closed: a non-JSON body (truncation,
      // auto-save-to-file path, malformed proxy response) means
      // trustedAnalyzedUrl() can't run, and the fork's trust model says
      // unvalidated content must not reach the LLM. Generic message keeps
      // 2.0.1's minimal-logging policy.
      let data: Record<string, any>;
      try {
        data = JSON.parse(resultText);
      } catch {
        console.error(
          "pagespeed: non-JSON response; rejecting (trust validation cannot run)",
        );
        return {
          content: [
            {
              type: "text" as const,
              text: "Error: PageSpeed API returned a non-JSON response.",
            },
          ],
          isError: true,
        };
      }

      // Surface API-level errors (rate limits, auth failures, etc.) clearly
      if (data.error) {
        const code = data.error.code ?? 0;
        const message = data.error.message ?? "Unknown API error";
        const isRateLimit =
          data.error.status === "RESOURCE_EXHAUSTED" ||
          (data.error.errors ?? []).some(
            (e: Record<string, string>) => e.reason === "rateLimitExceeded",
          );
        const hint = isRateLimit
          ? " Set PAGESPEED_API_KEY to use a higher quota."
          : "";
        console.error(`pagespeed: API error ${code}: ${message}`);
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: PageSpeed API returned ${code}: ${message}${hint}`,
            },
          ],
          isError: true,
        };
      }

      const lighthouse = data.lighthouseResult;
      if (!lighthouse) {
        console.error("pagespeed: no lighthouseResult in API response");
        return {
          content: [
            {
              type: "text" as const,
              text: "Error: PageSpeed API did not return lighthouse results. The URL may be unreachable or the API may be experiencing issues.",
            },
          ],
          isError: true,
        };
      }

      const preset = filter_preset ?? "summary";
      const scores = extractScores(lighthouse);
      const metrics = extractMetrics(lighthouse);
      const meta = buildTrustedMeta(data, lighthouse, url);
      const output = pickPreset(preset, scores, metrics, meta);

      return {
        content: [
          { type: "text" as const, text: JSON.stringify(output, null, 2) },
        ],
      };
    },
  );

  await server.start("stdio");

  // Wire signal handlers so startInjectionCleanup()'s setInterval is cleared
  // on container/orchestrator shutdown. Without this, the process hangs on
  // SIGTERM until SIGKILL because the timer keeps the event loop alive.
  // Re-entrancy guard prevents double-shutdown when an orchestrator sends
  // SIGTERM twice; try/catch surfaces shutdown failures via exit code 1
  // instead of an unhandled rejection.
  let shuttingDown = false;
  const shutdown = async (signal: NodeJS.Signals) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.error(`[pagespeed] received ${signal}, shutting down`);
    try {
      await server.shutdown();
      process.exit(0);
    } catch (err) {
      console.error(
        `[pagespeed] shutdown failed: ${(err as Error).name ?? "Error"}`,
      );
      process.exit(1);
    }
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
} catch (error) {
  console.error("Failed to start PageSpeed MCP server:", error);
  process.exitCode = 1;
}

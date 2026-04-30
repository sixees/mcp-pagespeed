// PageSpeed handler helpers — extracted from pagespeed.ts so they can be
// imported by tests without booting the server (which happens at top level
// in pagespeed.ts). All round-trip-validation logic lives here; pagespeed.ts
// is the boot script.

export const CATEGORIES = [
  "PERFORMANCE",
  "ACCESSIBILITY",
  "BEST_PRACTICES",
  "SEO",
];

// 2 MB cap before the underlying library auto-saves the response to disk
// instead of returning it inline. Lighthouse JSON for a typical page lands
// around 200-600 KB; 2 MB gives headroom for sites with many third-party
// scripts without normalising responses through the file path.
export const MAX_RESULT_SIZE_BYTES = 2_000_000;

// 60s fallback used only if the YAML schema doesn't define `defaults.timeout`.
// PageSpeed analyses themselves take 15-45s; this is the outer cURL timeout.
export const DEFAULT_TIMEOUT_SECONDS = 60;

// Class-of-error string for the tool response. The 429 string preserves the
// exact "Set PAGESPEED_API_KEY to use a higher quota." suffix that scripts/
// smoke.ts greps for to classify quota-exhausted runs.
export function classifyApiError(
  code: number,
  status: string | undefined,
  errors: ReadonlyArray<{ reason?: string }> | undefined,
): string {
  const isRateLimit =
    status === "RESOURCE_EXHAUSTED" ||
    (errors ?? []).some((e) => e.reason === "rateLimitExceeded");
  if (isRateLimit) {
    return "PageSpeed API rate-limited. Set PAGESPEED_API_KEY to use a higher quota.";
  }
  if (code === 400) return "PageSpeed API rejected the request (likely invalid URL).";
  if (code === 401 || code === 403) return "PageSpeed API authentication failed.";
  if (code === 404) return "PageSpeed API endpoint not found.";
  return `PageSpeed API returned an error (HTTP ${code}).`;
}

export function extractScores(lighthouse: Record<string, any>) {
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

export function extractMetrics(lighthouse: Record<string, any>) {
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

// Sort search params by key+value so a reordered query string compares equal.
// Encoding is normalised by URLSearchParams iteration (keys/values already decoded).
function canonicalSearch(u: URL): string {
  const entries = [...u.searchParams.entries()];
  entries.sort(([ak, av], [bk, bv]) => {
    if (ak !== bk) return ak < bk ? -1 : 1;
    return av < bv ? -1 : av > bv ? 1 : 0;
  });
  return entries
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
}

// PageSpeed echoes the requested URL back as `data.id`. That field is
// attacker-influenced (it round-trips into the LLM context). Sanitization
// strips Unicode attack vectors, but ASCII keyword payloads in the URL
// itself (e.g. `?q=ignore+previous+instructions`) round-trip intact.
// Compare normalised forms; if they don't match the trusted input, fall
// back to the input URL, push a structured note for the LLM, and emit a
// throttle-able warning to stderr. The note never includes the echoed
// content (preserves the privacy posture of the detection logger).
export function trustedAnalyzedUrl(
  echoed: unknown,
  inputUrl: string,
  warnings: string[],
): string {
  if (typeof echoed === "string") {
    try {
      const a = new URL(echoed);
      const b = new URL(inputUrl);
      if (
        a.origin === b.origin &&
        a.pathname === b.pathname &&
        canonicalSearch(a) === canonicalSearch(b)
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
  warnings.push(
    "analyzed_url substituted with the URL you submitted; the API echoed a different value (echo content withheld).",
  );
  return inputUrl;
}

// Single home for every API-echoed field that round-trips into LLM context.
// `strategy` is sourced from the trusted input rather than the API echo
// because formFactor is a controlled vocabulary already in scope at the
// caller — there's no reason to trust the round-trip when we have the
// authoritative value locally.
export function buildTrustedMeta(
  data: Record<string, any>,
  inputUrl: string,
  inputStrategy: string | undefined,
  warnings: string[],
) {
  return {
    analyzed_url: trustedAnalyzedUrl(data.id, inputUrl, warnings),
    strategy: (inputStrategy ?? "MOBILE").toUpperCase(),
  };
}

// Pure dispatch. Surfaces warnings on every preset (an analyzed_url
// substitution is meaningful even when the LLM picked filter_preset=scores
// and won't see analyzed_url itself).
export function pickPreset(
  preset: string,
  scores: ReturnType<typeof extractScores>,
  metrics: ReturnType<typeof extractMetrics>,
  meta: ReturnType<typeof buildTrustedMeta>,
  warnings: string[],
) {
  const withWarnings = warnings.length ? { warnings } : {};
  if (preset === "scores") return { ...scores, ...withWarnings };
  if (preset === "metrics") return { ...metrics, ...withWarnings };
  return { scores, metrics, ...meta, ...withWarnings };
}

// Unit tests for the fork-side handler helpers. These cover the trust
// boundary (trustedAnalyzedUrl + buildTrustedMeta), the data extractors
// (extractScores/extractMetrics), the API error classifier, and preset
// dispatch. Helpers live in a separate module from configs/pagespeed.ts
// so importing them here doesn't boot the MCP server.

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  buildTrustedMeta,
  classifyApiError,
  extractMetrics,
  extractScores,
  pickPreset,
  trustedAnalyzedUrl,
} from "./pagespeed-helpers.js";

beforeEach(() => {
  // Silence the throttle-warning so test output stays clean. Each test
  // that asserts on warnings inspects the array argument directly.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("trustedAnalyzedUrl", () => {
  const input = "https://example.com/page?utm_source=foo&utm_medium=bar";

  it("returns inputUrl when echo matches exactly", () => {
    const warnings: string[] = [];
    const result = trustedAnalyzedUrl(input, input, warnings);
    expect(result).toBe(input);
    expect(warnings).toEqual([]);
  });

  it("returns inputUrl when echo has reordered query params", () => {
    const echoed =
      "https://example.com/page?utm_medium=bar&utm_source=foo";
    const warnings: string[] = [];
    const result = trustedAnalyzedUrl(echoed, input, warnings);
    expect(result).toBe(input);
    expect(warnings).toEqual([]);
  });

  it("returns inputUrl when echo has trailing-slash variance", () => {
    // URL parser already normalises https://example.com → https://example.com/
    // so input "https://example.com" and echo "https://example.com/" both
    // become pathname "/".
    const warnings: string[] = [];
    const result = trustedAnalyzedUrl(
      "https://example.com/",
      "https://example.com",
      warnings,
    );
    expect(result).toBe("https://example.com");
    expect(warnings).toEqual([]);
  });

  it("falls back when origin differs", () => {
    const warnings: string[] = [];
    const result = trustedAnalyzedUrl(
      "https://attacker.example.com/page",
      input,
      warnings,
    );
    expect(result).toBe(input);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("substituted");
  });

  it("falls back when pathname differs", () => {
    const warnings: string[] = [];
    const result = trustedAnalyzedUrl(
      "https://example.com/other?utm_source=foo&utm_medium=bar",
      input,
      warnings,
    );
    expect(result).toBe(input);
    expect(warnings).toHaveLength(1);
  });

  it("falls back when search content differs (extra param)", () => {
    const warnings: string[] = [];
    const result = trustedAnalyzedUrl(
      "https://example.com/page?utm_source=foo&utm_medium=bar&injected=1",
      input,
      warnings,
    );
    expect(result).toBe(input);
    expect(warnings).toHaveLength(1);
  });

  it("falls back when echo is not a string", () => {
    for (const echoed of [undefined, null, 42, {}, [], true]) {
      const warnings: string[] = [];
      const result = trustedAnalyzedUrl(echoed, input, warnings);
      expect(result).toBe(input);
      expect(warnings).toHaveLength(1);
    }
  });

  it("falls back when echo is unparseable", () => {
    const warnings: string[] = [];
    const result = trustedAnalyzedUrl("not a url", input, warnings);
    expect(result).toBe(input);
    expect(warnings).toHaveLength(1);
  });

  it("warning never includes the echoed URL content", () => {
    const echoed = "https://attacker.example.com/SECRET-PATH?steal=token";
    const warnings: string[] = [];
    trustedAnalyzedUrl(echoed, input, warnings);
    expect(warnings[0]).not.toContain("attacker");
    expect(warnings[0]).not.toContain("SECRET-PATH");
    expect(warnings[0]).not.toContain("steal");
  });
});

describe("extractScores", () => {
  it("returns integer 0-100 scores from raw 0-1 values", () => {
    const lh = {
      categories: {
        performance: { score: 0.92 },
        accessibility: { score: 0.88 },
        "best-practices": { score: 1.0 },
        seo: { score: 0.5 },
      },
    };
    expect(extractScores(lh)).toEqual({
      performance: 92,
      accessibility: 88,
      best_practices: 100,
      seo: 50,
    });
  });

  it("returns zeros when categories is missing", () => {
    expect(extractScores({})).toEqual({
      performance: 0,
      accessibility: 0,
      best_practices: 0,
      seo: 0,
    });
  });

  it("treats null score as 0 (Lighthouse non-applicable audits)", () => {
    const lh = { categories: { performance: { score: null } } };
    expect(extractScores(lh).performance).toBe(0);
  });
});

describe("extractMetrics", () => {
  it("extracts numericValue and displayValue per metric", () => {
    const lh = {
      audits: {
        "largest-contentful-paint": {
          numericValue: 2500,
          displayValue: "2.5 s",
        },
        "first-contentful-paint": {
          numericValue: 1800,
          displayValue: "1.8 s",
        },
        "cumulative-layout-shift": {
          numericValue: 0.05,
          displayValue: "0.05",
        },
        "total-blocking-time": { numericValue: 100, displayValue: "100 ms" },
        interactive: { numericValue: 3000, displayValue: "3.0 s" },
      },
    };
    expect(extractMetrics(lh)).toEqual({
      lcp: { value: 2500, display: "2.5 s" },
      fcp: { value: 1800, display: "1.8 s" },
      cls: { value: 0.05, display: "0.05" },
      tbt: { value: 100, display: "100 ms" },
      tti: { value: 3000, display: "3.0 s" },
    });
  });

  it("returns null/N-A when audits is missing", () => {
    const result = extractMetrics({});
    expect(result.lcp).toEqual({ value: null, display: "N/A" });
    expect(result.fcp).toEqual({ value: null, display: "N/A" });
  });
});

describe("classifyApiError", () => {
  it("rate limit via RESOURCE_EXHAUSTED preserves QUOTA_HINT suffix", () => {
    const msg = classifyApiError(429, "RESOURCE_EXHAUSTED", undefined);
    // smoke.ts greps for this exact suffix; do not change without coordinating.
    expect(msg).toContain("Set PAGESPEED_API_KEY to use a higher quota.");
  });

  it("rate limit via errors[].reason=rateLimitExceeded preserves hint", () => {
    const msg = classifyApiError(429, undefined, [
      { reason: "rateLimitExceeded" },
    ]);
    expect(msg).toContain("Set PAGESPEED_API_KEY to use a higher quota.");
  });

  it("400 yields rejected-request class", () => {
    expect(classifyApiError(400, undefined, undefined)).toContain(
      "rejected the request",
    );
  });

  it("401 and 403 yield authentication-failed class", () => {
    expect(classifyApiError(401, undefined, undefined)).toContain(
      "authentication failed",
    );
    expect(classifyApiError(403, undefined, undefined)).toContain(
      "authentication failed",
    );
  });

  it("404 yields endpoint-not-found class", () => {
    expect(classifyApiError(404, undefined, undefined)).toContain(
      "endpoint not found",
    );
  });

  it("unknown code yields generic class with HTTP code only", () => {
    const msg = classifyApiError(500, undefined, undefined);
    expect(msg).toContain("HTTP 500");
    // No leakage of arbitrary message content; classification is closed.
    expect(msg).not.toContain("undefined");
  });

  it("503 (upstream unavailable) yields generic HTTP-503 class", () => {
    // 503 isn't in the explicit table — it must fall through to the
    // generic branch and surface only the HTTP code, not "undefined" or
    // any leaked field. Anchors the closed-classification contract.
    const msg = classifyApiError(503, undefined, undefined);
    expect(msg).toContain("HTTP 503");
    expect(msg).not.toContain("undefined");
  });

  it("rate-limit reason wins over an explicit 400 code", () => {
    // Defensive precedence: if Google sends both a 400-class code AND
    // errors[].reason=rateLimitExceeded, the rate-limit hint must win
    // so smoke.ts can detect quota exhaustion regardless of code.
    const msg = classifyApiError(400, undefined, [
      { reason: "rateLimitExceeded" },
    ]);
    expect(msg).toContain("Set PAGESPEED_API_KEY to use a higher quota.");
    expect(msg).not.toContain("rejected the request");
  });

  it("rate-limit reason wins even with code 0 (no HTTP status)", () => {
    // Edge case: data.error.code is missing/0 but the reason field is
    // present. The classifier should still surface the rate-limit class.
    const msg = classifyApiError(0, undefined, [
      { reason: "rateLimitExceeded" },
    ]);
    expect(msg).toContain("Set PAGESPEED_API_KEY to use a higher quota.");
  });
});

describe("buildTrustedMeta", () => {
  it("sources strategy from input, not API echo", () => {
    const data = { id: "https://example.com/" };
    const warnings: string[] = [];
    const meta = buildTrustedMeta(data, "https://example.com/", "DESKTOP", warnings);
    expect(meta.strategy).toBe("DESKTOP");
  });

  it("uppercases lowercase strategy input", () => {
    const data = { id: "https://example.com/" };
    const warnings: string[] = [];
    const meta = buildTrustedMeta(data, "https://example.com/", "desktop", warnings);
    expect(meta.strategy).toBe("DESKTOP");
  });

  it("defaults strategy to MOBILE when input is undefined", () => {
    const data = { id: "https://example.com/" };
    const warnings: string[] = [];
    const meta = buildTrustedMeta(data, "https://example.com/", undefined, warnings);
    expect(meta.strategy).toBe("MOBILE");
  });

  it("ignores API-echoed strategy disagreement (round-trip not trusted)", () => {
    // Even if the API echoed lighthouse.configSettings.formFactor as
    // something different, buildTrustedMeta no longer reads it. The
    // function signature now takes only the input strategy.
    const data = { id: "https://example.com/" };
    const warnings: string[] = [];
    const meta = buildTrustedMeta(data, "https://example.com/", "MOBILE", warnings);
    expect(meta.strategy).toBe("MOBILE");
  });

  it("delegates analyzed_url to trustedAnalyzedUrl", () => {
    const data = { id: "https://attacker.example.com/" };
    const warnings: string[] = [];
    const meta = buildTrustedMeta(data, "https://example.com/", "MOBILE", warnings);
    expect(meta.analyzed_url).toBe("https://example.com/");
    expect(warnings).toHaveLength(1);
  });

  it("falls back to inputUrl when data.id is missing entirely", () => {
    // PageSpeed normally echoes the requested URL as data.id; if the
    // field is absent (truncated/proxied response), trustedAnalyzedUrl
    // must still substitute the input URL and emit a warning rather
    // than leaving analyzed_url as undefined.
    const data = {};
    const warnings: string[] = [];
    const meta = buildTrustedMeta(
      data,
      "https://example.com/",
      "MOBILE",
      warnings,
    );
    expect(meta.analyzed_url).toBe("https://example.com/");
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("substituted");
  });
});

describe("pickPreset", () => {
  const scores = { performance: 90, accessibility: 80, best_practices: 70, seo: 60 };
  const metrics = {
    lcp: { value: 1, display: "1" },
    fcp: { value: 1, display: "1" },
    cls: { value: 1, display: "1" },
    tbt: { value: 1, display: "1" },
    tti: { value: 1, display: "1" },
  };
  const meta = { analyzed_url: "https://example.com/", strategy: "MOBILE" };

  it("returns scores object for 'scores' preset", () => {
    expect(pickPreset("scores", scores, metrics, meta, [])).toEqual(scores);
  });

  it("returns metrics object for 'metrics' preset", () => {
    expect(pickPreset("metrics", scores, metrics, meta, [])).toEqual(metrics);
  });

  it("returns scores+metrics+meta for 'summary' preset", () => {
    expect(pickPreset("summary", scores, metrics, meta, [])).toEqual({
      scores,
      metrics,
      analyzed_url: "https://example.com/",
      strategy: "MOBILE",
    });
  });

  it("attaches warnings on every preset when present", () => {
    const warnings = ["analyzed_url substituted"];
    expect(pickPreset("scores", scores, metrics, meta, warnings)).toMatchObject(
      { warnings },
    );
    expect(pickPreset("metrics", scores, metrics, meta, warnings)).toMatchObject(
      { warnings },
    );
    expect(pickPreset("summary", scores, metrics, meta, warnings)).toMatchObject(
      { warnings },
    );
  });

  it("omits warnings field when array is empty", () => {
    expect(pickPreset("summary", scores, metrics, meta, [])).not.toHaveProperty(
      "warnings",
    );
  });
});

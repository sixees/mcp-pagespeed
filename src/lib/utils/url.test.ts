import { describe, it, expect } from "vitest";
import { resolveBaseUrl, httpOnlyUrl } from "./url.js";

describe("resolveBaseUrl", () => {
    it("strips trailing slash from base and joins with path", () => {
        expect(resolveBaseUrl("https://api.example.com/", "/users")).toBe(
            "https://api.example.com/users"
        );
    });

    it("handles base without trailing slash", () => {
        expect(resolveBaseUrl("https://api.example.com", "/users")).toBe(
            "https://api.example.com/users"
        );
    });

    it("adds leading slash to path if missing", () => {
        expect(resolveBaseUrl("https://api.example.com", "users")).toBe(
            "https://api.example.com/users"
        );
    });

    it("handles base with trailing slash and path without leading slash", () => {
        expect(resolveBaseUrl("https://api.example.com/", "users")).toBe(
            "https://api.example.com/users"
        );
    });

    it("preserves path with query params", () => {
        expect(resolveBaseUrl("https://api.example.com", "/search?q=test")).toBe(
            "https://api.example.com/search?q=test"
        );
    });

    it("handles nested base paths", () => {
        expect(resolveBaseUrl("https://api.example.com/v2/", "/users")).toBe(
            "https://api.example.com/v2/users"
        );
    });

    it("handles empty path", () => {
        expect(resolveBaseUrl("https://api.example.com", "/")).toBe(
            "https://api.example.com/"
        );
    });
});

describe("httpOnlyUrl", () => {
    const schema = httpOnlyUrl("Test URL");

    // Valid schemes
    it("accepts http:// URLs", () => {
        expect(schema.safeParse("http://example.com").success).toBe(true);
    });

    it("accepts https:// URLs", () => {
        expect(schema.safeParse("https://example.com").success).toBe(true);
    });

    it("accepts https URL with path and query", () => {
        expect(schema.safeParse("https://api.example.com/v1/resource?key=abc").success).toBe(true);
    });

    // Invalid schemes — rejected by .refine() after z.url() accepts them
    it("rejects ftp:// URLs", () => {
        const result = schema.safeParse("ftp://example.com");
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues[0].message).toBe("URL must use http or https scheme");
        }
    });

    it("rejects file:// URLs", () => {
        expect(schema.safeParse("file:///etc/passwd").success).toBe(false);
    });

    it("rejects data: URLs — rejected by z.url() (not a WHATWG URL)", () => {
        // data: is not a valid WHATWG URL so z.url() rejects it before .refine() runs
        expect(schema.safeParse("data:text/html,<h1>test</h1>").success).toBe(false);
    });

    // Invalid URLs — rejected by z.url() before .refine() runs
    it("rejects non-URL strings", () => {
        expect(schema.safeParse("not-a-url").success).toBe(false);
    });

    it("rejects javascript: strings — rejected by z.url() (not a WHATWG URL)", () => {
        // javascript: is not a valid WHATWG URL; z.url() rejects it before .refine() runs
        expect(schema.safeParse("javascript:alert(1)").success).toBe(false);
    });

    it("rejects empty string", () => {
        expect(schema.safeParse("").success).toBe(false);
    });
});

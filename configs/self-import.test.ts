// Self-import smoke test.
//
// `configs/pagespeed.ts` resolves the bare specifiers `"mcp-pagespeed"` and
// `"mcp-pagespeed/schema"` through `package.json#name` + `#exports`. If the
// package is renamed without updating those import strings (or vice versa),
// the rest of the test suite still passes — `pagespeed-helpers.ts` doesn't
// touch the self-import path. The runtime failure would only surface when
// the MCP server actually boots.
//
// This test pins the contract: name === "mcp-pagespeed", and the four
// expected subpaths (".", "./cli", "./lib", "./schema") are present in
// #exports. Cheap insurance against the only realistic rename regression.

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { describe, it, expect } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  readFileSync(resolve(__dirname, "..", "package.json"), "utf8"),
) as {
  name: string;
  exports: Record<string, unknown>;
};

describe("package self-import contract", () => {
  it("package name matches the specifier used by configs/pagespeed.ts", () => {
    expect(pkg.name).toBe("mcp-pagespeed");
  });

  it("exposes the subpaths configs/pagespeed.ts depends on", () => {
    // The entry point imports `"mcp-pagespeed"` (the "." subpath) and
    // `"mcp-pagespeed/schema"`. Keep the other two we own (./cli, ./lib)
    // pinned too so a future trim of #exports is a deliberate decision,
    // not an accident.
    expect(Object.keys(pkg.exports).sort()).toEqual(
      [".", "./cli", "./lib", "./schema"].sort(),
    );
  });
});

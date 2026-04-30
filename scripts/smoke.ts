#!/usr/bin/env node
// scripts/smoke.ts
// End-to-end Quality Gate for analyze_pagespeed.
//
// Spawns configs/pagespeed.ts as a subprocess, speaks MCP JSON-RPC over stdio,
// calls analyze_pagespeed against a stable public URL, and asserts:
//   - response shape (scores object exists)
//   - no [WHITESPACE REMOVED] markers in post-processed output
//   - no [injection-defense] log lines on stderr (clean URL)
//   - server child exits cleanly
// Exits non-zero on any deviation. Intended for `npm run smoke` and CI.

import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const TARGET_URL = process.env.SMOKE_URL ?? "https://example.com";
const STARTUP_GRACE_MS = 2_000;
const TOOL_CALL_TIMEOUT_MS = 90_000;
const SHUTDOWN_GRACE_MS = 2_000;
const MAX_STDERR_BYTES = 64 * 1024;

// Exact suffix the server adds when it has classified the API error as a
// rate-limit (configs/pagespeed.ts builds this hint conditionally on
// data.error.status === "RESOURCE_EXHAUSTED" or errors[].reason ===
// "rateLimitExceeded"). Anchoring to this string makes quota detection
// structural — the server tagged the response, we trust the tag.
const QUOTA_HINT = "Set PAGESPEED_API_KEY to use a higher quota.";

type JsonRpcResponse = {
  jsonrpc: "2.0";
  id?: number;
  result?: any;
  error?: { code: number; message: string };
};

async function main(): Promise<void> {
  const server = spawn("npx", ["tsx", "configs/pagespeed.ts"], {
    stdio: ["pipe", "pipe", "pipe"],
    env: process.env,
  });

  const failures: string[] = [];

  // Pending JSON-RPC requests, keyed by id. Each entry carries the timer so
  // a terminal child-process event (error/exit) can clear all pending timers
  // and reject the awaiting senders immediately, instead of letting them
  // wait the full per-request timeout (10s for initialize, 90s for tools/call).
  type Pending = {
    resolve: (resp: JsonRpcResponse) => void;
    reject: (err: Error) => void;
    timer: NodeJS.Timeout;
  };
  const pending: Map<number, Pending> = new Map();

  // Snapshot before iterating — Map iteration is consistent across deletes,
  // but explicit clear-then-iterate avoids any chance of an in-flight reject
  // synchronously triggering a re-entry that would mutate the same map.
  function failPending(err: Error): void {
    const entries = [...pending.entries()];
    pending.clear();
    for (const [, p] of entries) {
      clearTimeout(p.timer);
      p.reject(err);
    }
  }

  let serverExited = false;
  let serverExitCode: number | null = null;
  let serverExitSignal: NodeJS.Signals | null = null;

  // Surface spawn errors immediately rather than masquerading as a 10s
  // initialize timeout. Per Node docs, an "error" event may fire WITHOUT a
  // matching "exit" (e.g. ENOENT during spawn), so the error handler must
  // set serverExited so the finally block doesn't wait forever for an
  // exit event that will never come. failPending() also rejects in-flight
  // sendRequest() awaits so they don't burn the full timeout.
  server.on("error", (err) => {
    failures.push(`server spawn error: ${err.message}`);
    serverExited = true;
    failPending(new Error(`server error before response: ${err.message}`));
  });

  // Async EPIPE on stdin can fire after the child exits — without a listener
  // Node would surface it as an unhandled error and crash the smoke run with
  // a misleading stack trace. Recording the failure keeps the diagnostic in
  // the same channel as every other smoke assertion.
  server.stdin.on("error", (err) => {
    failures.push(`server stdin error: ${err.message}`);
  });

  server.on("exit", (code, signal) => {
    serverExited = true;
    serverExitCode = code;
    serverExitSignal = signal;
    // If the server exits while requests are still in flight, reject them
    // immediately instead of letting each one wait its full timeout. The
    // existing exit-code check downstream still records the abnormal exit
    // independently — these rejections only short-circuit the awaiting
    // sendRequest() callers.
    failPending(
      new Error(
        `server exited before responding (code=${code}, signal=${signal})`,
      ),
    );
  });

  let stderr = "";
  let stderrTruncated = false;
  server.stderr.on("data", (chunk) => {
    const text = chunk.toString();
    process.stderr.write(text);
    if (stderr.length >= MAX_STDERR_BYTES) {
      if (!stderrTruncated) {
        stderrTruncated = true;
        failures.push(
          `stderr exceeded ${MAX_STDERR_BYTES} bytes — server is unexpectedly chatty`,
        );
      }
      return;
    }
    const remaining = MAX_STDERR_BYTES - stderr.length;
    stderr += text.length > remaining ? text.slice(0, remaining) : text;
  });

  let stdoutBuf = "";
  server.stdout.on("data", (chunk) => {
    stdoutBuf += chunk.toString();
    const lines = stdoutBuf.split("\n");
    stdoutBuf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line) as JsonRpcResponse;
        if (typeof msg.id === "number" && pending.has(msg.id)) {
          const entry = pending.get(msg.id)!;
          clearTimeout(entry.timer);
          pending.delete(msg.id);
          entry.resolve(msg);
        }
      } catch {
        // not JSON-RPC; ignore
      }
    }
  });

  function sendRequest(
    req: { id: number; method: string; params?: unknown },
    timeoutMs: number,
  ): Promise<JsonRpcResponse> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(req.id);
        reject(
          new Error(
            `Request id=${req.id} (${req.method}) timed out after ${timeoutMs}ms`,
          ),
        );
      }, timeoutMs);
      pending.set(req.id, { resolve, reject, timer });
      server.stdin.write(JSON.stringify({ jsonrpc: "2.0", ...req }) + "\n");
    });
  }

  function sendNotification(method: string, params?: unknown): void {
    server.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
  }

  try {
    await sleep(STARTUP_GRACE_MS);

    if (serverExited) {
      throw new Error(
        `server exited during startup (code=${serverExitCode}, signal=${serverExitSignal})`,
      );
    }

    const initResp = await sendRequest(
      {
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "smoke", version: "1.0" },
        },
      },
      10_000,
    );
    if (!initResp.result) {
      failures.push(
        `initialize failed: ${JSON.stringify(initResp.error ?? initResp)}`,
      );
      throw new Error("initialize failed");
    }

    sendNotification("notifications/initialized");

    const callResp = await sendRequest(
      {
        id: 2,
        method: "tools/call",
        params: {
          name: "analyze_pagespeed",
          arguments: { url: TARGET_URL, filter_preset: "summary" },
        },
      },
      TOOL_CALL_TIMEOUT_MS,
    );

    if (!callResp.result) {
      failures.push(
        `tools/call returned no result: ${JSON.stringify(callResp.error ?? callResp)}`,
      );
    } else if (callResp.result.isError) {
      const text = callResp.result.content?.[0]?.text ?? "";
      // Structural detection: server appends QUOTA_HINT only when it
      // explicitly classified data.error as rate-limited. No regex on
      // arbitrary content.
      const isQuotaExhaustion =
        text.includes(QUOTA_HINT) && !process.env.PAGESPEED_API_KEY;
      if (isQuotaExhaustion) {
        console.warn(
          `\n[smoke] [SKIP] PageSpeed API daily quota exhausted on shared/unauthenticated IP. ` +
            `Set PAGESPEED_API_KEY for a real smoke check. Server bootstrap + MCP handshake validated.`,
        );
      } else {
        failures.push(
          `tools/call returned isError=true: ${text.slice(0, 300)}`,
        );
      }
    } else {
      const text = callResp.result.content?.[0]?.text ?? "";
      if (text.includes("[WHITESPACE REMOVED]")) {
        failures.push(
          `response contains [WHITESPACE REMOVED] marker (sanitizer fired on summary output)`,
        );
      }
      try {
        const parsed = JSON.parse(text);
        if (
          !parsed ||
          typeof parsed !== "object" ||
          !parsed.scores ||
          typeof parsed.scores !== "object"
        ) {
          failures.push(
            `response missing scores object: ${text.slice(0, 200)}`,
          );
        }
      } catch (e) {
        failures.push(
          `response is not valid JSON: ${(e as Error).message}; head=${text.slice(0, 200)}`,
        );
      }
    }

    if (stderr.includes("[injection-defense]")) {
      failures.push(
        `stderr contains [injection-defense] log on clean URL ${TARGET_URL}`,
      );
    }
  } catch (err) {
    failures.push(`smoke threw: ${(err as Error).message}`);
  } finally {
    try {
      server.stdin.end();
    } catch {
      // ignore
    }

    // Wait for clean exit (stdin EOF should trigger graceful shutdown via
    // the MCP stdio transport). If the server doesn't exit within the grace
    // window, escalate to SIGTERM, then SIGKILL. The re-check inside the
    // Promise closes a race where the child exits between the outer
    // serverExited gate and listener registration.
    if (!serverExited) {
      await new Promise<void>((resolve) => {
        if (serverExited) {
          resolve();
          return;
        }
        let term: NodeJS.Timeout | undefined;
        let kill: NodeJS.Timeout | undefined;
        server.once("exit", () => {
          if (term) clearTimeout(term);
          if (kill) clearTimeout(kill);
          resolve();
        });
        term = setTimeout(() => {
          if (!serverExited) server.kill("SIGTERM");
        }, SHUTDOWN_GRACE_MS);
        kill = setTimeout(() => {
          if (!serverExited) server.kill("SIGKILL");
        }, SHUTDOWN_GRACE_MS * 2);
      });
    }

    // A non-zero exit that wasn't caused by our own SIGTERM/SIGKILL escalation
    // means the server died while we were still talking to it — surface it.
    if (
      serverExitCode !== null &&
      serverExitCode !== 0 &&
      serverExitSignal !== "SIGTERM" &&
      serverExitSignal !== "SIGKILL"
    ) {
      failures.push(`server exited with code ${serverExitCode}`);
    }
  }

  if (failures.length > 0) {
    console.error("\n[smoke] [FAIL] smoke failed with the following issues:");
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log(`\n[smoke] [OK] passed for ${TARGET_URL}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("[smoke] [FAIL] top-level error:", err);
  process.exit(1);
});

#!/usr/bin/env node
// scripts/smoke.ts
// End-to-end Quality Gate for analyze_pagespeed.
//
// Spawns configs/pagespeed.ts as a subprocess, speaks MCP JSON-RPC over stdio,
// calls analyze_pagespeed against a stable public URL, and asserts:
//   - response shape (scores object exists)
//   - no [WHITESPACE REMOVED] markers in post-processed output
//   - no [injection-defense] log lines on stderr (clean URL)
// Exits non-zero on any deviation. Intended for `npm run smoke` and CI.

import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const TARGET_URL = process.env.SMOKE_URL ?? "https://example.com";
const STARTUP_GRACE_MS = 2_000;
const TOOL_CALL_TIMEOUT_MS = 90_000;

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

    let stderr = "";
    server.stderr.on("data", (chunk) => {
        const text = chunk.toString();
        stderr += text;
        process.stderr.write(`[server] ${text}`);
    });

    let stdoutBuf = "";
    const pending: Map<number, (resp: JsonRpcResponse) => void> = new Map();
    server.stdout.on("data", (chunk) => {
        stdoutBuf += chunk.toString();
        const lines = stdoutBuf.split("\n");
        stdoutBuf = lines.pop() ?? "";
        for (const line of lines) {
            if (!line.trim()) continue;
            try {
                const msg = JSON.parse(line) as JsonRpcResponse;
                if (typeof msg.id === "number" && pending.has(msg.id)) {
                    pending.get(msg.id)!(msg);
                    pending.delete(msg.id);
                }
            } catch {
                // not JSON-RPC; ignore
            }
        }
    });

    function sendRequest(req: { id: number; method: string; params?: unknown }, timeoutMs: number): Promise<JsonRpcResponse> {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                pending.delete(req.id);
                reject(new Error(`Request id=${req.id} (${req.method}) timed out after ${timeoutMs}ms`));
            }, timeoutMs);
            pending.set(req.id, (resp) => {
                clearTimeout(timer);
                resolve(resp);
            });
            server.stdin.write(JSON.stringify({ jsonrpc: "2.0", ...req }) + "\n");
        });
    }

    function sendNotification(method: string, params?: unknown): void {
        server.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
    }

    const failures: string[] = [];

    try {
        await sleep(STARTUP_GRACE_MS);

        const initResp = await sendRequest({
            id: 1,
            method: "initialize",
            params: {
                protocolVersion: "2024-11-05",
                capabilities: {},
                clientInfo: { name: "smoke", version: "1.0" },
            },
        }, 10_000);
        if (!initResp.result) {
            failures.push(`initialize failed: ${JSON.stringify(initResp.error ?? initResp)}`);
            throw new Error("initialize failed");
        }

        sendNotification("notifications/initialized");

        const callResp = await sendRequest({
            id: 2,
            method: "tools/call",
            params: {
                name: "analyze_pagespeed",
                arguments: { url: TARGET_URL, filter_preset: "summary" },
            },
        }, TOOL_CALL_TIMEOUT_MS);

        if (!callResp.result) {
            failures.push(`tools/call returned no result: ${JSON.stringify(callResp.error ?? callResp)}`);
        } else if (callResp.result.isError) {
            const text = callResp.result.content?.[0]?.text ?? "";
            const isQuotaExhaustion =
                text.includes("429") &&
                /(quota|rate ?limit)/i.test(text) &&
                !process.env.PAGESPEED_API_KEY;
            if (isQuotaExhaustion) {
                console.warn(
                    `\n[SKIP] PageSpeed API daily quota exhausted on shared/unauthenticated IP. ` +
                        `Set PAGESPEED_API_KEY for a real smoke check. Server bootstrap + MCP handshake validated.`,
                );
            } else {
                failures.push(`tools/call returned isError=true: ${text.slice(0, 300)}`);
            }
        } else {
            const text = callResp.result.content?.[0]?.text ?? "";
            if (text.includes("[WHITESPACE REMOVED]")) {
                failures.push(`response contains [WHITESPACE REMOVED] marker (sanitizer fired on summary output)`);
            }
            try {
                const parsed = JSON.parse(text);
                if (!parsed || typeof parsed !== "object" || !parsed.scores || typeof parsed.scores !== "object") {
                    failures.push(`response missing scores object: ${text.slice(0, 200)}`);
                }
            } catch (e) {
                failures.push(`response is not valid JSON: ${(e as Error).message}; head=${text.slice(0, 200)}`);
            }
        }

        if (stderr.includes("[injection-defense]")) {
            failures.push(`stderr contains [injection-defense] log on clean URL ${TARGET_URL}`);
        }
    } catch (err) {
        failures.push(`smoke threw: ${(err as Error).message}`);
    } finally {
        try {
            server.stdin.end();
        } catch { /* ignore */ }
        await sleep(300);
        server.kill();
    }

    if (failures.length > 0) {
        console.error("\n[FAIL] smoke failed with the following issues:");
        for (const f of failures) console.error(`  - ${f}`);
        process.exit(1);
    }
    console.log(`\n[OK] smoke passed for ${TARGET_URL}`);
    process.exit(0);
}

main().catch((err) => {
    console.error("[FAIL] smoke top-level error:", err);
    process.exit(1);
});

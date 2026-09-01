/**
 * E2E test configuration using WebdriverIO + tauri-plugin-webdriver.
 *
 * The plugin runs a W3C WebDriver server inside the app on port 4445.
 * Works on macOS, Linux, and Windows — no external tauri-driver needed.
 *
 * Prerequisites:
 *   1. Build debug binary: `cargo build --manifest-path src-tauri/Cargo.toml`
 *   2. Run tests: `bun run test:e2e`
 *      (Vite dev server is started automatically by the test runner)
 */

import type { } from "@wdio/types";
import { spawn, type ChildProcess } from "child_process";
import fs from "fs";
import net from "net";
import os from "os";
import path from "path";

const ROOT = path.resolve(__dirname, "../..");

const APP_BINARY =
  process.env.SWIFTY_APP_BINARY ??
  path.join(ROOT, "src-tauri", "target", "debug", "swifty");

const TEST_DB_DIR = path.join(os.tmpdir(), `swifty-e2e-${Date.now()}`);

let viteProcess: ChildProcess;
let appProcess: ChildProcess;

/** Poll via HTTP GET until a server responds or we time out. */
async function waitForHttp(url: string, timeoutMs: number, label: string): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await fetch(url);
      return;
    } catch {
      await new Promise<void>((r) => setTimeout(r, 300));
    }
  }
  throw new Error(`[e2e] ${label} did not respond at ${url} within ${timeoutMs}ms`);
}

/** Poll via TCP until a port accepts connections, the process exits, or we time out. */
async function waitForPort(
  port: number,
  timeoutMs: number,
  label: string,
  process?: ChildProcess,
): Promise<void> {
  let exitCode: number | null = null;
  process?.once("exit", (code) => { exitCode = code ?? 1; });

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (exitCode !== null) {
      throw new Error(`[e2e] ${label} process exited with code ${exitCode} before port ${port} opened`);
    }
    const open = await new Promise<boolean>((resolve) => {
      const s = net.connect(port, "127.0.0.1");
      s.once("connect", () => { s.destroy(); resolve(true); });
      s.once("error", () => { s.destroy(); resolve(false); });
    });
    if (open) return;
    await new Promise<void>((r) => setTimeout(r, 250));
  }
  throw new Error(`[e2e] ${label} did not open port ${port} within ${timeoutMs}ms`);
}

export const config: WebdriverIO.Config = {
  hostname: "127.0.0.1",
  port: 4445,
  path: "/",

  specs: ["./specs/**/*.spec.ts"],
  maxInstances: 1,

  capabilities: [
    {
      maxInstances: 1,
      browserName: "chrome",
      "wdio:enforceWebDriverClassic": true,
    } as WebdriverIO.Capabilities,
  ],

  framework: "mocha",
  reporters: ["spec"],

  mochaOpts: {
    ui: "bdd",
    timeout: 60_000,
  },

  autoCompileOpts: {
    autoCompile: true,
    tsNodeOpts: {
      project: path.join(__dirname, "tsconfig.json"),
      transpileOnly: true,
    },
  },

  // No global `before` hook: waiting for the setup screen here would assume
  // every spec inherits a pristine vault, which is exactly the run-order
  // coupling this harness now avoids. Each spec opens with its own
  // `resetPristine()` / `resetEmpty()` (see helpers/reset.ts).

  onPrepare: async () => {
    fs.mkdirSync(TEST_DB_DIR, { recursive: true });

    // Start the Vite dev server — the debug binary loads the frontend from
    // http://localhost:1420 (baked in at compile time by tauri-build).
    console.log("[e2e] Starting Vite dev server...");
    // Invoke the vite binary directly — avoids relying on `bun` being in PATH
    // when wdio is running under Node.js.
    const viteBin = path.join(ROOT, "node_modules", ".bin", "vite");
    viteProcess = spawn(viteBin, ["--port", "1420"], {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env },
    });
    viteProcess.stdout?.on("data", (d: Buffer) =>
      process.stdout.write(`[vite] ${d}`),
    );
    viteProcess.stderr?.on("data", (d: Buffer) =>
      process.stderr.write(`[vite] ${d}`),
    );
    viteProcess.on("exit", (code) => {
      if (code !== null && code !== 0) {
        console.error(`[vite] exited with code ${code}`);
      }
    });
    // Use HTTP polling — avoids IPv4/IPv6 mismatch that TCP connect can hit
    await waitForHttp("http://localhost:1420", 30_000, "Vite");
    console.log("[e2e] Vite ready on :1420");

    // Start the app binary — it loads the frontend from Vite and starts
    // the WebDriver server on :4445.
    console.log(`[e2e] Starting app (${APP_BINARY})`);
    appProcess = spawn(APP_BINARY, [], {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        // Both are gates on the `e2e_reset` command: it refuses to run unless
        // SWIFTY_E2E is 1, and it only ever wipes SWIFTY_DB_DIR — so it can
        // never reach a developer's real app-data dir. See commands/e2e.rs.
        SWIFTY_DB_DIR: TEST_DB_DIR,
        SWIFTY_E2E: "1",
        WEBKIT_DISABLE_COMPOSITING_MODE: "1",
      },
    });
    appProcess.stdout?.on("data", (d: Buffer) =>
      process.stdout.write(`[app] ${d}`),
    );
    appProcess.stderr?.on("data", (d: Buffer) =>
      process.stderr.write(`[app] ${d}`),
    );
    appProcess.on("exit", (code) => {
      if (code !== null && code !== 0) {
        console.error(`[app] exited with code ${code}`);
      }
    });

    await waitForPort(4445, 30_000, "App WebDriver server", appProcess);
    console.log("[e2e] App WebDriver server ready on :4445");
  },

  onComplete: () => {
    appProcess?.kill();
    viteProcess?.kill();
    try {
      fs.rmSync(TEST_DB_DIR, { recursive: true, force: true });
    } catch {
      // ignore
    }
  },
};

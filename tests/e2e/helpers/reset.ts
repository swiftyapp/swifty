import { waitFor } from "./app";

/**
 * Per-spec state isolation.
 *
 * The suite runs ONE app process against ONE data dir for the whole run, so
 * without this every spec would inherit the vault the previous spec left
 * behind (and would only pass in one particular file order). Each spec instead
 * opens with an explicit `resetPristine()` / `resetEmpty()`.
 *
 * Both go through `window.__e2eReset`, the dev-only bridge installed by
 * `src/main.tsx`, onto the debug-only `e2e_reset` Tauri command.
 */

type ResetMode = "pristine" | "empty";

// The bridge is installed from a dynamic import, so on a cold boot (and again
// after every refresh) it lands one module fetch behind the first paint. Wait
// for it rather than assuming the app has settled.
async function waitForBridge(): Promise<void> {
  await browser.waitUntil(
    () =>
      browser.execute(
        () =>
          typeof (window as unknown as { __e2eReset?: unknown }).__e2eReset ===
          "function",
      ),
    {
      timeout: 30_000,
      timeoutMsg:
        "window.__e2eReset never appeared — is the app running against the Vite dev server?",
    },
  );
}

// Run the backend reset, then reload the app so it re-reads disk.
//
// The reload is a WebDriver `refresh` rather than a `location.reload()` inside
// the bridge on purpose: navigating away while an injected script is still
// resolving destroys the execution context the driver is waiting on. `refresh`
// waits for the new document instead.
async function reset(mode: ResetMode, password?: string): Promise<void> {
  await waitForBridge();

  const failure = await browser.executeAsync(
    function (
      mode: string,
      password: string | null,
      done: (error: string | null) => void,
    ) {
      const bridge = (
        window as unknown as {
          __e2eReset: (mode: string, password?: string) => Promise<void>;
        }
      ).__e2eReset;
      bridge(mode, password ?? undefined).then(
        () => done(null),
        (error: unknown) => done(String(error)),
      );
    },
    mode,
    password ?? null,
  );

  if (failure) throw new Error(`[e2e] reset("${mode}") failed: ${failure}`);

  await browser.refresh();
}

/** No vault on disk: the app lands on the first-run setup choice screen. */
export async function resetPristine(): Promise<void> {
  await reset("pristine");
  await waitFor("start-setup-button");
}

/** A fresh, entry-less vault keyed to `password`, left locked: lands on unlock. */
export async function resetEmpty(password: string): Promise<void> {
  await reset("empty", password);
  await waitFor("unlock-password-input");
}

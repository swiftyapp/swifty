import { reload, waitFor } from "./app";
import { setSettings, waitForBridge } from "./settings";

/**
 * Per-spec state isolation.
 *
 * The suite runs ONE app process against ONE data dir for the whole run, so
 * without this every spec would inherit the vault the previous spec left
 * behind (and would only pass in one particular file order). Each spec instead
 * opens with an explicit `resetPristine()` / `resetEmpty()`.
 *
 * Both go through `window.__e2eReset`, the dev-only bridge installed by
 * `src/main.tsx`, onto the debug-only `e2e_reset` Tauri command. It wipes the
 * whole data dir, preferences (`settings.json`) included.
 */

type ResetMode = "pristine" | "empty";

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

  // UI preferences live in `settings.json` inside ROWEL_DB_DIR, so the backend
  // reset above already took them with it — nothing a spec (or a human) set in
  // some other run can leak into this one.
  //
  // The locale goes back in explicitly: every spec selects on English labels,
  // and with no stored choice the app follows the OS, which on a non-English
  // machine is not en-US. This states the suite's requirement rather than
  // leaning on a developer's system settings.
  await setSettings({ locale: "en-US" });
  await browser.execute(() => sessionStorage.clear());

  await reload();
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

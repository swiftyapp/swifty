/**
 * The preferences seam.
 *
 * Preferences are Rust's now — `settings.json` in the app data dir, reached
 * through `set_settings` / `app_status` — so a spec can no longer read or pin
 * one by poking localStorage. Both go through `window.__e2eSettings`, the
 * dev-only bridge installed by `src/lib/e2e.ts` next to `__e2eReset`.
 */

// Only the keys the suite touches; the object carries every preference.
export interface Settings {
  autolockSecs: number;
  clipboardTimeoutMs: number;
  dateFormat: string;
  sort: string;
  theme: string;
  locale: string | null;
  breachCheck: boolean;
  generator: { length: number; numbers: boolean; symbols: boolean };
}

type Bridge = { __e2eSettings?: (patch?: Partial<Settings>) => Promise<Settings> };

// The bridge is installed from a dynamic import, so on a cold boot (and again
// after every refresh) it lands one module fetch behind the first paint. Wait
// for it rather than assuming the app has settled.
export async function waitForBridge(): Promise<void> {
  await browser.waitUntil(
    () =>
      browser.execute(
        () =>
          typeof (window as unknown as Bridge).__e2eSettings === "function",
      ),
    {
      timeout: 30_000,
      timeoutMsg:
        "window.__e2eSettings never appeared — is the app running against the Vite dev server?",
    },
  );
}

async function bridge(patch?: Partial<Settings>): Promise<Settings> {
  await waitForBridge();
  const result = await browser.executeAsync(
    function (
      patch: Partial<Settings> | null,
      done: (value: { ok?: Settings; error?: string }) => void,
    ) {
      (window as unknown as Bridge).__e2eSettings!(patch ?? undefined).then(
        (ok: Settings) => done({ ok }),
        (error: unknown) => done({ error: String(error) }),
      );
    },
    patch ?? null,
  );

  if (result.error) throw new Error(`[e2e] settings bridge failed: ${result.error}`);
  return result.ok!;
}

/** Every preference as the backend has it on disk. */
export const readSettings = (): Promise<Settings> => bridge();

/** Write one or more preferences, the way a Settings row does. */
export const setSettings = (patch: Partial<Settings>): Promise<Settings> =>
  bridge(patch);

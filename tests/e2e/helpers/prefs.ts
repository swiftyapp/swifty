/**
 * One user preference, read off the page.
 *
 * Preferences live in a single persisted zustand store (`src/store/prefs.ts`)
 * under one localStorage key, so a spec asserts on the field inside that blob
 * rather than on a key of its own.
 */
export async function pref<T = unknown>(key: string): Promise<T | undefined> {
  return browser.execute((k: string) => {
    const raw = localStorage.getItem("rowel:prefs");
    if (!raw) return undefined;
    const { state } = JSON.parse(raw) as { state: Record<string, unknown> };
    return state[k];
  }, key) as Promise<T | undefined>;
}

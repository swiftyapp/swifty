/** Wait for an element identified by `data-testid` to become displayed. */
export async function waitFor(testid: string, timeout = 15_000): Promise<void> {
  await $(`[data-testid="${testid}"]`).waitForDisplayed({ timeout });
}

/** Wait for the app's main (unlocked) view to appear — the reliable "vault unlocked" landmark. */
export async function waitForAppReady(timeout = 15_000): Promise<void> {
  await waitFor("main-view", timeout);
}

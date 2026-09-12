/** Wait for an element identified by `data-testid` to become displayed. */
export async function waitFor(testid: string, timeout = 15_000): Promise<void> {
  await $(`[data-testid="${testid}"]`).waitForDisplayed({ timeout });
}

/** Wait for the app's main (unlocked) view to appear — the reliable "vault unlocked" landmark. */
export async function waitForAppReady(timeout = 15_000): Promise<void> {
  await waitFor("main-view", timeout);
}

type Tagged = { __e2eOutgoing?: boolean };

/**
 * Reload the page and wait for the NEW document to answer.
 *
 * The in-app WebDriver server's `refresh` returns as soon as the reload is
 * requested, before the navigation commits, so a lookup right after it can
 * still resolve against the outgoing document — and a click there is lost
 * when that document is torn down a few milliseconds later (seen on CI: the
 * setup spec clicked "start setup" on the old page and then waited forever
 * for a form the new page never opened). Tagging the outgoing document and
 * waiting for one without the tag turns the reload into a real barrier.
 */
export async function reload(): Promise<void> {
  await browser.execute(() => {
    (window as unknown as Tagged).__e2eOutgoing = true;
  });
  await browser.refresh();
  await browser.waitUntil(
    async () => {
      try {
        return await browser.execute(
          () => !(window as unknown as Tagged).__e2eOutgoing,
        );
      } catch {
        // Mid-navigation: no document to run in yet.
        return false;
      }
    },
    {
      timeout: 30_000,
      interval: 50,
      timeoutMsg: "[e2e] the page never reloaded into a fresh document",
    },
  );
}

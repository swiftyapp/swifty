/**
 * Keyboard chords.
 *
 * `Main/useShortcuts.ts` accepts either `metaKey` or `ctrlKey`, so the driver
 * sends whichever modifier the platform's webview actually reports: Meta on
 * macOS, Control on the Linux CI runner (where Meta is the window manager's
 * Super key and never reaches the page).
 */

// W3C WebDriver key codes.
const META = "\uE03D";
const CONTROL = "\uE009";
const ENTER = "\uE007";

const MODIFIER = process.platform === "darwin" ? META : CONTROL;

/** Press `modifier + key` — the app's Cmd/Ctrl K, L and G bindings. */
export async function chord(key: string): Promise<void> {
  await browser.keys([MODIFIER, key]);
}

/** Press Enter (submits the lock screen and the generator dialog). */
export async function pressEnter(): Promise<void> {
  await browser.keys(ENTER);
}

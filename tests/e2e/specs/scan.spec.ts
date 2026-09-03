import { resetEmpty, unlock, waitFor } from "../helpers";

// Reading a card or a document off a photo.
//
// What is checked here is the affordance and the platform answer behind it: the
// picker offers to scan exactly when the OS has a text recognizer, which the
// app asks about once per unlock. macOS always has one (Vision), so it is the
// one platform with a certain answer — Linux has none and Windows only has one
// when a language pack is installed, so the spec skips there rather than
// asserting something the machine gets to decide.
//
// Recognition itself is not driven from here. Both ways in are outside the
// webview — an OS drag-and-drop and a native file dialog, neither scriptable
// through WebDriver — and the parsers are already covered over fixed text in
// `src-tauri/src/scan/tests.rs`.

const MASTER_PASSWORD = "Rk4#vQz7mNp2!tLw";

const scanAction = () => $('[data-testid="add-scan-image"]');

async function openPicker(): Promise<void> {
  await waitFor("add-entry-button");
  await $('[data-testid="add-entry-button"]').click();
  await waitFor("add-secret-modal");
}

describe("scanning", () => {
  before(async function () {
    if (process.platform !== "darwin") this.skip();
    await resetEmpty(MASTER_PASSWORD);
    await unlock(MASTER_PASSWORD);
  });

  it("offers to scan a card or document from the picker", async () => {
    await openPicker();

    await scanAction().waitForDisplayed({ timeout: 10_000 });
    await expect(scanAction()).toHaveText(
      expect.stringContaining("Scan a card or document"),
    );

    // The tiles keep the keyboard: the action is not an nth kind.
    await browser.keys("2");
    await waitFor("entry-sheet");
    await expect($('[data-testid="entry-sheet"]')).toBeDisplayed();
    await browser.keys("Escape");
  });
});

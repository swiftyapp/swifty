import { chord, resetEmpty, setRange, unlock, waitFor } from "../helpers";

// The password generator dialog, opened both ways it can be reached: the
// app-level chord (standalone — it copies) and the login editor's "generate"
// link (it fills the field it was opened from).
//
// The dialog and Settings › Security › Generator defaults share one stored
// record (`swifty:generatorDefaults`): the dialog seeds from it and writes
// back, so a change in either place is what the other one opens with.

const MASTER_PASSWORD = "Nc8$jRt5vQz1mHf!";

const output = () => $('[data-testid="generator-output"]');

/** The slider reading — characters in random mode, words in memorable mode. */
async function amount(): Promise<number> {
  return Number(await $('[data-testid="generator-amount"]').getValue());
}

async function openGenerator(): Promise<void> {
  await chord("g");
  await waitFor("generator-dialog");
  // The first value arrives from an async `generate` call.
  await browser.waitUntil(async () => (await output().getText()) !== "", {
    timeout: 10_000,
    timeoutMsg: "the generator never produced a value",
  });
}

/** Wait for the output to become something other than `previous`. */
async function waitForNewValue(previous: string): Promise<string> {
  await browser.waitUntil(
    async () => {
      const next = await output().getText();
      return next !== "" && next !== previous;
    },
    { timeout: 10_000, timeoutMsg: `the generator output stayed at "${previous}"` },
  );
  return output().getText();
}

describe("password generator", () => {
  before(async () => {
    await resetEmpty(MASTER_PASSWORD);
    await unlock(MASTER_PASSWORD);
  });

  it("regenerates, switches shape between the two modes, and copies", async () => {
    await openGenerator();

    // Random mode draws exactly as many characters as the slider asks for.
    const random = await output().getText();
    expect(random).toHaveLength(await amount());

    await $('[data-testid="generator-regenerate"]').click();
    const regenerated = await waitForNewValue(random);
    expect(regenerated).toHaveLength(await amount());

    // Memorable mode is words joined by hyphens (plus a two-digit suffix),
    // which is a shape random mode never produces.
    await $('[data-testid="generator-mode-memorable"]').click();
    const memorable = await waitForNewValue(regenerated);
    const words = memorable.split("-");
    expect(words.length).toBeGreaterThanOrEqual(await amount());
    for (const word of words) expect(word).toMatch(/^[a-z]+$|^\d{2}$/);

    await $('[data-testid="generator-mode-random"]').click();
    const backToRandom = await waitForNewValue(memorable);
    expect(backToRandom).toHaveLength(await amount());

    // Standalone, "Use & copy" has nothing to apply to, so the clipboard toast
    // is the whole feedback (the clipboard itself is not readable from wdio).
    await $('[data-testid="generator-use-button"]').click();
    await waitFor("copy-toast");
    await expect($('[data-testid="generator-dialog"]')).not.toBeDisplayed();
  });

  it("writes the length back to the shared generator defaults", async () => {
    await openGenerator();

    const before = await amount();
    // One step up, driven like a drag: WebKitGTK ignores synthesized arrow keys
    // on a range input, and a click would jump to wherever the pointer landed.
    await setRange("generator-amount", before + 1);
    await browser.waitUntil(async () => (await amount()) === before + 1, {
      timeout: 10_000,
      timeoutMsg: "the slider never moved",
    });

    // Settings reads the very same record, so this is the whole handshake.
    await browser.waitUntil(
      async () =>
        (await browser.execute(
          () =>
            JSON.parse(localStorage.getItem("swifty:generatorDefaults") ?? "{}")
              .length,
        )) === before + 1,
      { timeout: 10_000, timeoutMsg: "the default length was not persisted" },
    );

    await browser.keys(["Escape"]);
    await $('[data-testid="generator-dialog"]').waitForDisplayed({
      reverse: true,
      timeout: 10_000,
    });
  });

  it("fills the login editor's password field when opened from it", async () => {
    // Add asks which kind first; pick Login to get the editor with a password.
    // The editor takes over the detail pane — there is no sheet to dismiss.
    await waitFor("add-entry-button");
    await $('[data-testid="add-entry-button"]').click();
    await waitFor("add-secret-modal");
    await $('[data-testid="add-kind-login"]').click();
    await waitFor("entry-sheet");

    const field = $('input[name="password"]');
    await field.waitForDisplayed({ timeout: 10_000 });
    await expect(field).toHaveValue("");

    // The link on the password row (`src/components/elements/fields/PasswordField.tsx`)
    // — it opens the same dialog with a callback bound to this field.
    await $('[data-testid="entry-sheet"]').$("span*=generate").click();
    await waitFor("generator-dialog");
    await browser.waitUntil(async () => (await output().getText()) !== "", {
      timeout: 10_000,
      timeoutMsg: "the generator never produced a value",
    });
    const generated = await output().getText();

    await $('[data-testid="generator-use-button"]').click();
    await expect($('[data-testid="generator-dialog"]')).not.toBeDisplayed();
    await expect(field).toHaveValue(generated);

    // Leave the vault as the next spec's reset expects: discard the draft
    // (Cancel arms, the second press discards).
    await $('[data-testid="cancel-entry-button"]').click();
    await $('[data-testid="cancel-entry-button"]').click();
    await $('[data-testid="entry-sheet"]').waitForDisplayed({
      reverse: true,
      timeout: 10_000,
    });
  });
});

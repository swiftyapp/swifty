import {
  createLogin,
  entryItems,
  resetEmpty,
  unlock,
  waitFor,
} from "../helpers";

// The login lifecycle: create, edit, abandon an edit, delete.
//
// One vault for the whole file (`before`), then a chain of steps over the same
// entry — the alternative, an unlock per test, would pay a full unoptimised
// Argon2id derive four times over for no extra coverage. The file still opens
// with its own reset, so it does not care what ran before it.

const MASTER_PASSWORD = "Vp2^gLz5nQw8!dEh";

const TITLE = "Vault Console";
const USERNAME = "crud@example.com";
const PASSWORD = "Or1ginal-Passphrase-4!";
const WEBSITE = "https://console.example.com";

const EDITED_TITLE = "Vault Console (renamed)";
const EDITED_PASSWORD = "Rotated-Passphrase-9!";
const DISCARDED_TITLE = "Never Saved Title";

const sheet = () => $('[data-testid="entry-sheet"]');
const field = (name: string) => sheet().$(`input[name="${name}"]`);

/**
 * Open the edit sheet and wait until the decrypted values have landed.
 *
 * `useRevealed` resolves after the sheet mounts and then replaces the whole
 * draft, so anything typed before that arrives is silently overwritten.
 */
async function openEditor(currentPassword: string): Promise<void> {
  await $('[data-testid="edit-entry-button"]').click();
  await waitFor("entry-sheet");
  await browser.waitUntil(
    async () => (await field("password").getValue()) === currentPassword,
    {
      timeout: 15_000,
      timeoutMsg: "the edit sheet never showed the stored password",
    },
  );
}

/** Close a sheet that has no unsaved edits — one press, no discard guard. */
async function closeEditor(): Promise<void> {
  await $('[data-testid="cancel-entry-button"]').click();
  await sheet().waitForDisplayed({ reverse: true, timeout: 15_000 });
}

describe("login entries", () => {
  before(async () => {
    await resetEmpty(MASTER_PASSWORD);
    await unlock(MASTER_PASSWORD);
  });

  it("creates a login and renders its values", async () => {
    await createLogin({
      title: TITLE,
      username: USERNAME,
      password: PASSWORD,
      website: WEBSITE,
    });

    await waitFor("entry-item");
    expect(await entryItems()).toHaveLength(1);
    await expect($('[data-testid="entry-item-title"]')).toHaveText(TITLE);
    await expect($('[data-testid="entry-value-username"]')).toHaveText(USERNAME);
    await expect($('[data-testid="entry-value-password"]')).toHaveText(PASSWORD);
  });

  it("saves an edited title and password", async () => {
    await openEditor(PASSWORD);

    await field("title").setValue(EDITED_TITLE);
    await field("password").setValue(EDITED_PASSWORD);
    await $('[data-testid="save-entry-button"]').click();
    await sheet().waitForDisplayed({ reverse: true, timeout: 15_000 });

    await expect($('[data-testid="entry-item-title"]')).toHaveText(EDITED_TITLE);
    // Untouched fields survive the edit.
    await expect($('[data-testid="entry-value-username"]')).toHaveText(USERNAME);
    expect(await entryItems()).toHaveLength(1);

    // The pane re-decrypts after an in-place save (`useRevealed` keys on
    // updatedAt as well as the id), so the rotated secret shows up right here —
    // this assertion is the regression test for the stale-reveal bug.
    await browser.waitUntil(
      async () =>
        (await $('[data-testid="entry-value-password"]').getText()) ===
        EDITED_PASSWORD,
      {
        timeout: 15_000,
        timeoutMsg: "the detail pane kept the pre-edit password after a save",
      },
    );

    // And the editor agrees on a fresh decrypt.
    await openEditor(EDITED_PASSWORD);
    await expect(field("title")).toHaveValue(EDITED_TITLE);
    await closeEditor();
  });

  it("needs two presses of Cancel to abandon a dirty edit", async () => {
    await openEditor(EDITED_PASSWORD);
    await field("title").setValue(DISCARDED_TITLE);

    const cancel = $('[data-testid="cancel-entry-button"]');

    // First press only arms the guard — there is no discard dialog, the button
    // itself becomes the confirmation.
    await cancel.click();
    await expect(cancel).toHaveText("Discard changes?");
    await expect(sheet()).toBeDisplayed();

    // Second press closes without writing.
    await cancel.click();
    await sheet().waitForDisplayed({ reverse: true, timeout: 15_000 });

    // The row title comes straight off the persisted metadata, so an unchanged
    // one is proof the discarded draft never reached the vault.
    await expect($('[data-testid="entry-item-title"]')).toHaveText(EDITED_TITLE);
    await openEditor(EDITED_PASSWORD);
    await expect(field("title")).toHaveValue(EDITED_TITLE);
    await closeEditor();
  });

  it("needs two presses to delete the entry", async () => {
    await $('[data-testid="more-actions-button"]').click();

    // Same menu row twice: the first press arms it, the second deletes.
    await waitFor("delete-entry-button");
    await $('[data-testid="delete-entry-button"]').click();
    await waitFor("delete-entry-confirm");
    await expect($('[data-testid="delete-entry-confirm"]')).toHaveText(
      "Delete entry?",
    );
    await $('[data-testid="delete-entry-confirm"]').click();

    await $('[data-testid="entry-item"]').waitForExist({
      reverse: true,
      timeout: 15_000,
    });
    expect(await entryItems()).toHaveLength(0);
    // Deleting the last entry lands back on the first-run hero.
    await expect($('[data-testid="empty-vault"]')).toBeDisplayed();
    await expect($('[data-testid="create-first-entry-button"]')).toBeDisplayed();
  });
});

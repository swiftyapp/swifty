import {
  createLogin,
  entryItems,
  expectTitles,
  resetEmpty,
  unlock,
  waitFor,
} from "../helpers";

const MASTER_PASSWORD = "Tq4$mZr7bKv2!xNd";

const TITLE = "Retired Service";
const USERNAME = "trash@example.com";
const PASSWORD = "Tomb-Stone-Passphrase-6!";

const view = (name: "items" | "trash") =>
  $(`[data-testid="view-${name}"]`).click();

/** Delete the currently open entry through the overflow menu's two presses. */
async function deleteOpenEntry(): Promise<void> {
  await $('[data-testid="more-actions-button"]').click();
  await waitFor("delete-entry-button");
  await $('[data-testid="delete-entry-button"]').click();
  await waitFor("delete-entry-confirm");
  await $('[data-testid="delete-entry-confirm"]').click();
  await $('[data-testid="entry-item"]').waitForExist({
    reverse: true,
    timeout: 15_000,
  });
}

describe("trash", () => {
  before(async () => {
    await resetEmpty(MASTER_PASSWORD);
    await unlock(MASTER_PASSWORD);
    await createLogin({ title: TITLE, username: USERNAME, password: PASSWORD });
    await waitFor("entry-item");
  });

  it("moves a deleted entry out of All Items and into the Trash", async () => {
    await deleteOpenEntry();
    await waitFor("empty-vault");

    await view("trash");
    await waitFor("entry-item");

    await expect($('[data-testid="list-title"]')).toHaveText("Trash");
    await expectTitles([TITLE]);
    // Tombstone rows are stamped with when they went, not when they changed.
    await expect($('[data-testid="entry-item"]')).toHaveTextContaining("Deleted");
  });

  it("makes a trashed entry read-only: Restore or delete forever, nothing else", async () => {
    await $('[data-testid="entry-item"]').click();
    await waitFor("restore-entry-button");

    await expect($('[data-testid="purge-entry-button"]')).toBeExisting();
    // `reveal_entry` does not serve deleted rows, so there is nothing to edit
    // and nothing to copy.
    await expect($('[data-testid="edit-entry-button"]')).not.toBeExisting();
    await expect($('[data-testid="more-actions-button"]')).not.toBeExisting();
    await expect($('[data-testid="primary-action-button"]')).not.toBeExisting();
  });

  it("restores the entry back into All Items", async () => {
    await $('[data-testid="restore-entry-button"]').click();
    await waitFor("empty-trash");
    expect(await entryItems()).toHaveLength(0);

    await view("items");
    await expectTitles([TITLE]);

    // The restored entry is a normal, editable entry again.
    await $('[data-testid="entry-item"]').click();
    await waitFor("edit-entry-button");
  });

  it("needs two presses to delete permanently, and then it is gone for good", async () => {
    await deleteOpenEntry();
    await view("trash");
    await waitFor("entry-item");
    await $('[data-testid="entry-item"]').click();

    const purge = $('[data-testid="purge-entry-button"]');
    await purge.click();
    await waitFor("purge-entry-confirm");
    await expect($('[data-testid="purge-entry-confirm"]')).toHaveText(
      "Delete forever?",
    );
    await $('[data-testid="purge-entry-confirm"]').click();

    await waitFor("empty-trash");
    expect(await entryItems()).toHaveLength(0);

    // A purge is not a restore: All Items stays empty too.
    await view("items");
    await waitFor("empty-vault");
    expect(await entryItems()).toHaveLength(0);
  });
});

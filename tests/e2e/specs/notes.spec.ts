import { createNote, resetEmpty, unlock, waitFor } from "../helpers";

// Known app bug (not fixed here): `useRevealed` keys the decrypt on the entry
// id alone, so after an in-place save the detail pane keeps serving the
// pre-edit plaintext. Clearing the selection unmounts the pane, so re-opening
// the entry forces a fresh reveal — which is what this asserts against.
async function reopenFirstEntry(): Promise<void> {
  await waitFor("scope-login");
  await $('[data-testid="scope-login"]').click();
  await waitFor("scope-note");
  await $('[data-testid="scope-note"]').click();
  await waitFor("entry-item");
  await $('[data-testid="entry-item"]').click();
  await waitFor("entry-value-note");
}

// Secure notes: the body is a single encrypted field, so the round-trip that
// matters is "what was typed comes back, and an edit replaces it".

const MASTER_PASSWORD = "Rj3^bYu7nCx1qF!d";

const TITLE = "Recovery Codes";
// Single-line on purpose: `getText()` is rendered text, and asserting exact
// newlines through it would be testing the driver's whitespace handling.
const NOTE = "recovery code 8842-1907";
const EDITED_NOTE = "recovery code 3316-5520 (rotated)";

describe("secure notes", () => {
  before(async () => {
    await resetEmpty(MASTER_PASSWORD);
    await unlock(MASTER_PASSWORD);
    await createNote({ title: TITLE, note: NOTE });
    await waitFor("entry-item");
  });

  it("renders the note body in the detail pane", async () => {
    await waitFor("entry-value-note");
    await expect($('[data-testid="entry-value-note"]')).toHaveText(NOTE);
    await expect($('[data-testid="entry-item-title"]')).toHaveText(TITLE);
  });

  it("round-trips an edit of the body", async () => {
    await waitFor("edit-entry-button");
    await $('[data-testid="edit-entry-button"]').click();
    await waitFor("entry-sheet");

    // The form opens on encrypted metadata and swaps in the decrypted values a
    // tick later; typing before that lands would be overwritten.
    const body = $('textarea[name="note"]');
    await expect(body).toHaveValue(NOTE);

    await body.setValue(EDITED_NOTE);
    await expect(body).toHaveValue(EDITED_NOTE);

    await $('[data-testid="save-entry-button"]').click();
    await $('[data-testid="entry-sheet"]').waitForDisplayed({
      reverse: true,
      timeout: 15_000,
    });

    await reopenFirstEntry();
    await expect($('[data-testid="entry-value-note"]')).toHaveText(
      EDITED_NOTE,
    );
  });
});

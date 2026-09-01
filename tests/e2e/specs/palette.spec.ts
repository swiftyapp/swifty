import {
  chord,
  createLogin,
  resetEmpty,
  unlock,
  waitFor,
} from "../helpers";

// The command palette: its chord is the only way in (nothing else calls
// `openPalette`), entries and commands share one result list, and running a
// command has to actually reach the app — so both commands asserted here are
// checked by their effect, not by the row disappearing.

const MASTER_PASSWORD = "Fy2$dLw9kXn6bVc!";
const ENTRY_TITLE = "Palette Target Login";

async function openPalette(): Promise<void> {
  await chord("k");
  await waitFor("command-palette");
  await waitFor("command-palette-input");
}

/** The first result whose text contains `label`, or null while none does. */
async function findItem(label: string) {
  const rows = await $$('[data-testid="palette-item"]');
  for (const row of rows) {
    if ((await row.getText()).includes(label)) return row;
  }
  return null;
}

/** Type a query and wait for `label` to surface as a result row. */
async function query(text: string, label: string): Promise<void> {
  await $('[data-testid="command-palette-input"]').setValue(text);
  await waitFor("palette-item");
  await browser.waitUntil(async () => (await findItem(label)) !== null, {
    timeout: 10_000,
    timeoutMsg: `"${label}" never surfaced for the query "${text}"`,
  });
}

/** Run the result matching `label`. */
async function runItem(label: string): Promise<void> {
  const row = await findItem(label);
  if (!row) throw new Error(`[e2e] no palette row matching "${label}"`);
  await row.click();
}

const theme = () =>
  browser.execute(() => document.documentElement.getAttribute("data-theme"));

describe("command palette", () => {
  before(async () => {
    await resetEmpty(MASTER_PASSWORD);
    await unlock(MASTER_PASSWORD);
    await createLogin({
      title: ENTRY_TITLE,
      username: "palette@example.com",
      password: "P4lette-Search-Key-3!",
    });
  });

  it("surfaces a vault entry by title", async () => {
    await openPalette();

    // Empty query lists the commands only; entries need something to rank by.
    await query("Palette Target", ENTRY_TITLE);
    await runItem(ENTRY_TITLE);

    // Opening an entry selects it in the list column and closes the palette.
    await expect($('[data-testid="command-palette"]')).not.toBeDisplayed();
    await waitFor("edit-entry-button");
  });

  it("runs Lock vault", async () => {
    await openPalette();
    await query("Lock", "Lock vault");
    await runItem("Lock vault");

    await waitFor("unlock-password-input");
    await unlock(MASTER_PASSWORD);
  });

  it("runs Toggle theme", async () => {
    const before = await theme();

    await openPalette();
    await query("Toggle theme", "Toggle theme");
    await runItem("Toggle theme");

    await browser.waitUntil(async () => (await theme()) !== before, {
      timeout: 10_000,
      timeoutMsg: `<html data-theme> stayed at "${before}"`,
    });

    // The theme is persisted to localStorage, which no reset clears — put it
    // back so this spec leaves nothing behind for the rest of the run.
    await openPalette();
    await query("Toggle theme", "Toggle theme");
    await runItem("Toggle theme");
    await browser.waitUntil(async () => (await theme()) === before, {
      timeout: 10_000,
      timeoutMsg: `<html data-theme> never returned to "${before}"`,
    });
  });
});

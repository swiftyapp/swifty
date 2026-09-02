import { createLogin, entryItems, resetEmpty, unlock, waitFor } from "../helpers";

// The list column itself: what a vault with nothing in it offers, and the two
// orders the sort menu can put entries in.

const MASTER_PASSWORD = "Wc8*hFj5pAe0uY!s";

const PASSWORD = "L1st-Ord3r-Test-Pw!";
const ZEPHYR = "Zephyr Mail";
const ACME = "Acme Bank";
const MERCURY = "Mercury Cloud";

type SortMode = "recent" | "alpha";

async function pickSort(mode: SortMode): Promise<void> {
  await waitFor("sort-menu");
  await $('[data-testid="sort-menu"]').click();
  await waitFor(`sort-option-${mode}`);
  await $(`[data-testid="sort-option-${mode}"]`).click();
  // The menu closes on pick; wait for that before reading the list back.
  await $(`[data-testid="sort-option-${mode}"]`).waitForDisplayed({
    reverse: true,
    timeout: 5_000,
  });
}

async function titles(): Promise<string[]> {
  const rows = await $$('[data-testid="entry-item-title"]');
  const out: string[] = [];
  for (const row of rows) out.push(await row.getText());
  return out;
}

async function expectOrder(expected: string[]): Promise<void> {
  await browser.waitUntil(
    async () => (await titles()).join(" | ") === expected.join(" | "),
    {
      timeout: 15_000,
      timeoutMsg: `list never settled on ${expected.join(" | ")}`,
    },
  );
}

// Click the row with this title. Rows carry no per-entry testid, so they are
// matched on their title text.
async function openEntry(title: string): Promise<void> {
  const rows = await $$('[data-testid="entry-item"]');
  for (const row of rows) {
    if ((await row.$('[data-testid="entry-item-title"]').getText()) === title) {
      await row.click();
      return;
    }
  }
  throw new Error(`[e2e] no list row titled "${title}"`);
}

/**
 * Open an entry and save it unchanged — the cheapest way to make it "newest".
 *
 * The wait on the password is not decoration: `useRevealed` seeds the draft
 * after the editor mounts, and saving before it lands would write blanks.
 */
async function resaveEntry(title: string): Promise<void> {
  await openEntry(title);
  await waitFor("edit-entry-button");
  await $('[data-testid="edit-entry-button"]').click();
  await waitFor("entry-sheet");
  await expect($('input[name="password"]')).toHaveValue(PASSWORD);
  await $('[data-testid="save-entry-button"]').click();
  await $('[data-testid="entry-sheet"]').waitForDisplayed({
    reverse: true,
    timeout: 15_000,
  });
}

describe("entry list states and ordering", () => {
  before(async () => {
    await resetEmpty(MASTER_PASSWORD);
    await unlock(MASTER_PASSWORD);
    // The sort mode is a persisted UI preference, so a previous spec (or a
    // previous partial run) could leave it on alpha. Start from the default.
    await pickSort("recent");
  });

  it("offers the first-entry action on an empty vault and opens the editor", async () => {
    await waitFor("empty-vault");
    await waitFor("create-first-entry-button");
    expect(await entryItems()).toHaveLength(0);

    // One empty state at a time: the hero belongs to the detail pane, so the
    // list column shows nothing at all on a vault with nothing in it.
    await expect($('[data-testid="empty-kind"]')).not.toBeExisting();
    await expect($('[data-testid="empty-search"]')).not.toBeExisting();

    // The first-entry action opens the kind picker; the pane editor follows the
    // choice, and one Cancel is enough because nothing has been typed.
    await $('[data-testid="create-first-entry-button"]').click();
    await waitFor("add-secret-modal");
    await $('[data-testid="add-kind-login"]').click();
    await waitFor("entry-sheet");

    await $('[data-testid="cancel-entry-button"]').click();
    await $('[data-testid="entry-sheet"]').waitForDisplayed({
      reverse: true,
      timeout: 15_000,
    });
    await waitFor("empty-vault");
    await waitFor("create-first-entry-button");
  });

  it("orders entries A to Z under Alphabetical", async () => {
    // Seeded out of alphabetical order on purpose.
    for (const title of [ZEPHYR, ACME, MERCURY]) {
      await createLogin({
        title,
        username: `${title.split(" ")[0].toLowerCase()}@example.com`,
        password: PASSWORD,
      });
    }
    await browser.waitUntil(async () => (await entryItems()).length === 3, {
      timeout: 20_000,
      timeoutMsg: "the seed entries never reached the list",
    });

    await pickSort("alpha");
    await expectOrder([ACME, MERCURY, ZEPHYR]);
  });

  it("puts the most recently edited entry first under Recent", async () => {
    await pickSort("recent");
    // Newest write first: the seed order reversed.
    await expectOrder([MERCURY, ACME, ZEPHYR]);

    // Re-saving restamps `updatedAt`, which is what Recent orders on — so the
    // oldest entry should jump to the top.
    await resaveEntry(ZEPHYR);
    await expectOrder([ZEPHYR, MERCURY, ACME]);
  });

  it("pins a starred entry above the rest under Recent", async () => {
    await openEntry(ACME);
    await waitFor("favorite-toggle");
    await $('[data-testid="favorite-toggle"]').click();

    // Touching MERCURY makes it the most recent entry, so recency alone would
    // now put ACME last. Only the pin can keep it on top.
    await resaveEntry(MERCURY);
    await expectOrder([ACME, MERCURY, ZEPHYR]);
  });

  it("collects the starred entries under Favorites, and lets go of them", async () => {
    await $('[data-testid="view-favorites"]').click();
    await expect($('[data-testid="list-title"]')).toHaveText("Favorites");
    await expectOrder([ACME]);

    await openEntry(ACME);
    await $('[data-testid="favorite-toggle"]').click();

    await waitFor("empty-favorites");
    expect(await entryItems()).toHaveLength(0);

    await $('[data-testid="view-items"]').click();
    await browser.waitUntil(async () => (await entryItems()).length === 3, {
      timeout: 15_000,
      timeoutMsg: "unstarring lost an entry from All Items",
    });
  });
});

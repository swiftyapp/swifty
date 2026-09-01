import {
  createCard,
  createLogin,
  createNote,
  entryItems,
  resetEmpty,
  unlock,
  waitFor,
} from "../helpers";

// What the list column shows: the rail scope decides the kind, the search box
// narrows within it. Seeded once (`before`) because every assertion below is a
// read — nothing here mutates the vault.

const MASTER_PASSWORD = "Ws3%bTn7yFj4!kMc";

const LOGINS = ["Aurora Mail", "Basalt Bank", "Zephyr Cloud"];
const NOTE = "Recovery Codes";
const CARD = "Travel Card";

// The default sort is "recent" (updatedAt descending — defaults/list.ts), so
// with the seeds created in LOGINS order the list renders newest-first. The
// suite clears localStorage on reset, so the default is guaranteed here; the
// alpha mode has its own spec in the content-kinds batch.
const LOGINS_BY_RECENCY = [...LOGINS].reverse();

const searchInput = () => $('[data-testid="search-input"]');

/** Titles of the rows currently rendered, in list order. */
async function visibleTitles(): Promise<string[]> {
  const rows = await $$('[data-testid="entry-item-title"]');
  const titles: string[] = [];
  for (const row of rows) titles.push(await row.getText());
  return titles;
}

/** Wait for the list to settle on an exact set of titles, then return them. */
async function expectTitles(expected: string[]): Promise<void> {
  await browser.waitUntil(
    async () => (await visibleTitles()).join("|") === expected.join("|"),
    {
      timeout: 15_000,
      timeoutMsg: `list never settled on [${expected.join(", ")}]`,
    },
  );
  expect(await visibleTitles()).toEqual(expected);
}

async function selectScope(scope: "login" | "note" | "card"): Promise<void> {
  await waitFor(`scope-${scope}`);
  await $(`[data-testid="scope-${scope}"]`).click();
}

describe("search and rail scopes", () => {
  before(async function () {
    // Five entries through the real create flow, on top of an Argon2id unlock.
    this.timeout(180_000);

    await resetEmpty(MASTER_PASSWORD);
    await unlock(MASTER_PASSWORD);

    for (const title of LOGINS) {
      await createLogin({
        title,
        username: `${title.split(" ")[0].toLowerCase()}@example.com`,
        password: `Seed-${title.split(" ")[0]}-Passphrase-2!`,
      });
    }
    await createNote({ title: NOTE, note: "one two three four five" });
    await createCard({
      title: CARD,
      number: "4111111111111111",
      month: "12",
      year: "30",
      cvc: "123",
      pin: "4321",
    });
  });

  it("filters the list by title and restores it on clear", async () => {
    await selectScope("login");
    await expectTitles(LOGINS_BY_RECENCY);

    await searchInput().setValue("Basalt");
    await expectTitles(["Basalt Bank"]);
    expect(await entryItems()).toHaveLength(1);

    await $('[data-testid="search-clear-button"]').click();
    await expect(searchInput()).toHaveValue("");
    await expectTitles(LOGINS_BY_RECENCY);
  });

  it("shows only the kind the rail scope selects", async () => {
    // The query is global state, so leave it empty for the scope assertions.
    await selectScope("note");
    await expectTitles([NOTE]);

    await selectScope("card");
    await expectTitles([CARD]);

    await selectScope("login");
    await expectTitles(LOGINS_BY_RECENCY);
  });
});

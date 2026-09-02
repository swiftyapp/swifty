import {
  createCard,
  createLogin,
  createNote,
  entryItems,
  resetEmpty,
  unlock,
  waitFor,
} from "../helpers";

// What the list column shows: it lands on every kind at once ("All Items"), the
// kind chips narrow it to one kind, and the search box narrows within whatever
// is showing. Seeded once (`before`) because every assertion below is a read —
// nothing here mutates the vault.

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

/** Press one kind chip, or the "All" chip. */
async function selectKind(kind: "all" | "login" | "note" | "card"): Promise<void> {
  await waitFor(`filter-${kind}`);
  await $(`[data-testid="filter-${kind}"]`).click();
}

/** The count rendered on one chip. */
async function chipCount(kind: string): Promise<number> {
  await waitFor(`filter-${kind}`);
  const text = await $(`[data-testid="filter-${kind}"]`).$(".font-mono").getText();
  return Number(text);
}

describe("search and kind filters", () => {
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
    await selectKind("login");
    await expectTitles(LOGINS_BY_RECENCY);

    await searchInput().setValue("Basalt");
    await expectTitles(["Basalt Bank"]);
    expect(await entryItems()).toHaveLength(1);

    await $('[data-testid="search-clear-button"]').click();
    await expect(searchInput()).toHaveValue("");
    await expectTitles(LOGINS_BY_RECENCY);
  });

  it("lists every kind together under All Items", async () => {
    await selectKind("all");

    // Newest write first, so the reverse of the seed order across all kinds.
    await expectTitles([CARD, NOTE, ...LOGINS_BY_RECENCY]);
    await expect($('[data-testid="list-title"]')).toHaveText("All Items");
    await expect($('[data-testid="filter-all"]')).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("counts each kind on its chip", async () => {
    await selectKind("all");

    expect(await chipCount("all")).toBe(5);
    expect(await chipCount("login")).toBe(3);
    expect(await chipCount("note")).toBe(1);
    expect(await chipCount("card")).toBe(1);
  });

  it("shows only the kind the chip selects", async () => {
    // The query is global state, so leave it empty for the filter assertions.
    await selectKind("note");
    await expectTitles([NOTE]);
    await expect($('[data-testid="list-title"]')).toHaveText("Secure notes");
    await expect($('[data-testid="filter-note"]')).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await selectKind("card");
    await expectTitles([CARD]);
    await expect($('[data-testid="list-title"]')).toHaveText("Credit cards");

    await selectKind("login");
    await expectTitles(LOGINS_BY_RECENCY);
    await expect($('[data-testid="list-title"]')).toHaveText("Logins");
  });

  it("searches across every kind under All Items", async () => {
    await selectKind("all");
    await searchInput().setValue("Recovery");
    await expectTitles([NOTE]);

    // The same query under a kind that cannot match it comes back empty — and
    // says so in the list column, naming the query and the kind narrowing it.
    await selectKind("login");
    await expectTitles([]);
    await waitFor("empty-search");
    // The widen link is the tell that the kind filter is named in the line.
    await expect($('[data-testid="empty-search-widen"]')).toBeDisplayed();

    await $('[data-testid="search-clear-button"]').click();
    await expect(searchInput()).toHaveValue("");
    await expect($('[data-testid="empty-search"]')).not.toBeExisting();
  });
});

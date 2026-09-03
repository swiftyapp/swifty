import {
  chord,
  createCard,
  createLogin,
  createNote,
  entryItems,
  expectTitles,
  pressArrowDown,
  pressEnter,
  resetEmpty,
  unlock,
  visibleTitles,
  waitFor,
} from "../helpers";

// What the list column shows: it lands on every kind at once ("All Items"), the
// kind chips narrow it to one kind, and the search field — the app's only one,
// living in this column under the title — narrows within whatever is showing.
// ⌘F puts the caret in it and ⏎ selects the first row left standing.
//
// Seeded once (`before`) because every assertion below is a read — nothing here
// mutates the vault.

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

/** Wait for the row with this title to be the list's selected option. */
async function expectSelected(title: string): Promise<void> {
  await browser.waitUntil(
    async () => {
      for (const row of await $$('[data-testid="entry-item"]')) {
        const rowTitle = await row.$('[data-testid="entry-item-title"]').getText();
        if (rowTitle === title) return (await row.getAttribute("aria-selected")) === "true";
      }
      return false;
    },
    {
      timeout: 15_000,
      timeoutMsg: `"${title}" never became the selected row`,
    },
  );
}

/** Press one kind chip, or the "All" chip. */
async function selectKind(kind: "all" | "login" | "note" | "card"): Promise<void> {
  await waitFor(`filter-${kind}`);
  await $(`[data-testid="filter-${kind}"]`).click();
}

/** The count rendered on one chip. */
async function chipCount(kind: string): Promise<number> {
  await waitFor(`filter-${kind}-count`);
  return Number(await $(`[data-testid="filter-${kind}-count"]`).getText());
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

  it("takes ⌘F, and ⏎ selects the first row left standing", async () => {
    await selectKind("all");

    // Nothing is focused on entry, so a caret in the field can only have come
    // from the chord.
    await chord("f");
    await browser.waitUntil(async () => await searchInput().isFocused(), {
      timeout: 10_000,
      timeoutMsg: "⌘F never focused the list-column search field",
    });

    // Typed blind into whatever ⌘F focused.
    await browser.keys("Basalt");
    await expectTitles(["Basalt Bank"]);

    // ⏎ opens the single match in the detail pane.
    await pressEnter();
    await waitFor("edit-entry-button");

    await $('[data-testid="search-clear-button"]').click();
    await expect(searchInput()).toHaveValue("");
  });

  // The whole keyboard path, driven end to end: ⌘F, type, ↓↓, ⏎, ⌘E — never
  // touching the pointer.
  it("walks the results with ↓ and edits the row it lands on", async () => {
    await selectKind("all");

    await chord("f");
    await browser.waitUntil(async () => await searchInput().isFocused(), {
      timeout: 10_000,
      timeoutMsg: "⌘F never focused the list-column search field",
    });

    // Two seeds carry "ra" ("Aurora Mail", "Travel Card"); the fuzzy ranking
    // owns their order, so the row ↓↓ should land on is read back off the list.
    await browser.keys("ra");
    await browser.waitUntil(async () => (await visibleTitles()).length === 2, {
      timeout: 15_000,
      timeoutMsg: 'the query never settled on the two rows carrying "ra"',
    });
    const second = (await visibleTitles())[1];

    // Nothing was selected, so the first ↓ opens the list at its top row and
    // the second steps onto the row below it — with the caret still in the
    // field the arrows came from.
    await pressArrowDown();
    await pressArrowDown();
    await expectSelected(second);
    await expect(searchInput()).toBeFocused();

    // ⏎ stays on the row the arrows landed on instead of snapping back to the
    // first, and the detail pane is showing it.
    await pressEnter();
    await waitFor("edit-entry-button");
    await expectSelected(second);

    // ⌘E takes that selection into the editor.
    await chord("e");
    await waitFor("entry-sheet");
    // Cancelling before the decrypted values land would read as a dirty draft
    // and arm the discard guard; every kind's sheet opens with its title.
    await expect($('input[name="title"]')).toHaveValue(second);

    await $('[data-testid="cancel-entry-button"]').click();
    await $('[data-testid="entry-sheet"]').waitForDisplayed({
      reverse: true,
      timeout: 15_000,
    });

    await $('[data-testid="search-clear-button"]').click();
    await expect(searchInput()).toHaveValue("");
  });
});

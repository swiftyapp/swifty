import { createLogin, entryItems, resetEmpty, unlock, waitFor } from "../helpers";

// Tags are typed into the entry form and surface as a filter chip row below the
// kind chips, counted over whatever the kind filter currently admits.

const MASTER_PASSWORD = "Ld5!gXm2vQr6tN@k";

const UNTAGGED = "Untagged Account";
const WORK_ENTRY = "Work Account";
const HOME_ENTRY = "Home Account";

const CREDENTIALS = {
  username: "tagged@example.com",
  password: "T@gg3d-Pa55word-4!",
};

const chip = (tag: string) => $(`[data-testid="tag-item"][data-tag="${tag}"]`);

// Wait for the list to settle on a row count before reading it.
async function expectRowCount(count: number): Promise<void> {
  await browser.waitUntil(async () => (await entryItems()).length === count, {
    timeout: 15_000,
    timeoutMsg: `the list never settled on ${count} row(s)`,
  });
}

describe("tag filtering", () => {
  before(async () => {
    await resetEmpty(MASTER_PASSWORD);
    await unlock(MASTER_PASSWORD);
  });

  it("shows no chip row while nothing in view is tagged", async () => {
    await waitFor("main-view");
    await expect($('[data-testid="tags-list"]')).not.toBeDisplayed();

    // Still nothing to filter by once an untagged entry exists.
    await createLogin({ title: UNTAGGED, ...CREDENTIALS });
    await waitFor("entry-item");
    await expect($('[data-testid="tags-list"]')).not.toBeDisplayed();
  });

  it("surfaces one chip per tag used by the entries in view", async () => {
    await createLogin({ title: WORK_ENTRY, ...CREDENTIALS, tags: ["work"] });
    await createLogin({ title: HOME_ENTRY, ...CREDENTIALS, tags: ["home"] });
    await expectRowCount(3);

    await waitFor("tags-list");
    await expect($$('[data-testid="tag-item"]')).toBeElementsArrayOfSize(2);
    await expect(chip("home")).toBeDisplayed();
    await expect(chip("work")).toBeDisplayed();
  });

  it("filters the list to the selected tag and clears on a second press", async () => {
    await chip("work").waitForDisplayed({ timeout: 15_000 });
    await chip("work").click();

    await expectRowCount(1);
    await expect($('[data-testid="entry-item-title"]')).toHaveText(WORK_ENTRY);
    await expect(chip("work")).toHaveAttribute("aria-pressed", "true");

    await chip("work").click();

    await expectRowCount(3);
    await expect(chip("work")).toHaveAttribute("aria-pressed", "false");
  });

  it("keeps the chip row out of a kind with no tagged entries", async () => {
    await waitFor("filter-note");
    await $('[data-testid="filter-note"]').click();

    await expectRowCount(0);
    await expect($('[data-testid="tags-list"]')).not.toBeDisplayed();
  });
});

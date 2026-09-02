import { waitFor } from "./app";

/**
 * Entry creation through the real UI.
 *
 * There is no kind picker in the add flow yet: Add takes the kind from the
 * active type filter, falling back to a login (`Sidebar/Add.tsx`), so every
 * helper here presses its kind's filter chip first and only then presses Add.
 * When the kind-picker modal lands this becomes a choice inside the modal and
 * the chip click can go.
 */

type Kind = "login" | "card" | "note";

export interface LoginFields {
  title: string;
  username: string;
  password: string;
  website?: string;
  tags?: string[];
}

export interface CardFields {
  title: string;
  number: string;
  month: string;
  year: string;
  cvc: string;
  pin: string;
  name?: string;
  tags?: string[];
}

export interface NoteFields {
  title: string;
  note: string;
  tags?: string[];
}

async function openForm(kind: Kind): Promise<void> {
  await waitFor(`filter-${kind}`);
  await $(`[data-testid="filter-${kind}"]`).click();
  await $('[data-testid="add-entry-button"]').click();
  await waitFor("entry-sheet");
  await $('input[name="title"]').waitForDisplayed({ timeout: 5_000 });
}

// Fields are addressed by `name` — the form renders plain inputs (and one
// textarea for note bodies), so there is no per-field testid to depend on.
async function fill(name: string, value: string, tag = "input"): Promise<void> {
  await $(`${tag}[name="${name}"]`).setValue(value);
}

// Tags live in a chip input, not a plain field: each tag is committed with
// Enter (the component also commits on blur, but Enter keeps the caret in the
// input for the next one). Enter inside the sheet is inert — the sheet only
// submits on ⌘/Ctrl+Enter — so this never saves early.
async function fillTags(tags: string[] = []): Promise<void> {
  if (tags.length === 0) return;
  const input = $('[data-testid="tags-input"]');
  await input.waitForDisplayed({ timeout: 5_000 });
  for (const tag of tags) {
    await input.setValue(tag);
    await browser.keys("Enter");
  }
}

// Save and wait for the sheet to close, which is the store's "write landed"
// signal (a failed write leaves the sheet open with `entry-save-error`).
async function save(): Promise<void> {
  await $('[data-testid="save-entry-button"]').click();
  await $('[data-testid="entry-sheet"]').waitForDisplayed({
    reverse: true,
    timeout: 15_000,
  });
}

export async function createLogin(fields: LoginFields): Promise<void> {
  await openForm("login");
  await fill("title", fields.title);
  if (fields.website !== undefined) await fill("website", fields.website);
  await fill("username", fields.username);
  await fill("password", fields.password);
  await fillTags(fields.tags);
  await save();
}

export async function createCard(fields: CardFields): Promise<void> {
  await openForm("card");
  await fill("title", fields.title);
  await fill("number", fields.number);
  await fill("month", fields.month);
  await fill("year", fields.year);
  await fill("cvc", fields.cvc);
  await fill("pin", fields.pin);
  if (fields.name !== undefined) await fill("name", fields.name);
  await fillTags(fields.tags);
  await save();
}

export async function createNote(fields: NoteFields): Promise<void> {
  await openForm("note");
  await fill("title", fields.title);
  await fill("note", fields.note, "textarea");
  await fillTags(fields.tags);
  await save();
}

/** Every entry row currently rendered in the list column. */
export function entryItems() {
  return $$('[data-testid="entry-item"]');
}

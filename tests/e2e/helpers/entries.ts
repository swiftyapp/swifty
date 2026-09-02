import { waitFor } from "./app";

/**
 * Entry creation through the real UI.
 *
 * Add always asks which kind: the rail button opens the picker modal
 * (`Main/AddSecret`) and the kind is chosen there, so the list filter no longer
 * has any say in what gets created.
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

// `entry-sheet` is now the editing container inside the detail pane rather
// than a sliding sheet — the testid is kept so every wait below still reads as
// "the editor is up".
async function openForm(kind: Kind): Promise<void> {
  await waitFor("add-entry-button");
  await $('[data-testid="add-entry-button"]').click();
  await waitFor("add-secret-modal");
  await $(`[data-testid="add-kind-${kind}"]`).click();
  await waitFor("entry-sheet");
  await $('input[name="title"]').waitForDisplayed({ timeout: 5_000 });
}

// Fields are addressed by `name` — the editor renders one borderless input per
// row (and one textarea for note bodies), so there is no per-field testid to
// depend on. The title is the pane's own heading input, still `name="title"`.
async function fill(name: string, value: string, tag = "input"): Promise<void> {
  await $(`${tag}[name="${name}"]`).setValue(value);
}

// Tags live in a chip input, not a plain field: each tag is committed with
// Enter (the component also commits on blur, but Enter keeps the caret in the
// input for the next one). Enter inside the editor is inert — it only submits
// on ⌘/Ctrl+Enter — so this never saves early.
async function fillTags(tags: string[] = []): Promise<void> {
  if (tags.length === 0) return;
  const input = $('[data-testid="tags-input"]');
  await input.waitForDisplayed({ timeout: 5_000 });
  for (const tag of tags) {
    await input.setValue(tag);
    await browser.keys("Enter");
  }
}

// Save and wait for the editor to give the pane back to the read view, which is
// the store's "write landed" signal (a failed write stays in edit mode with
// `entry-save-error`).
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
  // The card face IS the form: the number groups itself into 4-digit blocks as
  // it is typed (so it reads back as "4111 1111 1111 1111"), and the two Month
  // and Year boxes are now one MM/YY box that is split again on save. Callers
  // still pass the pair — typing "0429" is what produces month 04, year 29.
  await fill("number", fields.number);
  await fill("expiry", `${fields.month}${fields.year.slice(-2)}`);
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

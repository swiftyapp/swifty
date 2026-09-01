import { waitFor } from "./app";

/**
 * Entry creation through the real UI.
 *
 * There is no kind picker in the add flow: the new entry inherits the sidebar
 * scope (`Form/index.tsx` reads `filters.scope`), so every helper here selects
 * its rail item first and only then presses Add.
 */

type Scope = "login" | "card" | "note";

export interface LoginFields {
  title: string;
  username: string;
  password: string;
  website?: string;
}

export interface CardFields {
  title: string;
  number: string;
  month: string;
  year: string;
  cvc: string;
  pin: string;
  name?: string;
}

export interface NoteFields {
  title: string;
  note: string;
}

async function openForm(scope: Scope): Promise<void> {
  await waitFor(`scope-${scope}`);
  await $(`[data-testid="scope-${scope}"]`).click();
  await $('[data-testid="add-entry-button"]').click();
  await waitFor("entry-sheet");
  await $('input[name="title"]').waitForDisplayed({ timeout: 5_000 });
}

// Fields are addressed by `name` — the form renders plain inputs (and one
// textarea for note bodies), so there is no per-field testid to depend on.
async function fill(name: string, value: string, tag = "input"): Promise<void> {
  await $(`${tag}[name="${name}"]`).setValue(value);
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
  await save();
}

export async function createNote(fields: NoteFields): Promise<void> {
  await openForm("note");
  await fill("title", fields.title);
  await fill("note", fields.note, "textarea");
  await save();
}

/** Every entry row currently rendered in the list column. */
export function entryItems() {
  return $$('[data-testid="entry-item"]');
}

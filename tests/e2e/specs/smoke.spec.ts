import { waitFor, waitForAppReady } from "../helpers/app";

// A single continuous smoke flow: first-run setup, lock/unlock, and one entry
// round-trip. Kept as one test (not several independent `it`s) since each step
// depends on the vault state left by the previous one.

const MASTER_PASSWORD = "Xk9#mVq2pLwT7zQ!";
const ENTRY_TITLE = "Smoke Test Login";
const ENTRY_USERNAME = "smoke@example.com";
const ENTRY_PASSWORD = "C0rrect-Horse-Battery-9!";

describe("Tauri app smoke test", () => {
  it("completes setup, locks, unlocks, and round-trips one entry", async () => {
    // ── First-run vault setup ────────────────────────────────────────────────
    await waitFor("start-setup-button");
    await $('[data-testid="start-setup-button"]').click();

    await waitFor("setup-password-input");
    await $('[data-testid="setup-password-input"]').setValue(MASTER_PASSWORD);
    await $('[data-testid="setup-continue-button"]').click();

    await waitFor("setup-confirm-password-input");
    await $('[data-testid="setup-confirm-password-input"]').setValue(MASTER_PASSWORD);
    await $('[data-testid="setup-finish-button"]').click();

    // ── Verify unlocked ──────────────────────────────────────────────────────
    await waitForAppReady();
    await expect($('[data-testid="main-view"]')).toBeDisplayed();

    // ── Lock ─────────────────────────────────────────────────────────────────
    await $('[data-testid="settings-button"]').click();
    await waitFor("lock-vault-button");
    await $('[data-testid="lock-vault-button"]').click();

    // ── Unlock with the same master password ────────────────────────────────
    await waitFor("unlock-password-input");
    const unlockInput = await $('[data-testid="unlock-password-input"]');
    await unlockInput.setValue(MASTER_PASSWORD);
    await browser.keys([""]); // Enter

    await waitForAppReady();

    // ── Add one entry ────────────────────────────────────────────────────────
    await $('[data-testid="add-entry-button"]').click();

    await $('input[name="title"]').waitForDisplayed({ timeout: 5_000 });
    await $('input[name="title"]').setValue(ENTRY_TITLE);
    await $('input[name="username"]').setValue(ENTRY_USERNAME);
    await $('input[name="password"]').setValue(ENTRY_PASSWORD);

    await $('[data-testid="save-entry-button"]').click();

    // ── Reveal it and assert the value ───────────────────────────────────────
    await waitFor("entry-item");
    await expect($('[data-testid="entry-value-password"]')).toHaveText(ENTRY_PASSWORD);
    await expect($('[data-testid="entry-value-username"]')).toHaveText(ENTRY_USERNAME);
  });
});

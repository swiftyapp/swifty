import {
  createLogin,
  lockVault,
  resetPristine,
  setupVault,
  unlock,
  waitFor,
} from "../helpers";

// A single continuous smoke flow: first-run setup, lock/unlock, and one entry
// round-trip. Kept as one test (not several independent `it`s) since each step
// depends on the vault state left by the previous one.

const MASTER_PASSWORD = "Xk9#mVq2pLwT7zQ!";
const ENTRY_TITLE = "Smoke Test Login";
const ENTRY_USERNAME = "smoke@example.com";
const ENTRY_PASSWORD = "C0rrect-Horse-Battery-9!";

describe("Tauri app smoke test", () => {
  it("completes setup, locks, unlocks, and round-trips one entry", async () => {
    await resetPristine();

    await setupVault(MASTER_PASSWORD);
    await expect($('[data-testid="main-view"]')).toBeDisplayed();

    await lockVault();
    await unlock(MASTER_PASSWORD);

    await createLogin({
      title: ENTRY_TITLE,
      username: ENTRY_USERNAME,
      password: ENTRY_PASSWORD,
    });

    // ── Reveal it and assert the values ──────────────────────────────────────
    await waitFor("entry-item");
    await expect($('[data-testid="entry-value-password"]')).toHaveText(ENTRY_PASSWORD);
    await expect($('[data-testid="entry-value-username"]')).toHaveText(ENTRY_USERNAME);
  });
});

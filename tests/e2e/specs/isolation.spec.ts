import {
  createLogin,
  entryItems,
  resetEmpty,
  resetPristine,
  setupVault,
  unlock,
  waitFor,
} from "../helpers";

// Proof that the reset seam actually isolates specs. Not feature coverage —
// every other spec in this suite depends on these two guarantees holding.

const MASTER_PASSWORD = "Zt4$rNb8kHyD2wS!";
const LEAKY_ENTRY_TITLE = "Should Not Survive A Reset";

describe("per-spec state isolation", () => {
  it("resetEmpty lands on unlock with a vault that accepts the password", async () => {
    await resetEmpty(MASTER_PASSWORD);

    // A vault exists (setup was skipped) and it is locked.
    await expect($('[data-testid="start-setup-button"]')).not.toBeDisplayed();

    await unlock(MASTER_PASSWORD);
    await expect($('[data-testid="main-view"]')).toBeDisplayed();
    expect(await entryItems()).toHaveLength(0);
  });

  it("resetPristine erases the previous spec's vault, entries and all", async () => {
    // Arrange: a vault with one entry in it.
    await resetEmpty(MASTER_PASSWORD);
    await unlock(MASTER_PASSWORD);
    await createLogin({
      title: LEAKY_ENTRY_TITLE,
      username: "leak@example.com",
      password: "Le@k-Test-Password-7!",
    });
    await waitFor("entry-item");

    // Act: wipe back to a first-run state.
    await resetPristine();

    // The vault itself is gone — the app is offering setup, not unlock.
    await expect($('[data-testid="start-setup-button"]')).toBeDisplayed();
    await expect($('[data-testid="unlock-password-input"]')).not.toBeDisplayed();

    // And a vault created afresh (same password, so a leaked DB would still
    // open) starts empty.
    await setupVault(MASTER_PASSWORD);
    expect(await entryItems()).toHaveLength(0);
  });
});

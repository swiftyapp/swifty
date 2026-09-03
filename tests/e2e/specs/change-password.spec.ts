import { lockVault, pressEnter, resetEmpty, unlock, waitFor } from "../helpers";

// Changing the master password from Settings, and the only proof that matters:
// the vault afterwards opens under the new password and refuses the old one.

const OLD_PASSWORD = "Gt5$mQx8pWv3zKn!";
const NEW_PASSWORD = "Bz7&rHd2jYc9tLm!";

async function fill(name: string, value: string): Promise<void> {
  const field = $(`input[name="${name}"]`);
  await field.waitForDisplayed({ timeout: 10_000 });
  await field.setValue(value);
  await expect(field).toHaveValue(value);
}

async function openMasterPasswordSettings(): Promise<void> {
  await waitFor("settings-button");
  await $('[data-testid="settings-button"]').click();
  await waitFor("settings-nav-security");
  await $('[data-testid="settings-nav-security"]').click();

  // The three fields live behind the row's "Change…" control.
  await waitFor("settings-master-password-row");
  await $('[data-testid="settings-master-password-row"]').$("button").click();
  await waitFor("change-password-submit");
}

async function submit(): Promise<void> {
  await $('[data-testid="change-password-submit"]').click();
}

describe("change master password", () => {
  before(async () => {
    // Every selector below is an English label; `reset()` seeds the locale.
    await resetEmpty(OLD_PASSWORD);
    await unlock(OLD_PASSWORD);
    await openMasterPasswordSettings();
  });

  it("rejects a wrong current password", async () => {
    await fill("current_password", "not-the-master-password");
    await fill("new_password", NEW_PASSWORD);
    await fill("new_password_repeat", NEW_PASSWORD);

    await submit();

    await waitFor("change-password-error");
    await expect($('[data-testid="change-password-success"]')).not.toBeDisplayed();
  });

  it("will not submit while the new password and its repeat differ", async () => {
    await fill("current_password", OLD_PASSWORD);
    await fill("new_password", NEW_PASSWORD);
    await fill("new_password_repeat", `${NEW_PASSWORD}-typo`);

    // The form gates the mismatch on the control itself rather than by running
    // the change and reporting a failure, so there is nothing to submit.
    await expect($('[data-testid="change-password-submit"]')).toBeDisabled();
    await expect($('[data-testid="change-password-success"]')).not.toBeDisplayed();
  });

  it("accepts the change and re-keys the vault", async () => {
    await fill("current_password", OLD_PASSWORD);
    await fill("new_password", NEW_PASSWORD);
    await fill("new_password_repeat", NEW_PASSWORD);

    await expect($('[data-testid="change-password-submit"]')).toBeEnabled();
    await submit();

    // Re-keying rewrites every row, so this one is slower than a UI round-trip.
    await waitFor("change-password-success", 30_000);
    await expect($('[data-testid="change-password-error"]')).not.toBeDisplayed();
  });

  it("opens under the new password and refuses the old one", async () => {
    await $('[data-testid="modal-close"]').click();
    await $('[data-testid="modal-close"]').waitForDisplayed({
      reverse: true,
      timeout: 10_000,
    });

    await lockVault();

    await $('[data-testid="unlock-password-input"]').setValue(OLD_PASSWORD);
    await pressEnter();
    await waitFor("unlock-error");
    await expect($('[data-testid="unlock-error"]')).toHaveText(
      "Incorrect Master Password",
    );

    await unlock(NEW_PASSWORD);
    await expect($('[data-testid="main-view"]')).toBeDisplayed();
  });
});

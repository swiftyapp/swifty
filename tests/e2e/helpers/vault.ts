import { waitFor, waitForAppReady } from "./app";

/** Drive the real first-run setup UI from the choice screen to an unlocked vault. */
export async function setupVault(password: string): Promise<void> {
  await waitFor("start-setup-button");
  await $('[data-testid="start-setup-button"]').click();

  await waitFor("setup-password-input");
  await $('[data-testid="setup-password-input"]').setValue(password);
  await $('[data-testid="setup-continue-button"]').click();

  await waitFor("setup-confirm-password-input");
  await $('[data-testid="setup-confirm-password-input"]').setValue(password);
  await $('[data-testid="setup-finish-button"]').click();

  await waitForAppReady();
}

/** Unlock from the lock screen: type the password and submit with Enter. */
export async function unlock(password: string): Promise<void> {
  await waitFor("unlock-password-input");
  await $('[data-testid="unlock-password-input"]').setValue(password);
  await browser.keys([""]); // Enter
  await waitForAppReady();
}

/** Lock the vault from the top chrome and wait for the lock screen. */
export async function lockVault(): Promise<void> {
  await waitFor("lock-vault-button");
  await $('[data-testid="lock-vault-button"]').click();
  await waitFor("unlock-password-input");
}

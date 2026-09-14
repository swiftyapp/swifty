import { waitFor, waitForAppReady } from "./app";
import { pressEnter } from "./keys";

/**
 * Drive the real first-run UI from the welcome screen to an unlocked vault.
 *
 * The password and its confirmation are one screen now, so Continue is what
 * finishes it; the backup question that follows is answered "this device only",
 * which is what creates the vault.
 */
export async function setupVault(password: string): Promise<void> {
  await waitFor("start-setup-button");
  await $('[data-testid="start-setup-button"]').click();

  await waitFor("setup-password-input");
  await $('[data-testid="setup-password-input"]').setValue(password);
  await $('[data-testid="setup-confirm-password-input"]').setValue(password);
  await $('[data-testid="setup-continue-button"]').click();

  await waitFor("setup-skip-drive-button");
  await $('[data-testid="setup-skip-drive-button"]').click();

  await skipBiometricIfOffered();
  await waitForAppReady();
}

/**
 * The last first-run question is only asked where the OS reports a biometric
 * gate, which depends on the runner: a headless Linux box has none, a Mac
 * runner may. Whichever lands first — the question or the unlocked app —
 * decides whether there is anything to dismiss.
 */
export async function skipBiometricIfOffered(timeout = 15_000): Promise<void> {
  const skip = $('[data-testid="setup-skip-biometric-button"]');
  const main = $('[data-testid="main-view"]');
  await browser.waitUntil(
    async () => (await skip.isDisplayed()) || (await main.isDisplayed()),
    { timeout, timeoutMsg: "neither the biometric step nor the app appeared" },
  );
  if (await skip.isDisplayed()) await skip.click();
}

/** Unlock from the lock screen: type the password and submit with Enter. */
export async function unlock(password: string): Promise<void> {
  await waitFor("unlock-password-input");
  await $('[data-testid="unlock-password-input"]').setValue(password);
  await pressEnter();
  await waitForAppReady();
}

/** Lock the vault from the top chrome and wait for the lock screen. */
export async function lockVault(): Promise<void> {
  await waitFor("lock-vault-button");
  await $('[data-testid="lock-vault-button"]').click();
  await waitFor("unlock-password-input");
}

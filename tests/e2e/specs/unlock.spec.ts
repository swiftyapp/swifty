import { resetEmpty, waitFor, waitForAppReady } from "../helpers";

// The lock screen: the wrong-password path, the Enter accelerator, and the
// failed-attempt backoff.
//
// The backoff constants live in `src-tauri/src/commands/auth.rs`: the first
// FREE_ATTEMPTS (3) failures are free and the 4th locks for 2^1 = 2 seconds.
// Four attempts is therefore the cheapest way to observe a real lockout, and
// the wait it costs is ~2s. The state lives in a sidecar next to the DB, which
// `resetEmpty()` wipes — so this spec never leaks a lockout into another one.

const MASTER_PASSWORD = "Hn6@wKd3sYc8!fRt";
const WRONG_PASSWORD = "Nope-Not-The-One-1!";
const ENTER = "\uE007"; // the WebDriver key code for Enter

const FREE_ATTEMPTS = 3;

const input = () => $('[data-testid="unlock-password-input"]');

/** Type into the lock field, proving the field really holds what we typed. */
async function typePassword(value: string): Promise<void> {
  const field = input();
  await field.waitForEnabled({ timeout: 30_000 });
  await field.setValue(value);
  await browser.waitUntil(async () => (await field.getValue()) === value, {
    timeout: 10_000,
    timeoutMsg: `the lock field never settled on the typed value`,
  });
}

/** Submit with Enter — the lock screen has no submit button of its own. */
async function submit(): Promise<void> {
  await browser.keys(ENTER);
}

describe("unlocking a vault", () => {
  it("rejects a wrong password and accepts the right one on Enter", async function () {
    // Argon2id runs unoptimised in the debug binary, so every attempt (right or
    // wrong) costs a real derive.
    this.timeout(120_000);

    await resetEmpty(MASTER_PASSWORD);

    await typePassword(WRONG_PASSWORD);
    await submit();

    await waitFor("unlock-error");
    await expect($('[data-testid="unlock-error"]')).toHaveText(
      "Incorrect Master Password",
    );
    await expect($('[data-testid="main-view"]')).not.toBeDisplayed();

    await typePassword(MASTER_PASSWORD);
    await submit();

    await waitForAppReady();
    await expect($('[data-testid="unlock-password-input"]')).not.toBeDisplayed();
  });

  it("locks the field out after repeated failures, then unlocks once it expires", async function () {
    this.timeout(180_000);

    await resetEmpty(MASTER_PASSWORD);

    // The free attempts only ever report a bad password.
    for (let attempt = 1; attempt <= FREE_ATTEMPTS; attempt += 1) {
      await typePassword(`${WRONG_PASSWORD}-${attempt}`);
      await submit();
      await waitFor("unlock-error");
    }

    // One more crosses the threshold and arms the backoff.
    await typePassword(`${WRONG_PASSWORD}-${FREE_ATTEMPTS + 1}`);
    await submit();

    await waitFor("unlock-lockout");
    await expect($('[data-testid="unlock-lockout"]')).toHaveText(
      /Too many failed attempts\. Try again in \d+s/,
    );
    await expect(input()).toBeDisabled();

    // The countdown re-enables the field on its own; the correct password then
    // works, which also clears the sidecar.
    await input().waitForEnabled({ timeout: 30_000 });
    await waitFor("unlock-status");

    await typePassword(MASTER_PASSWORD);
    await submit();

    await waitForAppReady();
  });
});

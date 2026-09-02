import { resetEmpty, unlock, waitFor } from "../helpers";

// The header's sync pill on a vault that was never connected to a remote.
// Nothing here touches sync itself — no provider is configured, so the pill has
// no state to report and is not rendered at all.

const MASTER_PASSWORD = "Hv6#nTc4qWs8zRb!";

describe("sync indicator", () => {
  it("is absent on a vault with no sync configured", async () => {
    await resetEmpty(MASTER_PASSWORD);
    await unlock(MASTER_PASSWORD);

    // The lock button shares the header's right side, so once it is up the
    // chrome has rendered and the missing pill is a real absence.
    await waitFor("lock-vault-button");
    await expect($('[data-testid="sync-indicator"]')).not.toBeExisting();
  });
});

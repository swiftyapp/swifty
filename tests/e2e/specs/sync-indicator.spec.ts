import { resetEmpty, unlock, waitFor } from "../helpers";

// The header's sync pill on a vault that was never connected to a remote.
// Nothing here touches sync itself — no provider is configured, so the only
// state the app can be in is the local-only one.

const MASTER_PASSWORD = "Hv6#nTc4qWs8zRb!";

describe("sync indicator", () => {
  it("reads Local on a vault with no sync configured", async () => {
    await resetEmpty(MASTER_PASSWORD);
    await unlock(MASTER_PASSWORD);

    await waitFor("sync-indicator");
    await expect($('[data-testid="sync-indicator"]')).toHaveText("Local");
  });
});

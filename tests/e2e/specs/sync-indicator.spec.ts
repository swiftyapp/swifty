import { resetEmpty, unlock, waitFor } from "../helpers";

// The header's sync chip on a vault that was never connected to a remote.
// Nothing here touches sync itself — no provider is configured, so the chip
// reports the one thing that is true of such a vault: it is local-only. The
// chip is mounted in every state, including this one, so the absence of a
// remote is stated rather than left to be read off an empty slot.

const MASTER_PASSWORD = "Hv6#nTc4qWs8zRb!";

describe("sync indicator", () => {
  it("reports a local-only vault when no sync is configured", async () => {
    await resetEmpty(MASTER_PASSWORD);
    await unlock(MASTER_PASSWORD);

    await waitFor("sync-indicator");
    // The tone, not the label. The label is localised, so asserting its text
    // would tie the suite to whichever locale the runner's OS reports — and
    // `data-tone` is what distinguishes local-only from the four sync states
    // the same element renders.
    await expect($('[data-testid="sync-indicator"]')).toHaveAttribute(
      "data-tone",
      "local"
    );
  });
});

import { resetEmpty, unlock, waitFor } from "../helpers";

// The Settings modal: the nav, and the preference rows that are provable
// locally. Drive sync, the native file dialogs and the updater endpoint are all
// out of reach for the driver (see COVERAGE.md) — everything asserted here is
// either store state, localStorage, or the DOM.

const MASTER_PASSWORD = "Kp9$wTz4nBv7qXe!";

const title = () => $('[data-testid="settings-modal"]').$("h1");

async function openSettings(): Promise<void> {
  await waitFor("settings-button");
  await $('[data-testid="settings-button"]').click();
  await waitFor("settings-modal");
}

async function section(name: string): Promise<void> {
  await $(`[data-testid="settings-nav-${name}"]`).click();
}

/** A localStorage value, read from the page. */
async function stored(key: string): Promise<string | null> {
  return browser.execute((k: string) => localStorage.getItem(k), key);
}

describe("settings", () => {
  before(async () => {
    // Every selector below is an English label; `reset()` seeds the locale.
    await resetEmpty(MASTER_PASSWORD);
    await unlock(MASTER_PASSWORD);
    await openSettings();
  });

  after(async () => {
    // The theme case below persists; leave the app on the default for the next
    // spec in the run.
    await browser.execute(() => localStorage.setItem("theme", "light"));
  });

  it("opens on Sync & devices and marks the active nav item", async () => {
    await expect(title()).toHaveText("Sync & devices");
    await expect($('[data-testid="settings-nav-sync"]')).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("walks every section from the nav", async () => {
    const sections: [string, string][] = [
      ["security", "Security"],
      ["audit", "Vault audit"],
      ["import", "Import"],
      ["language", "Language & region"],
      ["sync", "Sync & devices"],
    ];

    for (const [name, heading] of sections) {
      await section(name);
      await expect(title()).toHaveText(heading);
      await expect($(`[data-testid="settings-nav-${name}"]`)).toHaveAttribute(
        "aria-current",
        "page",
      );
    }
  });

  it("names the build in the pinned footer", async () => {
    await expect($('[data-testid="settings-version"]')).toHaveText(/^Swifty /);
    await expect($('[data-testid="settings-update-status"]')).toBeDisplayed();
  });

  it("offers Google Drive as not connected", async () => {
    await section("sync");
    await expect($('[data-testid="settings-drive-row"]')).toHaveText(
      /Not connected/,
    );
    await expect($('[data-testid="settings-drive-connect"]')).toBeDisplayed();
  });

  it("keeps the encrypted backup form behind its control", async () => {
    await section("sync");
    await expect($('input[name="export_password"]')).not.toBeDisplayed();
    await $('[data-testid="settings-backup-row"]').$("button").click();
    await expect($('input[name="export_password"]')).toBeDisplayed();
  });

  it("persists the auto-lock and clipboard delays", async () => {
    await section("security");

    await $('[data-testid="settings-autolock-900"]').click();
    await expect($('[data-testid="settings-autolock-900"]')).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(await stored("swifty:autolockSecs")).toBe("900");

    await $('[data-testid="settings-clipboard-0"]').click();
    expect(await stored("swifty:clipboardTimeout")).toBe("0");

    await $('[data-testid="settings-clipboard-30000"]').click();
    expect(await stored("swifty:clipboardTimeout")).toBe("30000");
  });

  it("persists the generator defaults", async () => {
    await section("security");
    await $('[data-testid="settings-generator-symbols"]').click();

    const props = await browser.execute(() =>
      JSON.parse(localStorage.getItem("swifty:generatorDefaults") ?? "{}"),
    );
    expect(props.symbols).toBe(false);

    // Put it back — the generator spec asserts against the default charset.
    await $('[data-testid="settings-generator-symbols"]').click();
  });

  it("turns breach monitoring on and leaves the always-on monitors alone", async () => {
    await section("audit");

    await expect($('[data-testid="settings-breach-toggle"]')).toHaveAttribute(
      "aria-checked",
      "false",
    );
    await $('[data-testid="settings-breach-toggle"]').click();
    await expect($('[data-testid="settings-breach-toggle"]')).toHaveAttribute(
      "aria-checked",
      "true",
    );

    // Weak and reused cannot be switched off, so they carry no control.
    const switches = await $('[data-testid="settings-modal"]').$$('[role="switch"]');
    expect(switches).toHaveLength(1);

    // The audit spec runs with the breach check off (no network in the suite).
    await $('[data-testid="settings-breach-toggle"]').click();
  });

  it("offers one import tile per source and no format select", async () => {
    await section("import");

    for (const key of [
      "bitwarden",
      "chrome",
      "lastpass",
      "keepass",
      "csv",
      "swftx",
    ])
      await expect($(`[data-testid="import-tile-${key}"]`)).toBeDisplayed();

    await expect($('[data-testid="import-dropzone"]')).toBeDisplayed();
    await expect($('[data-testid="settings-modal"]').$("select")).not.toExist();
  });

  it("switches the theme and the date format", async () => {
    await section("language");

    await $('[data-testid="settings-theme-dark"]').click();
    await expect($("html")).toHaveAttribute("data-theme", "dark");
    await $('[data-testid="settings-theme-light"]').click();
    await expect($("html")).toHaveAttribute("data-theme", "light");

    await $('[data-testid="settings-date-format-YYYY-MM-DD"]').click();
    expect(await stored("swifty:dateFormat")).toBe("YYYY-MM-DD");
    await $('[data-testid="settings-date-format-MM/DD/YYYY"]').click();
    expect(await stored("swifty:dateFormat")).toBe("MM/DD/YYYY");
  });

  it("closes from the header X", async () => {
    await $('[data-testid="modal-close"]').click();
    await $('[data-testid="settings-modal"]').waitForDisplayed({
      reverse: true,
      timeout: 10_000,
    });
  });
});

import { createLogin, resetEmpty, unlock, waitFor } from "../helpers";

// The Password Audit pane behind the rail's vault-health dial.
//
// Everything asserted here is seeded, never sampled: two logins share a
// password (reused), one carries a trivially guessable one (weak). The
// Breached group is deliberately excluded — it is gated on the opt-in HIBP
// lookup, which is a network call (`hibp::check_all`), so the spec pins the
// preference off and asserts the group is *absent* rather than depending on
// what a live range query would answer.

const MASTER_PASSWORD = "Pd3$wKn7yBq2xMt!";

const SHARED_PASSWORD = "Rk7#zVm4tQx9pLd!";
const WEAK_PASSWORD = "abc";
const FIXED_WEAK_PASSWORD = "Jw5&hCf8nZr3bXq!";
const FIXED_REUSE_PASSWORD = "Lb9@sPu6dKv1mTy!";

const REUSED_A = "Reused Alpha";
const REUSED_B = "Reused Beta";
const WEAK_ONE = "Weak One";

/** The number rendered in one audit group row. */
async function statValue(key: string): Promise<number> {
  await waitFor(`audit-stat-${key}`);
  const text = await $(`[data-testid="audit-stat-${key}"]`)
    .$('[data-testid="audit-stat-value"]')
    .getText();
  return Number(text);
}

// The audit is recomputed in the background after every write (`thunks.ts`
// re-runs `get_audit` on save), so a group's number is polled rather than read
// once — never a fixed pause.
async function expectStat(key: string, expected: number): Promise<void> {
  await browser.waitUntil(async () => (await statValue(key)) === expected, {
    timeout: 15_000,
    timeoutMsg: `audit-stat-${key} never reached ${expected}`,
  });
}

async function openAudit(): Promise<void> {
  await waitFor("scope-audit");
  await $('[data-testid="scope-audit"]').click();
  await waitFor("audit-score");
}

async function auditScore(): Promise<number> {
  await waitFor("audit-score");
  return Number(await $('[data-testid="audit-score"]').getText());
}

// The rail dial's numeral is an SVG <text> node, which is neither "displayed"
// nor readable by `getText` in every driver — read its textContent instead.
async function railScore(): Promise<string> {
  const dial = $('[data-testid="vault-health-score"]');
  await dial.waitForExist({ timeout: 10_000 });
  return String((await dial.getProperty("textContent")) ?? "").trim();
}

/** Select a login by its title in the list column. */
async function selectLogin(title: string): Promise<void> {
  await waitFor("scope-login");
  await $('[data-testid="scope-login"]').click();
  await waitFor("entry-item");

  const rows = await $$('[data-testid="entry-item"]');
  for (const row of rows) {
    const rowTitle = await row.$('[data-testid="entry-item-title"]').getText();
    if (rowTitle === title) {
      await row.click();
      return;
    }
  }
  throw new Error(`[e2e] no entry row titled "${title}"`);
}

/** Open a login in the editor and replace just its password. */
async function repassword(title: string, password: string): Promise<void> {
  await selectLogin(title);

  await waitFor("edit-entry-button");
  await $('[data-testid="edit-entry-button"]').click();
  await waitFor("entry-sheet");

  // Secrets arrive via `revealEntry`, so the field is empty for a beat after
  // the sheet opens; typing before it lands would be overwritten. Only the
  // arrival is waited on, never the value: `useRevealed` caches by entry id, so
  // a re-opened entry can still hand back its pre-edit secret (known bug, out
  // of scope here — the audit itself recomputes from the saved vault).
  const field = $('input[name="password"]');
  await field.waitForDisplayed({ timeout: 10_000 });
  await browser.waitUntil(async () => (await field.getValue()) !== "", {
    timeout: 10_000,
    timeoutMsg: "the editor never filled in the existing password",
  });

  await field.setValue(password);
  await expect(field).toHaveValue(password);

  await $('[data-testid="save-entry-button"]').click();
  await $('[data-testid="entry-sheet"]').waitForDisplayed({
    reverse: true,
    timeout: 15_000,
  });
}

describe("password audit", () => {
  before(async () => {
    // The Breached group is opt-in (`defaults/audit.ts`, off by default). Pin it
    // so the spec is independent of whatever a previous spec left in
    // localStorage — the reset below wipes the vault, not the webview storage.
    await browser.execute(() =>
      localStorage.setItem("swifty:breachCheck", "false"),
    );

    await resetEmpty(MASTER_PASSWORD);
    await unlock(MASTER_PASSWORD);

    await createLogin({
      title: REUSED_A,
      username: "alpha@example.com",
      password: SHARED_PASSWORD,
    });
    await createLogin({
      title: REUSED_B,
      username: "beta@example.com",
      password: SHARED_PASSWORD,
    });
    await createLogin({
      title: WEAK_ONE,
      username: "weak@example.com",
      password: WEAK_PASSWORD,
    });
  });

  it("scores the vault and counts the weak and reused passwords", async () => {
    await openAudit();

    // Both the rail dial and the pane's own dial render a number.
    await browser.waitUntil(async () => /^\d+$/.test(await railScore()), {
      timeout: 15_000,
      timeoutMsg: "the rail's vault-health dial never showed a score",
    });
    expect(await auditScore()).toBeLessThan(10);

    // One trivially guessable password; both copies of the shared one count.
    await expectStat("weak", 1);
    await expectStat("reused", 2);

    // Opted out of the breach lookup, so the group is not offered at all.
    await expect($('[data-testid="audit-stat-breached"]')).not.toBeDisplayed();
  });

  it("drops the counts and lifts the score once the entries are fixed", async () => {
    await openAudit();
    const before = await auditScore();

    await repassword(WEAK_ONE, FIXED_WEAK_PASSWORD);
    await openAudit();
    await expectStat("weak", 0);
    await expectStat("reused", 2);

    // Breaking the pair clears both of its entries, not just the edited one.
    await repassword(REUSED_B, FIXED_REUSE_PASSWORD);
    await openAudit();
    await expectStat("reused", 0);

    expect(await auditScore()).toBeGreaterThan(before);
  });
});

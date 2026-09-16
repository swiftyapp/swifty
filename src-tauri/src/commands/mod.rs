pub mod app;
pub mod audit;
pub mod auth;
pub mod clipboard;
// E2E-only reset seam. Compiled out of release builds entirely (see e2e.rs for
// the full gating rationale); the registration in lib.rs carries the same cfg.
#[cfg(debug_assertions)]
pub mod e2e;
pub mod env;
pub mod generator;
pub mod import;
// First-run onboarding (connect Drive before a vault exists).
pub mod setup;
pub mod share;
pub mod sync;
pub mod tools;
pub mod vault;
// Creating, switching and renaming the optional additional vaults.
pub mod workspace;

use crate::error::{Error, Result};

// --- getting off the async runtime ------------------------------------------
//
// A `#[tauri::command] fn` without `async` runs inline on the IPC thread, which
// is the main (UI) thread on macOS. `async` moves it to a runtime worker — but a
// worker is not a place to block either, so every command here that does real
// work hands it to the blocking pool through one of the two helpers below.
//
// Two kinds of caller need them. CPU- and disk-bound work (Argon2id, a
// whole-vault re-seal, a SQLCipher snapshot) must not sit on a worker. And the
// Drive transport drives its async calls with `block_on`: that is illegal *on a
// runtime worker*, which is what it would deadlock, but perfectly legal on a
// blocking-pool thread — those are not workers, they exist precisely to be
// blocked.

/// Run `work` on the blocking pool and await its result.
///
/// A join error means the thread panicked or was cancelled; there is no inner
/// result to report, so the join failure itself is surfaced.
pub(crate) async fn blocking<T: Send + 'static>(
    work: impl FnOnce() -> Result<T> + Send + 'static,
) -> Result<T> {
    tauri::async_runtime::spawn_blocking(work)
        .await
        .map_err(|e| Error::Other(e.to_string()))?
}

/// The fire-and-forget form: same pool, nothing to await.
///
/// Used by the flows that report through events rather than through their return
/// value — a consent round trip, a sync run — so the command can return the
/// moment its guards have passed.
pub(crate) fn detached(work: impl FnOnce() + Send + 'static) {
    tauri::async_runtime::spawn_blocking(work);
}

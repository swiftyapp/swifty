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

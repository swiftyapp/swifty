//! Every event the backend pushes at the frontend, and the only way to send one.
//!
//! Names and payload shapes live here rather than at the call sites so the
//! catalogue the frontend subscribes to can be read in one place, and so no
//! caller can invent a third spelling of `{ error }`.

use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::models::EntryMetaDto;
use crate::state::SyncStatus;
use crate::sync::setup::PackInfo;

pub const VAULT_LOCKED: &str = "vault:locked";
pub const VAULT_MERGED: &str = "vault:merged";
pub const SYNC_STATUS: &str = "sync:status";
pub const IMPORT_PROGRESS: &str = "import:progress";
pub const SETUP_DRIVE_PENDING: &str = "setup:drive:pending";
pub const SETUP_DRIVE_PROBED: &str = "setup:drive:probed";
pub const SETUP_DRIVE_ERROR: &str = "setup:drive:error";

#[derive(Serialize, Clone)]
struct Entries {
    entries: Vec<EntryMetaDto>,
}

#[derive(Serialize, Clone)]
struct ErrorText<'a> {
    error: &'a str,
}

#[derive(Serialize, Clone)]
struct Progress {
    done: usize,
    total: usize,
}

/// `null` is an answer — the account holds no vault — not an absence.
#[derive(Serialize, Clone)]
struct Probed {
    file: Option<PackInfo>,
}

pub fn vault_locked(app: &AppHandle) {
    let _ = app.emit(VAULT_LOCKED, ());
}

pub fn vault_merged(app: &AppHandle, entries: Vec<EntryMetaDto>) {
    let _ = app.emit(VAULT_MERGED, Entries { entries });
}

/// The whole of sync, every time anything about it changes. One snapshot
/// rather than one event per transition: the frontend stores it as-is, and
/// neither side has to agree on an order of events.
pub fn sync_status(app: &AppHandle, status: SyncStatus) {
    let _ = app.emit(SYNC_STATUS, status);
}

pub fn import_progress(app: &AppHandle, done: usize, total: usize) {
    let _ = app.emit(IMPORT_PROGRESS, Progress { done, total });
}

pub fn setup_drive_pending(app: &AppHandle) {
    let _ = app.emit(SETUP_DRIVE_PENDING, ());
}

pub fn setup_drive_probed(app: &AppHandle, file: Option<PackInfo>) {
    let _ = app.emit(SETUP_DRIVE_PROBED, Probed { file });
}

pub fn setup_drive_error(app: &AppHandle, error: &str) {
    let _ = app.emit(SETUP_DRIVE_ERROR, ErrorText { error });
}

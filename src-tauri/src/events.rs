//! Every event the backend pushes at the frontend, and the only way to send one.
//!
//! Names and payload shapes live here rather than at the call sites so the
//! catalogue the frontend subscribes to can be read in one place, and so no
//! caller can invent a third spelling of `{ error }`.

use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::models::EntryMetaDto;
use crate::sync::setup::PackInfo;

pub const VAULT_LOCKED: &str = "vault:locked";
pub const VAULT_MERGED: &str = "vault:merged";
pub const SYNC_STARTED: &str = "sync:started";
pub const SYNC_STOPPED: &str = "sync:stopped";
pub const SYNC_PENDING: &str = "sync:pending";
pub const SYNC_CONNECTED: &str = "sync:connected";
pub const SYNC_DISCONNECTED: &str = "sync:disconnected";
pub const SYNC_ERROR: &str = "sync:error";
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

/// A run that ended. `None` is the success: there is nothing else to say about
/// one, and a separate flag would only be a second way to ask the same thing.
#[derive(Serialize, Clone)]
struct Ended {
    error: Option<String>,
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

pub fn sync_started(app: &AppHandle) {
    let _ = app.emit(SYNC_STARTED, ());
}

pub fn sync_stopped(app: &AppHandle, error: Option<String>) {
    let _ = app.emit(SYNC_STOPPED, Ended { error });
}

pub fn sync_pending(app: &AppHandle) {
    let _ = app.emit(SYNC_PENDING, ());
}

pub fn sync_connected(app: &AppHandle) {
    let _ = app.emit(SYNC_CONNECTED, ());
}

pub fn sync_disconnected(app: &AppHandle) {
    let _ = app.emit(SYNC_DISCONNECTED, ());
}

pub fn sync_error(app: &AppHandle, error: &str) {
    let _ = app.emit(SYNC_ERROR, ErrorText { error });
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

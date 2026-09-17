//! Commands for one-time sharing. The logic is in [`crate::share`]; this is the
//! boundary that turns a session into the credentials a Drive call needs.
//!
//! Two rules shape every command here. The session lock is taken, read and
//! released before anything touches the network — a mutex held across an await
//! would stall every other command for a round trip. And the Drive work goes to
//! the blocking pool through [`super::blocking`], which is where the reasoning
//! for that lives.

use tauri::{AppHandle, State};

use super::blocking;

use crate::crypto::Cryptor;
use crate::error::{Error, Result};
use crate::models::Entry;
use crate::session::{store_err, Session};
use crate::share::{self, remote::DrivePublicFetch, ActiveShare, Created};
use crate::state::AppState;
use crate::store::VaultStore;

/// Seal one of this vault's entries and publish it; returns the link.
#[tauri::command]
pub async fn share_create(
    entry_id: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<Created> {
    let (entry, cryptor) = {
        let session = state.session.lock().unwrap();
        sendable(&session)?;
        let record = session
            .store()?
            .get(&entry_id)
            .map_err(store_err)?
            .ok_or(Error::NotFound)?;
        (
            session
                .payload_cipher()?
                .unseal(&record.id, &record.payload)?,
            session.cryptor()?,
        )
    };

    blocking(move || share::create(&share::drive_remote(&app, cryptor), &entry, share::now_ms()))
        .await
}

/// Open a link someone sent. Needs no account and no unlocked vault — the
/// recipient may not even have a vault yet.
#[tauri::command]
pub async fn share_open(link: String) -> Result<Entry> {
    blocking(move || share::open(&DrivePublicFetch, &link, share::now_ms())).await
}

#[tauri::command]
pub async fn share_revoke(
    file_id: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<()> {
    let cryptor = sender_cryptor(&state)?;
    blocking(move || share::revoke(&share::drive_remote(&app, cryptor), &file_id)).await
}

/// The sender's outstanding shares, expired ones swept first.
#[tauri::command]
pub async fn share_list(app: AppHandle, state: State<'_, AppState>) -> Result<Vec<ActiveShare>> {
    let cryptor = sender_cryptor(&state)?;
    blocking(move || share::list(&share::drive_remote(&app, cryptor), share::now_ms())).await
}

/// What the sending side requires. Checked in this order because a locked
/// session also reports `sync_configured == false`, and telling someone to
/// connect Drive when they merely need to unlock is a dead end.
fn sendable(session: &Session) -> Result<()> {
    if !session.is_unlocked() {
        return Err(Error::Locked);
    }
    if !session.sync_configured {
        return Err(Error::SyncNotConfigured);
    }
    Ok(())
}

fn sender_cryptor(state: &State<'_, AppState>) -> Result<Cryptor> {
    let session = state.session.lock().unwrap();
    sendable(&session)?;
    session.cryptor()
}

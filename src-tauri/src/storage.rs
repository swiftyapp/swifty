//! On-disk vault storage under the Tauri app-data dir. Mirrors legacy
//! `application/storage`: ensure-file, utf8 read, overwrite write, `.swftx`
//! export copy. Also handles one-time migration from the Electron location.

use std::fs;
use std::path::PathBuf;
use std::sync::OnceLock;
use tauri::{AppHandle, Manager};

use crate::error::{Error, Result};

pub const VAULT_FILE: &str = "vault.swftx";
pub const GDRIVE_FILE: &str = "auth/gdrive.swftx";

fn app_dir(app: &AppHandle) -> Result<PathBuf> {
    app.path()
        .app_data_dir()
        .map_err(|e| Error::Other(e.to_string()))
}

pub fn vault_path(app: &AppHandle) -> Result<PathBuf> {
    Ok(app_dir(app)?.join(VAULT_FILE))
}

fn gdrive_path(app: &AppHandle) -> Result<PathBuf> {
    Ok(app_dir(app)?.join(GDRIVE_FILE))
}

// Read a file as utf8, returning "" when it doesn't exist (legacy ensure-file).
fn read_file(path: &PathBuf) -> Result<String> {
    if !path.exists() {
        return Ok(String::new());
    }
    Ok(fs::read_to_string(path)?)
}

// Overwrite a file, creating parent dirs as needed.
fn write_file(path: &PathBuf, data: &str) -> Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(path, data)?;
    Ok(())
}

pub fn read_vault(app: &AppHandle) -> Result<String> {
    read_file(&vault_path(app)?)
}

pub fn write_vault(app: &AppHandle, data: &str) -> Result<()> {
    write_file(&vault_path(app)?, data)
}

// Read an arbitrary backup file chosen by the user (absolute path).
pub fn read_backup(path: &str) -> Result<String> {
    Ok(fs::read_to_string(path)?)
}

pub fn read_gdrive(app: &AppHandle) -> Result<String> {
    read_file(&gdrive_path(app)?)
}

pub fn write_gdrive(app: &AppHandle, data: &str) -> Result<()> {
    write_file(&gdrive_path(app)?, data)
}

// Copy the encrypted vault to `dest`, appending `.swftx` if missing (legacy).
pub fn export_vault(app: &AppHandle, dest: PathBuf) -> Result<PathBuf> {
    let dest = match dest.extension() {
        Some(e) if e == "swftx" => dest,
        _ => dest.with_extension("swftx"),
    };
    fs::copy(vault_path(app)?, &dest)?;
    Ok(dest)
}

// Sync is configured when the encrypted gdrive credentials file has content.
pub fn sync_configured(app: &AppHandle) -> bool {
    gdrive_path(app)
        .ok()
        .filter(|p| p.exists())
        .and_then(|p| fs::metadata(p).ok())
        .is_some_and(|m| m.len() > 0)
}

// Legacy Electron userData dir (productName "Swifty"): equals `config_dir/Swifty`
// on all platforms (Roaming\Swifty, ~/Library/Application Support/Swifty, ~/.config/Swifty).
fn legacy_dir() -> Option<PathBuf> {
    dirs::config_dir().map(|d| d.join("Swifty"))
}

// One-time copy of the legacy vault (and gdrive creds) into the new location.
// Idempotent: skips if the new vault already exists or no legacy vault is found.
fn migrate_legacy(app: &AppHandle) -> Result<()> {
    let new_vault = vault_path(app)?;
    if new_vault.exists() {
        return Ok(());
    }
    let Some(legacy) = legacy_dir() else {
        return Ok(());
    };
    let legacy_vault = legacy.join(VAULT_FILE);
    if !legacy_vault.exists() {
        return Ok(());
    }
    if let Some(parent) = new_vault.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::copy(&legacy_vault, &new_vault)?;

    let legacy_gdrive = legacy.join(GDRIVE_FILE);
    if legacy_gdrive.exists() {
        write_gdrive(app, &fs::read_to_string(&legacy_gdrive)?)?;
    }
    Ok(())
}

// Run the migration at most once per process; errors are logged, not fatal.
pub fn ensure_migrated(app: &AppHandle) {
    static DONE: OnceLock<()> = OnceLock::new();
    DONE.get_or_init(|| {
        if let Err(e) = migrate_legacy(app) {
            log::warn!("legacy vault migration failed: {e}");
        }
    });
}

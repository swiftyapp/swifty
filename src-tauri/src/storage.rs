//! On-disk vault storage under the Tauri app-data dir. Mirrors legacy
//! `application/storage`: ensure-file, utf8 read, overwrite write, `.swftx`
//! export copy. Also handles one-time migration from the Electron location.

use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;
use tauri::{AppHandle, Manager};

use crate::error::{Error, Result};

pub const VAULT_FILE: &str = "vault.swftx";
pub const DB_FILE: &str = "vault.db";
// Pre-change recovery snapshot of the encrypted DB, written next to it before the
// destructive change-master-password sequence (see `change_master_password`).
pub const DB_REKEY_BACKUP_FILE: &str = "vault.db.rekey-backup";
// Plaintext KDF descriptor stored next to the DB. It holds the Argon2id params +
// salt (public by design) and is read *before* deriving the key — the salt/params
// cannot live inside the encrypted DB, since deriving the key is what opens it.
pub const KDF_SIDECAR_FILE: &str = "vault.kdf.json";
// Plaintext failed-unlock backoff state (T-AUTH-3), stored next to the DB for the
// same reason as the KDF sidecar: a wrong password never opens the encrypted DB,
// so the attempt counter cannot live in the `meta` table. Public by design —
// it only ever holds a counter and a timestamp, nothing secret.
pub const LOCKOUT_SIDECAR_FILE: &str = "vault.lock.json";
pub const GDRIVE_FILE: &str = "auth/gdrive.swftx";
// Marker for "biometric unlock is enabled". The key itself lives in the OS
// secure store; this flag lets us report availability without a biometric prompt.
// Its contents name the gate the key was enrolled behind (`secure_store::GateMode`)
// — not a secret: it says *how* the key is gated, never anything about the key.
pub const BIOMETRIC_FILE: &str = "biometric.enabled";

fn app_dir(app: &AppHandle) -> Result<PathBuf> {
    // E2E test isolation: point the whole data dir at a fresh temp dir per run.
    if let Ok(dir) = std::env::var("SWIFTY_DB_DIR") {
        return Ok(PathBuf::from(dir));
    }

    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| Error::Other(e.to_string()))?;
    // Dev builds share the prod identifier, so isolate their data in a subdir
    // to avoid mutating the real vault while iterating.
    Ok(if cfg!(debug_assertions) {
        dir.join("dev")
    } else {
        dir
    })
}

pub fn vault_path(app: &AppHandle) -> Result<PathBuf> {
    Ok(app_dir(app)?.join(VAULT_FILE))
}

// The SQLCipher database that supersedes the JSON vault.
pub fn db_path(app: &AppHandle) -> Result<PathBuf> {
    Ok(app_dir(app)?.join(DB_FILE))
}

// Working space for the sync engine: the snapshot it packs for upload and the
// database it opens a pulled snapshot in. Inside the (dev-isolated) data dir so
// a debug build never writes scratch beside the real vault, and so the files
// inherit the 0700 directory mode. Everything written here is SQLCipher
// ciphertext, and every writer removes its own files (see `pack::Scratch`).
pub fn sync_scratch_dir(app: &AppHandle) -> Result<PathBuf> {
    Ok(app_dir(app)?.join("sync-scratch"))
}

// Cached website favicons (list-row identity). Safe to wipe; refetched lazily.
pub fn icons_dir(app: &AppHandle) -> Result<PathBuf> {
    Ok(app_dir(app)?.join("icons"))
}

// Sibling recovery snapshot of the DB (change-master-password rollback point).
pub fn db_rekey_backup_path(app: &AppHandle) -> Result<PathBuf> {
    Ok(app_dir(app)?.join(DB_REKEY_BACKUP_FILE))
}

// Whether the SQLite store has been created (non-empty file present).
pub fn db_exists(app: &AppHandle) -> bool {
    db_path(app)
        .ok()
        .filter(|p| p.exists())
        .and_then(|p| fs::metadata(p).ok())
        .is_some_and(|m| m.len() > 0)
}

fn gdrive_path(app: &AppHandle) -> Result<PathBuf> {
    Ok(app_dir(app)?.join(GDRIVE_FILE))
}

// Public because the sync restore path addresses the sidecar by path (its core
// runs without an `AppHandle`) rather than duplicating the layout constants.
pub fn kdf_sidecar_path(app: &AppHandle) -> Result<PathBuf> {
    Ok(app_dir(app)?.join(KDF_SIDECAR_FILE))
}

// The KDF descriptor JSON, or `None` when absent (a sidecar-less legacy/dev DB).
pub fn read_kdf_sidecar(app: &AppHandle) -> Result<Option<String>> {
    let path = kdf_sidecar_path(app)?;
    if !path.exists() {
        return Ok(None);
    }
    Ok(Some(fs::read_to_string(path)?))
}

// Write (or overwrite) the KDF descriptor sidecar. The sidecar is the single
// source of truth for opening the vault, so the write is durable + atomic: a
// crash never leaves it truncated.
pub fn write_kdf_sidecar(app: &AppHandle, json: &str) -> Result<()> {
    atomic_write_file(&kdf_sidecar_path(app)?, json)
}

// Remove a SQLite database and its WAL/SHM siblings, ignoring whatever is
// already absent. Both callers (the pack scratch snapshot, the failed-restore
// rollback) must leave no *half* a database behind: a stale `-wal` beside a
// missing or recreated main file is its own corruption, not a clean slate.
pub fn remove_db_files(path: &Path) {
    let _ = fs::remove_file(path);
    for suffix in ["-wal", "-shm"] {
        let mut sibling = path.as_os_str().to_owned();
        sibling.push(suffix);
        let _ = fs::remove_file(PathBuf::from(sibling));
    }
}

fn lockout_sidecar_path(app: &AppHandle) -> Result<PathBuf> {
    Ok(app_dir(app)?.join(LOCKOUT_SIDECAR_FILE))
}

// The failed-unlock backoff state JSON, or `None` when absent (no failed
// attempts recorded yet, or a fresh vault).
pub fn read_lockout_sidecar(app: &AppHandle) -> Result<Option<String>> {
    let path = lockout_sidecar_path(app)?;
    if !path.exists() {
        return Ok(None);
    }
    Ok(Some(fs::read_to_string(path)?))
}

// Write (or overwrite) the backoff state sidecar, atomically (same durability
// rationale as the KDF sidecar: never leave a torn/partial file behind).
pub fn write_lockout_sidecar(app: &AppHandle, json: &str) -> Result<()> {
    atomic_write_file(&lockout_sidecar_path(app)?, json)
}

// Durably overwrite `path`: write a temp sibling, fsync it, atomically rename it
// over the target, then fsync the directory. The target ends up as either the
// complete old bytes or the complete new bytes — never a truncated/empty file.
// A leftover `<path>.tmp` (from a crash before the rename) is ignored by readers,
// which only ever open the target path.
pub fn atomic_write_file(path: &Path, data: &str) -> Result<()> {
    let parent = path
        .parent()
        .ok_or_else(|| Error::Other("sidecar path has no parent directory".into()))?;
    fs::create_dir_all(parent)?;

    let mut tmp = path.as_os_str().to_owned();
    tmp.push(".tmp");
    let tmp = PathBuf::from(tmp);

    let mut file = fs::File::create(&tmp)?;
    file.write_all(data.as_bytes())?;
    file.sync_all()?;
    drop(file);

    fs::rename(&tmp, path)?;

    // Persist the directory entry for the rename where the platform supports it
    // (opening a directory as a file fails on Windows — best-effort there).
    if let Ok(dir) = fs::File::open(parent) {
        let _ = dir.sync_all();
    }
    Ok(())
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

// The recorded gate marker, or `None` when biometric unlock is not enabled.
// Enrollment decides the gate once; every later retrieval reads it back from
// here rather than re-probing what the platform would do today.
pub fn biometric_marker(app: &AppHandle) -> Option<String> {
    let path = app_dir(app).ok()?.join(BIOMETRIC_FILE);
    fs::read_to_string(path).ok()
}

// Whether the user opted into biometric unlock (marker file present).
pub fn biometric_enrolled(app: &AppHandle) -> bool {
    app_dir(app)
        .map(|d| d.join(BIOMETRIC_FILE).exists())
        .unwrap_or(false)
}

// Record the enrolled gate, or clear the marker entirely with `None`. Idempotent.
pub fn set_biometric_marker(app: &AppHandle, marker: Option<&str>) -> Result<()> {
    let path = app_dir(app)?.join(BIOMETRIC_FILE);
    match marker {
        Some(marker) => write_file(&path, marker),
        None if path.exists() => {
            fs::remove_file(&path)?;
            Ok(())
        }
        None => Ok(()),
    }
}

pub fn sync_configured(app: &AppHandle) -> bool {
    // A single metadata call answers both "exists" and "non-empty".
    gdrive_path(app)
        .ok()
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

#[cfg(test)]
mod tests {
    use super::atomic_write_file;
    use std::fs;
    use std::path::{Path, PathBuf};
    use std::sync::atomic::{AtomicU64, Ordering};

    fn tmp_sidecar() -> PathBuf {
        static N: AtomicU64 = AtomicU64::new(0);
        let dir = std::env::temp_dir().join(format!(
            "swifty-storage-{}-{}",
            std::process::id(),
            N.fetch_add(1, Ordering::SeqCst)
        ));
        fs::create_dir_all(&dir).unwrap();
        dir.join("vault.kdf.json")
    }

    fn tmp_sibling(path: &Path) -> PathBuf {
        let mut tmp = path.to_path_buf().into_os_string();
        tmp.push(".tmp");
        PathBuf::from(tmp)
    }

    #[test]
    fn atomic_write_round_trips_and_overwrites() {
        let path = tmp_sidecar();
        atomic_write_file(&path, "{\"algo\":\"argon2id\"}").unwrap();
        assert_eq!(
            fs::read_to_string(&path).unwrap(),
            "{\"algo\":\"argon2id\"}"
        );

        // Overwrite in place with shorter content — the target is fully replaced.
        atomic_write_file(&path, "{}").unwrap();
        assert_eq!(fs::read_to_string(&path).unwrap(), "{}");

        // A completed write leaves no temp file behind.
        assert!(!tmp_sibling(&path).exists());
    }

    #[test]
    fn lockout_sidecar_round_trips_through_the_atomic_writer() {
        // Same primitive as the KDF sidecar, exercised with the lockout shape.
        let path = tmp_sidecar().with_file_name("vault.lock.json");
        let json = "{\"failed_attempts\":4,\"locked_until_ms\":1700000002000}";
        atomic_write_file(&path, json).unwrap();
        assert_eq!(fs::read_to_string(&path).unwrap(), json);
    }

    #[test]
    fn leftover_temp_file_does_not_affect_the_target() {
        let path = tmp_sidecar();
        atomic_write_file(&path, "real").unwrap();

        // Simulate a crash before a prior rename: a stale, partial temp sibling.
        fs::write(tmp_sibling(&path), "garbage-partial").unwrap();

        // Reading the sidecar (the target path) is unaffected by the temp file.
        assert_eq!(fs::read_to_string(&path).unwrap(), "real");
    }
}

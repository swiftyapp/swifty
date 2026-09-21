//! On-disk vault storage under the Tauri app-data dir: ensure-file, utf8 read,
//! overwrite write, `.swftx` export copy.

use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

use crate::error::{Error, Result};

pub const DB_FILE: &str = "vault.db";
// Pre-change recovery snapshot of the encrypted DB, written next to it before the
// destructive change-master-password sequence (see `change_master_password`).
pub const DB_REKEY_BACKUP_FILE: &str = "vault.db.rekey-backup";
// Plaintext KDF descriptor stored next to the DB. It holds the Argon2id params +
// salt (public by design) and is read *before* deriving the key — the salt/params
// cannot live inside the encrypted DB, since deriving the key is what opens it.
pub const KDF_SIDECAR_FILE: &str = "vault.kdf.json";
// Pre-change recovery snapshot of the KDF sidecar, taken alongside the DB one.
// Rolling the DB back to its old key is only half a rollback: the descriptor that
// says how to derive that key has to roll back with it, or nothing opens.
pub const KDF_SIDECAR_REKEY_BACKUP_FILE: &str = "vault.kdf.json.rekey-backup";
// Plaintext failed-unlock backoff state (T-AUTH-3), stored next to the DB for the
// same reason as the KDF sidecar: a wrong password never opens the encrypted DB,
// so the attempt counter cannot live in the `meta` table. Public by design —
// it only ever holds a counter and a timestamp, nothing secret.
pub const LOCKOUT_SIDECAR_FILE: &str = "vault.lock.json";
// User preferences (theme, locale, auto-lock, …). Plaintext and readable while
// locked by design: the shell has to know what to draw before the vault opens.
pub const SETTINGS_FILE: &str = "settings.json";
pub const GDRIVE_FILE: &str = "auth/gdrive.swftx";
// Marker for "biometric unlock is enabled". The key itself lives in the OS
// secure store; this flag lets us report availability without a biometric prompt.
// Its contents name the gate the key was enrolled behind (`secure_store::GateMode`)
// — not a secret: it says *how* the key is gated, never anything about the key.
pub const BIOMETRIC_FILE: &str = "biometric.enabled";

// The data dir for the whole install: what every workspace hangs off, and where
// the workspace registry itself lives.
pub fn root_dir(app: &AppHandle) -> Result<PathBuf> {
    // E2E test isolation: point the whole data dir at a fresh temp dir per run.
    // Debug builds only, like the reset command that depends on it
    // (`commands::e2e`): a release binary must not let a variable in its
    // environment decide where the vault is written — or read from.
    if cfg!(debug_assertions) {
        if let Ok(dir) = std::env::var("ROWEL_DB_DIR") {
            return Ok(PathBuf::from(dir));
        }
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

// The active workspace's own directory — which, for the primary, IS the root
// (see `workspace::dir_of`). Everything belonging to one vault resolves through
// here, so switching workspaces moves the whole set of paths at once.
//
// Crate-visible for callers that need several of one workspace's files to be
// guaranteed to belong to the *same* workspace: resolving each path separately
// re-reads the active id each time, so a switch landing between two lookups
// hands back a mixed set (see `auth::recover_interrupted_rekey`).
pub(crate) fn workspace_dir(app: &AppHandle) -> Result<PathBuf> {
    Ok(crate::workspace::dir_of(
        &root_dir(app)?,
        &crate::workspace::active_id(app),
    ))
}

// The SQLCipher database that supersedes the JSON vault.
pub fn db_path(app: &AppHandle) -> Result<PathBuf> {
    Ok(workspace_dir(app)?.join(DB_FILE))
}

// Working space for the sync engine: the snapshot it packs for upload and the
// database it opens a pulled snapshot in. Inside the (dev-isolated) data dir so
// a debug build never writes scratch beside the real vault, and so the files
// inherit the 0700 directory mode. Everything written here is SQLCipher
// ciphertext, and every writer removes its own files (see `pack::Scratch`).
pub fn sync_scratch_dir(app: &AppHandle) -> Result<PathBuf> {
    Ok(workspace_dir(app)?.join("sync-scratch"))
}

// Favicons used to be cached as loose `{host}.uri` / `{host}.miss` files here.
// The file *names* were the vault's host list in the clear — every site the
// user has an account at, including ones they had deleted — sitting beside the
// encrypted database for any file-level backup to pick up. The cache now lives
// in a `favicons` table inside the SQLCipher vault, so this directory is only
// ever leftovers: removed whole, once, at startup (`lib.rs`). At startup
// rather than at the first lookup, because the list is on disk whether or not
// this install ever looks an icon up again — an empty vault, a workspace whose
// rows have no hosts, every host rejected — and a cache that is never read is
// exactly the one that would keep it forever. Best effort: a directory we
// could not remove is logged, not fatal, and is tried again next launch.
pub fn remove_legacy_icons_dir(app: &AppHandle) {
    let Ok(dir) = root_dir(app).map(|root| root.join("icons")) else {
        return;
    };
    if dir.exists() {
        if let Err(e) = fs::remove_dir_all(&dir) {
            log::warn!("could not remove the legacy favicon directory: {e}");
        }
    }
}

// Whether the SQLite store has been created (non-empty file present).
pub fn db_exists(app: &AppHandle) -> bool {
    db_path(app)
        .ok()
        .filter(|p| p.exists())
        .and_then(|p| fs::metadata(p).ok())
        .is_some_and(|m| m.len() > 0)
}

// Public to the crate because the sync token file's guarded transitions are
// built on a plain path (`sync::auth::TokenFile`) so they can be exercised
// without an `AppHandle`.
pub(crate) fn gdrive_path(app: &AppHandle) -> Result<PathBuf> {
    Ok(workspace_dir(app)?.join(GDRIVE_FILE))
}

// Public because the sync restore path addresses the sidecar by path (its core
// runs without an `AppHandle`) rather than duplicating the layout constants.
pub fn kdf_sidecar_path(app: &AppHandle) -> Result<PathBuf> {
    Ok(workspace_dir(app)?.join(KDF_SIDECAR_FILE))
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

// Move a SQLite database *and* its WAL/SHM siblings, for the one caller that
// relocates a whole vault (promoting a workspace into the root when the primary
// is deleted). The main file alone is not the database: a `-wal` left behind
// holds committed pages the moved file does not, and the next open would read
// an older vault back with no sign that anything was lost. Siblings that are
// not there are skipped — a cleanly closed database has none.
pub fn rename_db_files(from: &Path, to: &Path) -> Result<()> {
    fs::rename(from, to)?;
    for suffix in ["-wal", "-shm"] {
        let sibling = |path: &Path| {
            let mut name = path.as_os_str().to_owned();
            name.push(suffix);
            PathBuf::from(name)
        };
        let source = sibling(from);
        if source.exists() {
            fs::rename(source, sibling(to))?;
        }
    }
    Ok(())
}

// Preferences belong to the install, not to a vault, so they sit on the root
// and follow the user across workspaces.
pub fn settings_path(app: &AppHandle) -> Result<PathBuf> {
    Ok(root_dir(app)?.join(SETTINGS_FILE))
}

// Write (or overwrite) the preferences file. Atomic like the sidecars: a torn
// write here would boot the next launch on the defaults.
pub fn write_settings(app: &AppHandle, json: &str) -> Result<()> {
    atomic_write_file(&settings_path(app)?, json)
}

fn lockout_sidecar_path(app: &AppHandle) -> Result<PathBuf> {
    Ok(workspace_dir(app)?.join(LOCKOUT_SIDECAR_FILE))
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

// Durably replace `path`: create a uniquely named temp sibling, fsync it,
// atomically rename it over the target, then fsync the directory. The target
// ends up as either the complete old bytes or the complete new bytes — never a
// truncated/empty file. `write` is injected so failure after a partial temp
// write is testable; the partial sibling is removed on every failure.
//
// `private` makes the temp sibling owner-readable from the instant it exists
// (`owner_only::create_new`: `0600` on Unix, a protected DACL supplied at
// creation on Windows), so there is no moment at which the umask or the
// folder's inherited permissions govern it — a handle opened in such a moment
// would keep its access after the permissions changed — and the replaced file
// keeps that restriction whatever an existing file at `path` allowed.
fn atomic_replace_with<F>(path: &Path, private: bool, write: F) -> Result<()>
where
    F: FnOnce(&mut fs::File) -> std::io::Result<()>,
{
    let parent = path
        .parent()
        .ok_or_else(|| Error::Other("destination has no parent directory".into()))?;
    fs::create_dir_all(parent)?;

    let mut staged = Staged::from(create_temp_sibling(path, private)?);
    write(staged.file())?;
    staged.file().sync_all()?;
    staged.close();
    fs::rename(&staged.path, path)?;
    staged.keep();

    // Persist the directory entry for the rename where the platform supports it
    // (opening a directory as a file fails on Windows — best-effort there).
    if let Ok(dir) = fs::File::open(parent) {
        let _ = dir.sync_all();
    }
    Ok(())
}

// A temp sibling that is removed unless the replacement it was staged for goes
// through. In `Drop` so every early exit — a failed write, sync or rename —
// takes it with it. It owns the open handle too, and closes it *before* the
// removal: on Windows the private writer opens the file with no delete
// sharing, so a removal attempted while the handle is still open would fail
// and leave the partial plaintext behind. Two separate locals would drop in
// the wrong order for that (last declared, first dropped).
struct Staged {
    path: PathBuf,
    file: Option<fs::File>,
    remove: bool,
}

impl From<(PathBuf, fs::File)> for Staged {
    fn from((path, file): (PathBuf, fs::File)) -> Self {
        Self {
            path,
            file: Some(file),
            remove: true,
        }
    }
}

impl Staged {
    fn file(&mut self) -> &mut fs::File {
        self.file
            .as_mut()
            .expect("closed only once, before the rename")
    }

    // Release the handle so the file can be renamed (and, on failure, removed).
    fn close(&mut self) {
        self.file.take();
    }

    fn keep(mut self) {
        self.remove = false;
    }
}

impl Drop for Staged {
    fn drop(&mut self) {
        self.close();
        if self.remove {
            let _ = fs::remove_file(&self.path);
        }
    }
}

// A fresh sibling of `path` — `<name>.<random>.tmp` beside it — created for
// writing, and never over an existing file. Owner-only from creation when
// `private`; otherwise a plain file that keeps the `0600` these temp files
// have always had on Unix.
fn create_temp_sibling(path: &Path, private: bool) -> Result<(PathBuf, fs::File)> {
    let name = path
        .file_name()
        .ok_or_else(|| Error::Other("destination has no file name".into()))?;
    for _ in 0..8 {
        let mut candidate = name.to_os_string();
        candidate.push(format!(".{:016x}.tmp", rand::random::<u64>()));
        let candidate = path.with_file_name(candidate);
        let created = if private {
            crate::owner_only::create_new(&candidate)
        } else {
            let mut options = fs::OpenOptions::new();
            options.write(true).create_new(true);
            #[cfg(unix)]
            {
                use std::os::unix::fs::OpenOptionsExt;
                options.mode(0o600);
            }
            options.open(&candidate)
        };
        match created {
            Ok(file) => return Ok((candidate, file)),
            Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(e) => return Err(e.into()),
        }
    }
    Err(Error::Other(
        "could not find a free name for a temporary sibling".into(),
    ))
}

/// Atomically write the UTF-8 sidecars that gate vault opening and lockout.
pub fn atomic_write_file(path: &Path, data: &str) -> Result<()> {
    atomic_replace_with(path, false, |file| file.write_all(data.as_bytes()))
}

/// Atomically replace a secret with one only its owner can read: `0600` on
/// Unix, an owner-and-SYSTEM protected DACL on Windows — regardless of the
/// umask, of the folder's inheritable permissions, or of how an existing file
/// at `path` was permissioned.
pub fn atomic_write_private(path: &Path, data: &[u8]) -> Result<()> {
    atomic_replace_with(path, true, |file| file.write_all(data))
}

// Read a file as utf8, returning "" when it doesn't exist (legacy ensure-file).
pub(crate) fn read_file(path: &Path) -> Result<String> {
    if !path.exists() {
        return Ok(String::new());
    }
    Ok(fs::read_to_string(path)?)
}

/// Read a whole file the user pointed at, refusing anything past `cap`.
///
/// Every decision here is made on one open handle, and there is no `stat`
/// before it: a `stat` and the open that follows are two different files
/// whenever the path is swapped in between, so anything the first one settled
/// the second would have to settle again. The handle is the one thing that
/// cannot be exchanged under us. What it has to say is that this is a regular
/// file: a FIFO reports a length of zero and then serves bytes for as long as a
/// writer feels like it, and a device serves them without end.
///
/// `take(cap + 1)` is what bounds the read. The extra byte is how a file at
/// the cap is told from one past it without trusting any reported length — if
/// it arrives, the file is too large and nothing beyond it is ever read.
pub fn read_regular_file_capped(path: &Path, cap: u64) -> Result<Vec<u8>> {
    let file = open_without_blocking(path)?;
    if !file.metadata()?.file_type().is_file() {
        return Err(not_a_regular_file());
    }

    let mut bytes = Vec::new();
    file.take(cap.saturating_add(1)).read_to_end(&mut bytes)?;
    if bytes.len() as u64 > cap {
        return Err(Error::FileTooLarge);
    }
    Ok(bytes)
}

/// Open for reading without letting the open itself block: `O_NONBLOCK` is what
/// makes opening a writer-less FIFO return a handle instead of parking until
/// some writer turns up, which is what lets the check above be made on the
/// handle rather than guessed at from a `stat` beforehand. On a regular file the
/// flag means nothing — it governs the open and, afterwards, reads of the very
/// things this refuses.
#[cfg(unix)]
fn open_without_blocking(path: &Path) -> Result<fs::File> {
    use std::os::unix::fs::OpenOptionsExt;

    Ok(fs::OpenOptions::new()
        .read(true)
        .custom_flags(libc::O_NONBLOCK)
        .open(path)?)
}

/// No such flag off Unix, and no FIFO at a user-picked path to need it: a
/// Windows named pipe is addressed as `\\.\pipe\...`, not as a file in a folder.
#[cfg(not(unix))]
fn open_without_blocking(path: &Path) -> Result<fs::File> {
    Ok(fs::File::open(path)?)
}

fn not_a_regular_file() -> Error {
    Error::Other("that path is not a regular file".into())
}

// What the importer can afford to hold, not what the old app could write. The
// import decodes the file one layer at a time and frees each layer as the next
// is built from it, so the peak is the file plus the base64 output beside it
// for that one step — about 1.75x the file — and every step after that is
// smaller. The app ships on iOS, where a foreground process on a 3 GB device is
// killed around 1.3 GiB resident (an approximate, device-dependent figure), so
// 256 MiB peaks at well under half a gigabyte and stays far inside that with
// the app's own baseline on top.
//
// It turns away no real backup. A vault is text only — there are no
// attachments — and a typical entry is a few hundred bytes of fields, about a
// kilobyte once hex-encoded and wrapped in base64, so 256 MiB is on the order
// of a quarter of a million entries. (Nothing the legacy Electron app wrote
// came near even the old limit: the whole hex backup was one V8 string, and
// those stop just under 1 GiB.)
//
// The cap also has to exist at all so that a file which is not a backup of ours
// cannot be buffered and decoded before the AES-GCM tag — checked at the very
// end of all of it — gets to reject it.
const MAX_BACKUP_BYTES: u64 = 256 * 1024 * 1024;

// Read an arbitrary backup file chosen by the user (absolute path).
pub fn read_backup(path: &str) -> Result<String> {
    let bytes = read_regular_file_capped(Path::new(path), MAX_BACKUP_BYTES)?;
    String::from_utf8(bytes).map_err(|_| Error::FileNotText)
}

// The sealed Drive tokens, into a workspace directory named outright rather
// than the active one: for a workspace being made *beside* the open one, whose
// paths must stay where they are (`commands::autojoin`). The active
// workspace's own token file is read and written by `sync::auth::TokenFile`,
// which holds its path.
//
// Atomic, so a crash mid-write leaves the previous grant rather than a
// truncated file that reads as "not connected" — and owner-only from creation,
// like every other secret the app writes: the seal is the real protection, the
// mode is the second line.
pub fn write_gdrive_in(dir: &Path, data: &str) -> Result<()> {
    atomic_write_private(&dir.join(GDRIVE_FILE), data.as_bytes())
}

// Remove the token file, whatever state a failed write left it in. "No file" is
// the goal, so an already-absent one is success — but every other failure is
// reported rather than swallowed: a token file that outlives a disconnect is a
// live refresh token, and a caller told the delete worked would never know.
pub fn remove_gdrive(app: &AppHandle) -> Result<()> {
    remove_if_present(&gdrive_path(app)?)
}

// The file-level half, on a plain path so it is testable without an `AppHandle`.
pub(crate) fn remove_if_present(path: &Path) -> Result<()> {
    match fs::remove_file(path) {
        Err(e) if e.kind() != std::io::ErrorKind::NotFound => Err(e.into()),
        _ => Ok(()),
    }
}

// The recorded gate marker, or `None` when biometric unlock is not enabled.
// Enrollment decides the gate once; every later retrieval reads it back from
// here rather than re-probing what the platform would do today.
pub fn biometric_marker(app: &AppHandle) -> Option<String> {
    let path = workspace_dir(app).ok()?.join(BIOMETRIC_FILE);
    fs::read_to_string(path).ok()
}

// Whether the user opted into biometric unlock (marker file present).
pub fn biometric_enrolled(app: &AppHandle) -> bool {
    workspace_dir(app)
        .map(|d| d.join(BIOMETRIC_FILE).exists())
        .unwrap_or(false)
}

// Record the enrolled gate, or clear the marker entirely with `None`. Idempotent.
// Atomic like the sidecars: a torn marker would read as the legacy gate
// (`GateMode::from_marker`) and send the next unlock through the wrong one.
pub fn set_biometric_marker(app: &AppHandle, marker: Option<&str>) -> Result<()> {
    let path = workspace_dir(app)?.join(BIOMETRIC_FILE);
    match marker {
        Some(marker) => atomic_write_file(&path, marker),
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

#[cfg(test)]
mod tests {
    use super::{
        atomic_replace_with, atomic_write_file, read_backup, read_regular_file_capped,
        remove_if_present, Error,
    };
    use std::fs;
    use std::io::{self, Write};
    use std::path::{Path, PathBuf};
    use std::sync::atomic::{AtomicU64, Ordering};

    fn tmp_sidecar() -> PathBuf {
        static N: AtomicU64 = AtomicU64::new(0);
        let dir = std::env::temp_dir().join(format!(
            "rowel-storage-{}-{}",
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
    fn a_file_past_the_cap_is_refused_without_being_read_whole() {
        let path = tmp_sidecar().with_file_name("huge.swftx");
        // Sized, not written: a sparse 64 MiB file against a 16-byte cap, so a
        // pass that buffered it whole would be doing something this one does not.
        let file = fs::File::create(&path).unwrap();
        file.set_len(64 * 1024 * 1024).unwrap();
        drop(file);

        let err = read_regular_file_capped(&path, 16).unwrap_err();
        assert!(matches!(err, Error::FileTooLarge), "{err}");
    }

    #[test]
    fn a_file_exactly_at_the_cap_is_accepted() {
        let path = tmp_sidecar().with_file_name("exact.swftx");
        fs::write(&path, "deadbeef").unwrap();
        assert_eq!(read_regular_file_capped(&path, 8).unwrap(), b"deadbeef");
    }

    #[test]
    fn a_directory_is_not_a_file_to_read() {
        let dir = tmp_sidecar().parent().unwrap().to_path_buf();
        let err = read_regular_file_capped(&dir, 1024).unwrap_err();
        assert!(matches!(err, Error::Other(_) | Error::Io(_)), "{err}");
    }

    #[cfg(unix)]
    #[test]
    fn a_fifo_is_refused_rather_than_opened() {
        let path = tmp_sidecar().with_file_name("pipe.swftx");
        let made = std::process::Command::new("mkfifo")
            .arg(&path)
            .status()
            .unwrap();
        assert!(made.success());

        // Nothing is writing to this pipe, so a blocking open would park here
        // until something did rather than fail — the test finishing is half of
        // what it asserts, and `O_NONBLOCK` is what makes it finish.
        let err = read_regular_file_capped(&path, 1024).unwrap_err();
        assert!(matches!(err, Error::Other(_)), "{err}");
        let _ = fs::remove_file(&path);
    }

    #[test]
    fn a_backup_under_the_cap_is_read_whole() {
        let path = tmp_sidecar().with_file_name("small.swftx");
        fs::write(&path, "deadbeef").unwrap();
        assert_eq!(read_backup(path.to_str().unwrap()).unwrap(), "deadbeef");
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

    #[test]
    fn a_failed_replacement_keeps_the_complete_old_file() {
        let path = tmp_sidecar();
        fs::write(&path, "complete old bytes").unwrap();

        let result = atomic_replace_with(&path, true, |temp| {
            temp.write_all(b"partial new bytes")?;
            Err(io::Error::new(io::ErrorKind::StorageFull, "disk full"))
        });

        assert!(result.is_err());
        assert_eq!(fs::read_to_string(&path).unwrap(), "complete old bytes");
        assert_eq!(fs::read_dir(path.parent().unwrap()).unwrap().count(), 1);
    }

    // The delete behind a Drive disconnect: gone is the goal, so already-gone is
    // success — but a delete that actually failed must not read as one, or a
    // caller would report a disconnect over a token file that is still there.
    #[test]
    fn removing_an_absent_file_succeeds_and_a_present_one_goes() {
        let path = tmp_sidecar().with_file_name("gdrive.swftx");
        remove_if_present(&path).unwrap();

        fs::write(&path, "sealed tokens").unwrap();
        remove_if_present(&path).unwrap();
        assert!(!path.exists());
    }
}

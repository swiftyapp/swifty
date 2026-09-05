//! Writing an export to wherever the user says, on two platforms that mean
//! opposite things by "save dialog".
//!
//! Desktop hands back a destination to write to. iOS has no such API: its only
//! export mechanism is "move this file to a place the user picks", so the
//! plugin fakes the desktop shape by creating an *empty* file in the app's
//! Documents directory and exporting that (`tauri-plugin-dialog` 2.7.2,
//! `ios/Sources/DialogPlugin.swift`: `saveFileDialog` at line 138 writes `""`
//! to `<Documents>/<fileName>` at lines 148-154, but only if nothing is there
//! yet, then hands that file to
//! `UIDocumentPickerViewController(url:in:.exportToService)` at line 168, which
//! copies it at pick time). The copy has therefore already happened by the time
//! the path comes back, so writing to it achieves nothing: on iOS the content
//! has to be in place *before* the dialog opens.
//!
//! Both callers (`vault::export_vault`, `import::export_entries`) go through
//! [`save_export`], so that ordering lives in exactly one place.

use std::path::{Path, PathBuf};

use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;
use zeroize::Zeroize;

use crate::error::{Error, Result};

/// Ask the user where `file_name` should go and put `bytes` there.
///
/// `filter` labels the file-type filter the desktop dialog shows; the extension
/// it filters on is `file_name`'s. Returns the chosen path, or `None` if the
/// dialog was dismissed.
pub async fn save_export(
    app: &AppHandle,
    file_name: &str,
    filter: &str,
    bytes: Vec<u8>,
) -> Result<Option<PathBuf>> {
    let extension = Path::new(file_name)
        .extension()
        .map(|e| e.to_string_lossy().into_owned())
        .unwrap_or_default();

    #[cfg(mobile)]
    {
        use tauri::Manager;

        let dir = app
            .path()
            .document_dir()
            .map_err(|e| Error::Other(e.to_string()))?;
        std::fs::create_dir_all(&dir)?;
        stage_then(&dir.join(file_name), bytes, || {
            ask(app, file_name, filter, &extension)
        })
        .await
    }
    #[cfg(desktop)]
    {
        let Some(dest) = ask(app, file_name, filter, &extension).await? else {
            return Ok(None);
        };
        let dest = with_extension(dest, &extension);
        write_and_scrub(&dest, bytes)?;
        Ok(Some(dest))
    }
}

/// Put the bytes at `staged`, run the dialog, then take `staged` away again
/// however the dialog ended — the `.csv` export is plaintext and must not be
/// left sitting in a directory the Files app can browse.
///
/// Split out from [`save_export`] (and compiled on every platform) so the
/// ordering the iOS dialog demands can be tested without one.
#[cfg(any(mobile, test))]
async fn stage_then<F, Fut>(staged: &Path, bytes: Vec<u8>, dialog: F) -> Result<Option<PathBuf>>
where
    F: FnOnce() -> Fut,
    Fut: std::future::Future<Output = Result<Option<PathBuf>>>,
{
    let _staged = Staged::write(staged, bytes)?;
    dialog().await
}

/// A file that exists only as long as this value does.
///
/// The removal lives in `Drop` rather than after the dialog so that *every* way
/// out of the scope — a dismissed dialog, a failed dialog, a write that ran out
/// of disk halfway, a panic — takes the file with it. Cleanup that has to be
/// remembered at each exit is cleanup that one of them will forget.
#[cfg(any(mobile, test))]
struct Staged(PathBuf);

#[cfg(any(mobile, test))]
impl Staged {
    /// Claim the path first, then fill it: a write that fails partway has
    /// already created the file, and only a guard that exists by then removes it.
    fn write(path: &Path, bytes: Vec<u8>) -> Result<Self> {
        let staged = Self(path.to_path_buf());
        write_and_scrub(path, bytes)?;
        Ok(staged)
    }
}

#[cfg(any(mobile, test))]
impl Drop for Staged {
    fn drop(&mut self) {
        let _ = std::fs::remove_file(&self.0);
    }
}

// Present the save dialog off the main thread; blocking on it there would
// deadlock the very event loop the dialog needs.
async fn ask(
    app: &AppHandle,
    file_name: &str,
    filter: &str,
    extension: &str,
) -> Result<Option<PathBuf>> {
    let app = app.clone();
    let file_name = file_name.to_string();
    let filter = filter.to_string();
    let extension = extension.to_string();
    let chosen = tauri::async_runtime::spawn_blocking(move || {
        app.dialog()
            .file()
            .set_file_name(file_name)
            .add_filter(filter, &[extension.as_str()])
            .blocking_save_file()
    })
    .await
    .map_err(|e| Error::Other(e.to_string()))?;
    // `into_path` also resolves the `file://` URL the mobile plugin hands back.
    Ok(chosen.and_then(|f| f.into_path().ok()))
}

/// A destination given without one keeps the extension the export needs.
pub fn with_extension(dest: PathBuf, extension: &str) -> PathBuf {
    match dest.extension() {
        Some(e) if e == extension => dest,
        _ => dest.with_extension(extension),
    }
}

// The CSV export is plaintext, so the copy in memory goes as soon as it is out.
fn write_and_scrub(dest: &Path, mut bytes: Vec<u8>) -> Result<()> {
    let result = std::fs::write(dest, &bytes);
    bytes.zeroize();
    Ok(result?)
}

#[cfg(test)]
mod tests {
    use super::*;

    // What iOS requires: the file the picker is about to export must already
    // hold the export by the time the dialog runs, and must be gone after it.
    #[tokio::test]
    async fn staging_writes_before_the_dialog_and_cleans_up_after() {
        let dir = std::env::temp_dir().join(format!("swifty-save-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let staged = dir.join("vault.swftx");

        let chosen = stage_then(&staged, b"exported bytes".to_vec(), || async {
            assert_eq!(std::fs::read(&staged).unwrap(), b"exported bytes");
            Ok(Some(PathBuf::from("/somewhere/vault.swftx")))
        })
        .await
        .unwrap();

        assert_eq!(chosen, Some(PathBuf::from("/somewhere/vault.swftx")));
        assert!(!staged.exists(), "the staged copy outlived the dialog");
        std::fs::remove_dir_all(&dir).ok();
    }

    // Nor a dialog that failed outright.
    #[tokio::test]
    async fn staging_cleans_up_after_a_failed_dialog() {
        let dir = std::env::temp_dir().join(format!("swifty-save-fail-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let staged = dir.join("swifty-export.csv");

        let result = stage_then(&staged, b"name,password".to_vec(), || async {
            Err(Error::Other("picker crashed".into()))
        })
        .await;

        assert!(result.is_err());
        assert!(!staged.exists());
        std::fs::remove_dir_all(&dir).ok();
    }

    // A write that fails is the one exit the old "delete after the dialog"
    // ordering missed: the guard exists before the bytes go down, so whatever
    // the failed write left at the path is removed exactly like a complete file.
    // Unix-only because a read-only file is the portable way to make the write
    // fail, and Windows then refuses to remove it as well.
    #[cfg(unix)]
    #[test]
    fn a_failed_write_leaves_nothing_behind() {
        use std::os::unix::fs::PermissionsExt;

        let dir = std::env::temp_dir().join(format!("swifty-save-partial-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let staged = dir.join("swifty-export.csv");
        std::fs::write(&staged, b"a stale export nobody cleaned up").unwrap();
        std::fs::set_permissions(&staged, std::fs::Permissions::from_mode(0o444)).unwrap();

        let result = Staged::write(&staged, b"name,password".to_vec());

        assert!(
            result.is_err(),
            "a read-only file should have refused the write"
        );
        assert!(!staged.exists(), "a staged file survived its failed write");
        std::fs::remove_dir_all(&dir).ok();
    }

    // A dismissed dialog must not leave the plaintext behind either.
    #[tokio::test]
    async fn staging_cleans_up_after_a_cancelled_dialog() {
        let dir = std::env::temp_dir().join(format!("swifty-save-cancel-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let staged = dir.join("swifty-export.csv");

        let chosen = stage_then(&staged, b"name,password".to_vec(), || async { Ok(None) })
            .await
            .unwrap();

        assert!(chosen.is_none());
        assert!(!staged.exists());
        std::fs::remove_dir_all(&dir).ok();
    }
}

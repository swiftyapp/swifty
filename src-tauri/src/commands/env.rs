//! Reading a `.env` file off disk for the env kind. A dropped or picked path
//! comes in; its text goes back out to become the draft's body. The file is
//! never parsed here — the frontend owns the format — and never logged: the
//! contents are the secret.

use std::fs;
use std::path::Path;

use serde::Serialize;
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

use crate::error::{Error, Result};

// A real .env is a few kilobytes. Anything past this is not one, and reading
// it whole into the webview would only ever be a mistake.
const MAX_BYTES: u64 = 1024 * 1024;

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct EnvFile {
    pub file_name: String,
    pub body: String,
}

// The command's body, split out so the two refusals can be tested without a
// Tauri runtime around them.
pub fn read_env_text(path: &Path) -> Result<EnvFile> {
    let meta = fs::metadata(path)?;
    if meta.len() > MAX_BYTES {
        return Err(Error::Other("file is larger than 1 MiB".into()));
    }
    let body = String::from_utf8(fs::read(path)?)
        .map_err(|_| Error::Other("file is not UTF-8 text".into()))?;
    let file_name = path
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_default();
    Ok(EnvFile { file_name, body })
}

#[tauri::command]
pub fn read_env_file(path: String) -> Result<EnvFile> {
    read_env_text(Path::new(&path))
}

// Same shape as `pick_import_file`: async + spawn_blocking keeps the blocking
// picker off the main thread. No extension filter — a `.env` has no extension
// for one to match, and `.env.production` is not `.production`.
#[tauri::command]
pub async fn pick_env_file(app: AppHandle) -> Result<Option<String>> {
    let file =
        tauri::async_runtime::spawn_blocking(move || app.dialog().file().blocking_pick_file())
            .await
            .map_err(|e| Error::Other(e.to_string()))?;
    Ok(file
        .and_then(|f| f.into_path().ok())
        .map(|p| p.to_string_lossy().into_owned()))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scratch(name: &str, bytes: &[u8]) -> std::path::PathBuf {
        let path = std::env::temp_dir().join(format!("swifty-env-{}-{name}", std::process::id()));
        fs::write(&path, bytes).unwrap();
        path
    }

    #[test]
    fn reads_a_small_utf8_file_with_its_name() {
        let path = scratch(".env.production", b"A=1\nB=two\n");
        let file = read_env_text(&path).unwrap();
        assert_eq!(file.body, "A=1\nB=two\n");
        assert!(file.file_name.ends_with(".env.production"));
        let _ = fs::remove_file(path);
    }

    #[test]
    fn refuses_a_file_over_the_cap() {
        let path = scratch("big.env", &vec![b'x'; (MAX_BYTES + 1) as usize]);
        let err = read_env_text(&path).unwrap_err().to_string();
        assert!(err.contains("1 MiB"), "{err}");
        let _ = fs::remove_file(path);
    }

    #[test]
    fn refuses_bytes_that_are_not_utf8() {
        let path = scratch("binary.env", &[0xff, 0xfe, b'A', b'=', b'1']);
        let err = read_env_text(&path).unwrap_err().to_string();
        assert!(err.contains("UTF-8"), "{err}");
        let _ = fs::remove_file(path);
    }
}

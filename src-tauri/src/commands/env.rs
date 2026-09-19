//! Reading a `.env` file off disk for the env kind. A dropped or picked path
//! comes in; its text goes back out to become the draft's body. The file is
//! never parsed here — the frontend owns the format — and never logged: the
//! contents are the secret.

use std::path::Path;

use serde::Serialize;
use tauri::State;

use crate::error::{Error, Result};
use crate::state::AppState;
use crate::storage::read_regular_file_capped;

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
    let bytes = read_regular_file_capped(path, MAX_BYTES)?;
    let body = String::from_utf8(bytes).map_err(|_| Error::FileNotText)?;
    let file_name = path
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_default();
    Ok(EnvFile { file_name, body })
}

// Small as `.env` files are, this is still a `stat` and a read of a path the
// user just pointed at — which may be a network mount. Off the IPC thread with
// everything else that touches the disk.
#[tauri::command]
pub async fn read_env_file(path: String, state: State<'_, AppState>) -> Result<EnvFile> {
    // Whatever path comes in is read whole and handed to the webview, so this is
    // a read of the user's disk on the webview's say-so. Only an open vault may
    // ask for one — the drop target that calls this lives in the unlocked shell,
    // and a locked app has no business reading files for anybody.
    state.session.lock().unwrap().key()?;
    super::blocking(move || read_env_text(Path::new(&path))).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn scratch(name: &str, bytes: &[u8]) -> std::path::PathBuf {
        let path = std::env::temp_dir().join(format!("rowel-env-{}-{name}", std::process::id()));
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
        let err = read_env_text(&path).unwrap_err();
        assert!(matches!(err, Error::FileTooLarge), "{err}");
        let _ = fs::remove_file(path);
    }

    #[test]
    fn refuses_bytes_that_are_not_utf8() {
        let path = scratch("binary.env", &[0xff, 0xfe, b'A', b'=', b'1']);
        let err = read_env_text(&path).unwrap_err();
        assert!(matches!(err, Error::FileNotText), "{err}");
        let _ = fs::remove_file(path);
    }
}

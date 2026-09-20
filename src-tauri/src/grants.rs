//! Paths the user has pointed the app at.
//!
//! A command that reads a local file (`scan_image`, `read_env_file`) gets its
//! path from the webview, and the webview's word is not authorization: a
//! script that got to run there could name any file on disk — another
//! project's `.env`, a photo in the user's library — and have the backend hand
//! it back. What the extension and shape checks in those commands decide is
//! *what kind of file* a path names, never *whether the user chose it*.
//!
//! Two events prove the user chose a file, and both reach Rust before the
//! webview ever sees the path: the OS file dialog, when it is opened from Rust
//! (`commands::tools::pick_file`), and a drop on the window, which the OS
//! delivers as a window event (`window::create`). Each grants the path here;
//! the reading command then has to `take` it. A path nobody granted is refused
//! however well it is named.
//!
//! Grants are one-shot — a take consumes them — and few: a bounded set, oldest
//! out, since a grant that was never read is a path the user pointed at and
//! then walked away from. Kept canonical so a grant cannot be sidestepped or
//! spent through a spelling of the path other than the one it was made under.

use std::collections::VecDeque;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

/// How many grants are held at once. A user picks or drops one file at a time
/// and every grant is spent by the read that follows, so anything near the cap
/// is grants nothing collected.
const CAP: usize = 64;

#[derive(Default)]
pub struct PathGrants {
    // Oldest first, so the bound evicts from the front.
    paths: Mutex<VecDeque<PathBuf>>,
}

impl PathGrants {
    /// Record that the user chose `path`. A path that cannot be canonicalized
    /// (it does not exist) is not recorded: there is nothing to read.
    pub fn grant(&self, path: &Path) {
        let Ok(path) = path.canonicalize() else {
            return;
        };
        let mut paths = self.paths.lock().unwrap();
        paths.retain(|held| held != &path);
        if paths.len() >= CAP {
            paths.pop_front();
        }
        paths.push_back(path);
    }

    /// Spend the grant for `path`: whether the user chose it, and if so, no
    /// longer — the next read of the same path needs the user's say again.
    pub fn take(&self, path: &Path) -> bool {
        let Ok(path) = path.canonicalize() else {
            return false;
        };
        let mut paths = self.paths.lock().unwrap();
        match paths.iter().position(|held| held == &path) {
            Some(at) => {
                paths.remove(at);
                true
            }
            None => false,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn scratch(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("rowel-grants-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let path = dir.join(name);
        fs::write(&path, b"x").unwrap();
        path
    }

    #[test]
    fn a_granted_path_is_taken_once() {
        let grants = PathGrants::default();
        let path = scratch("once");
        grants.grant(&path);
        assert!(grants.take(&path));
        assert!(!grants.take(&path));
    }

    #[test]
    fn a_path_nobody_granted_is_refused() {
        let grants = PathGrants::default();
        let path = scratch("ungranted");
        assert!(!grants.take(&path));
        assert!(!grants.take(Path::new("/definitely/not/here")));
    }

    #[test]
    fn a_grant_is_spent_through_any_spelling_of_the_path() {
        let grants = PathGrants::default();
        let path = scratch("spelled");
        let dir = path.parent().unwrap();
        let roundabout = dir
            .join("..")
            .join(dir.file_name().unwrap())
            .join("spelled");
        grants.grant(&roundabout);
        assert!(grants.take(&path));
        assert!(!grants.take(&roundabout));
    }

    #[test]
    fn the_oldest_grant_goes_first_when_the_set_is_full() {
        let grants = PathGrants::default();
        let first = scratch("evicted");
        grants.grant(&first);
        let rest: Vec<_> = (0..CAP).map(|i| scratch(&format!("kept-{i}"))).collect();
        for path in &rest {
            grants.grant(path);
        }
        assert!(!grants.take(&first));
        for path in &rest {
            assert!(grants.take(path));
        }
    }

    #[test]
    fn regranting_a_held_path_keeps_one_grant_for_it() {
        let grants = PathGrants::default();
        let path = scratch("twice");
        grants.grant(&path);
        grants.grant(&path);
        assert!(grants.take(&path));
        assert!(!grants.take(&path));
    }
}

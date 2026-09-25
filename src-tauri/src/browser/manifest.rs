//! The native messaging manifests: how a browser finds this host.
//!
//! Each browser looks for a JSON file named after the host in a directory of
//! its own — or, on Windows, for a registry value naming such a file. The
//! host name is KeePassXC's, so the stock KeePassXC-Browser extension, which
//! asks for that name and nothing else, connects to Rowel unchanged.

use std::path::{Path, PathBuf};

use serde::Serialize;
use serde_json::json;

pub const HOST_NAME: &str = "org.keepassxc.keepassxc_browser";

// The extension's ids: the Chrome Web Store one and the Edge Add-ons one,
// which every Chromium accepts; and Firefox's, which Firefox reads under a
// key of its own.
const CHROMIUM_ORIGINS: &[&str] = &[
    "chrome-extension://oboonakemofpalcgghocfoadofidjkkk/",
    "chrome-extension://pdffhmdngciaglkoonimfcmckehcpafo/",
];
const FIREFOX_EXTENSIONS: &[&str] = &["keepassxc-browser@keepassxc.org"];

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Family {
    Chromium,
    Firefox,
}

pub struct Browser {
    pub id: &'static str,
    pub label: &'static str,
    pub family: Family,
    // Where the browser keeps its profile, under the platform's app-support
    // directory; the manifest goes in `NativeMessagingHosts` beneath it. On
    // Windows the same name is the browser's key under `HKCU\Software`.
    #[cfg_attr(windows, allow(dead_code))]
    mac: &'static str,
    #[cfg_attr(windows, allow(dead_code))]
    linux: &'static str,
    #[cfg_attr(not(windows), allow(dead_code))]
    windows: &'static str,
}

pub const BROWSERS: &[Browser] = &[
    Browser {
        id: "chrome",
        label: "Google Chrome",
        family: Family::Chromium,
        mac: "Google/Chrome",
        linux: "google-chrome",
        windows: "Google\\Chrome",
    },
    Browser {
        id: "chromium",
        label: "Chromium",
        family: Family::Chromium,
        mac: "Chromium",
        linux: "chromium",
        windows: "Chromium",
    },
    Browser {
        id: "edge",
        label: "Microsoft Edge",
        family: Family::Chromium,
        mac: "Microsoft Edge",
        linux: "microsoft-edge",
        windows: "Microsoft\\Edge",
    },
    Browser {
        id: "brave",
        label: "Brave",
        family: Family::Chromium,
        mac: "BraveSoftware/Brave-Browser",
        linux: "BraveSoftware/Brave-Browser",
        windows: "BraveSoftware\\Brave-Browser",
    },
    Browser {
        id: "vivaldi",
        label: "Vivaldi",
        family: Family::Chromium,
        mac: "Vivaldi",
        linux: "vivaldi",
        windows: "Vivaldi",
    },
    // Firefox reads manifests from Mozilla's directory, not its own profile
    // directory, which is what `detected` looks for instead.
    Browser {
        id: "firefox",
        label: "Firefox",
        family: Family::Firefox,
        mac: "Mozilla",
        linux: ".mozilla",
        windows: "Mozilla",
    },
];

/// One browser as Settings shows it: whether it seems to be on this machine,
/// and whether its manifest is in place.
#[derive(Serialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Status {
    pub id: &'static str,
    pub label: &'static str,
    pub detected: bool,
    pub installed: bool,
}

/// The manifest for one family, naming `host` as the executable.
pub fn manifest(family: Family, host: &Path) -> String {
    let mut manifest = json!({
        "name": HOST_NAME,
        "description": "Rowel — fills logins through the KeePassXC-Browser extension",
        "path": host,
        "type": "stdio",
    });
    match family {
        Family::Chromium => manifest["allowed_origins"] = json!(CHROMIUM_ORIGINS),
        Family::Firefox => manifest["allowed_extensions"] = json!(FIREFOX_EXTENSIONS),
    }
    serde_json::to_string_pretty(&manifest).unwrap_or_default()
}

/// The executable a browser should launch: this one — or, inside an AppImage,
/// the image itself, since the binary it mounts is gone once it exits.
pub fn host_path() -> Option<PathBuf> {
    if let Some(image) = std::env::var_os("APPIMAGE") {
        return Some(PathBuf::from(image));
    }
    std::env::current_exe().ok()
}

/// Write the manifest for every browser that seems to be here. `root` is the
/// app's data directory, where Windows keeps the files its registry points at.
pub fn install(root: &Path) -> Vec<Status> {
    let host = host_path();
    for browser in BROWSERS {
        if !platform::detected(browser) {
            continue;
        }
        let Some(host) = &host else { continue };
        if let Err(e) = platform::install(root, browser, &manifest(browser.family, host)) {
            log::warn!(
                "browser host: could not register with {}: {e}",
                browser.label
            );
        }
    }
    status(root)
}

/// Remove every manifest, whether or not its browser is still here.
pub fn remove(root: &Path) -> Vec<Status> {
    for browser in BROWSERS {
        if let Err(e) = platform::remove(root, browser) {
            log::warn!(
                "browser host: could not unregister from {}: {e}",
                browser.label
            );
        }
    }
    status(root)
}

pub fn status(root: &Path) -> Vec<Status> {
    BROWSERS
        .iter()
        .map(|browser| Status {
            id: browser.id,
            label: browser.label,
            detected: platform::detected(browser),
            installed: platform::installed(root, browser),
        })
        .collect()
}

#[cfg(not(windows))]
mod platform {
    use super::{Browser, Family, HOST_NAME};
    use std::fs;
    use std::path::{Path, PathBuf};

    // The browser's own directory: its profile lives there, so its being
    // there is the sign the browser has run on this machine.
    fn profile_dir(browser: &Browser) -> Option<PathBuf> {
        let home = dirs::home_dir()?;
        if cfg!(target_os = "macos") {
            let support = home.join("Library/Application Support");
            Some(match browser.family {
                Family::Firefox => support.join("Firefox"),
                Family::Chromium => support.join(browser.mac),
            })
        } else {
            Some(match browser.family {
                Family::Firefox => home.join(browser.linux),
                Family::Chromium => dirs::config_dir()?.join(browser.linux),
            })
        }
    }

    fn manifest_path(browser: &Browser) -> Option<PathBuf> {
        let dir = if cfg!(target_os = "macos") {
            dirs::home_dir()?
                .join("Library/Application Support")
                .join(browser.mac)
                .join("NativeMessagingHosts")
        } else {
            match browser.family {
                Family::Firefox => dirs::home_dir()?
                    .join(browser.linux)
                    .join("native-messaging-hosts"),
                Family::Chromium => dirs::config_dir()?
                    .join(browser.linux)
                    .join("NativeMessagingHosts"),
            }
        };
        Some(dir.join(format!("{HOST_NAME}.json")))
    }

    pub fn detected(browser: &Browser) -> bool {
        profile_dir(browser).is_some_and(|dir| dir.is_dir())
    }

    pub fn installed(_root: &Path, browser: &Browser) -> bool {
        manifest_path(browser).is_some_and(|path| path.is_file())
    }

    pub fn install(_root: &Path, browser: &Browser, manifest: &str) -> std::io::Result<()> {
        let Some(path) = manifest_path(browser) else {
            return Ok(());
        };
        if let Some(dir) = path.parent() {
            fs::create_dir_all(dir)?;
        }
        fs::write(path, manifest)
    }

    pub fn remove(_root: &Path, browser: &Browser) -> std::io::Result<()> {
        let Some(path) = manifest_path(browser) else {
            return Ok(());
        };
        match fs::remove_file(path) {
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
            other => other,
        }
    }
}

// On Windows a browser reads `HKCU\Software\<Browser>\NativeMessagingHosts\
// <host>`, whose default value is the path of the manifest file. The files
// live in the app's own data directory.
#[cfg(windows)]
mod platform {
    use super::{Browser, HOST_NAME};
    use std::fs;
    use std::path::{Path, PathBuf};
    use windows_registry::CURRENT_USER;

    fn key(browser: &Browser) -> String {
        format!(
            "Software\\{}\\NativeMessagingHosts\\{HOST_NAME}",
            browser.windows
        )
    }

    fn manifest_path(root: &Path, browser: &Browser) -> PathBuf {
        root.join("browser").join(format!("{}.json", browser.id))
    }

    pub fn detected(browser: &Browser) -> bool {
        CURRENT_USER
            .open(format!("Software\\{}", browser.windows))
            .is_ok()
    }

    pub fn installed(root: &Path, browser: &Browser) -> bool {
        manifest_path(root, browser).is_file() && CURRENT_USER.open(key(browser)).is_ok()
    }

    pub fn install(root: &Path, browser: &Browser, manifest: &str) -> std::io::Result<()> {
        let path = manifest_path(root, browser);
        if let Some(dir) = path.parent() {
            fs::create_dir_all(dir)?;
        }
        fs::write(&path, manifest)?;
        CURRENT_USER
            .create(key(browser))
            .and_then(|key| key.set_string("", path.to_string_lossy()))
            .map_err(|e| std::io::Error::other(e.to_string()))
    }

    pub fn remove(root: &Path, browser: &Browser) -> std::io::Result<()> {
        if CURRENT_USER.open(key(browser)).is_ok() {
            CURRENT_USER
                .remove_tree(key(browser))
                .map_err(|e| std::io::Error::other(e.to_string()))?;
        }
        match fs::remove_file(manifest_path(root, browser)) {
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
            other => other,
        }
    }
}

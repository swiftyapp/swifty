//! User preferences, owned here rather than in the webview.
//!
//! These used to be a handful of localStorage keys, which meant the backend and
//! the frontend disagreed about half of them: Rust enforced the auto-lock but
//! booted with its own default and waited for the frontend to push the stored
//! one. One file in the app data dir, one struct, one command to patch it.
//!
//! Nothing here is secret — it is what the UI looks like and how long a copied
//! value lingers — so it sits beside the KDF and lockout sidecars in plaintext
//! and is readable while the vault is locked.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

use crate::error::Result;
use crate::storage;

/// The seed values for every new password, shared by Settings › Security and
/// the ⌘G dialog. `uppercase` and `exclude` have no control of their own yet;
/// they are carried so a future one inherits what is already stored.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct GeneratorDefaults {
    pub length: u32,
    pub numbers: bool,
    pub symbols: bool,
    pub uppercase: bool,
    pub exclude: String,
    pub exclude_similar_characters: bool,
}

impl Default for GeneratorDefaults {
    fn default() -> Self {
        Self {
            length: 20,
            numbers: true,
            symbols: true,
            uppercase: true,
            exclude: String::new(),
            exclude_similar_characters: false,
        }
    }
}

/// Every preference the app has, with the defaults a fresh install starts from.
///
/// The enum-ish fields are plain strings: the frontend's union types narrow
/// them, and a value from a hand-edited file that no branch matches falls
/// through to the same arm the default does. Only the auto-lock is clamped,
/// and that happens where it is enforced (`autolock::set_timeout`).
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    pub autolock_secs: u64,
    pub clipboard_timeout_ms: u64,
    pub date_format: String,
    pub list_sort: String,
    pub theme: String,
    /// An explicit language choice. `None` means "follow the OS", which is what
    /// a fresh install does — see `locale::resolve_preferred`.
    pub locale: Option<String>,
    pub breach_check: bool,
    pub generator: GeneratorDefaults,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            autolock_secs: 60,
            clipboard_timeout_ms: 30_000,
            date_format: "MM/DD/YYYY".into(),
            list_sort: "recent".into(),
            theme: "light".into(),
            locale: None,
            breach_check: false,
            generator: GeneratorDefaults::default(),
        }
    }
}

/// The current settings, so a read is a lock rather than a file open. Written
/// through `set`, which persists before it swaps.
#[derive(Default)]
pub struct SettingsState(Mutex<Settings>);

/// Read `settings.json`, falling back to the defaults for a missing or unusable
/// file. Never fails: a preferences file is not worth refusing to start over.
pub fn load(app: &AppHandle) -> Settings {
    let Ok(path) = storage::settings_path(app) else {
        return Settings::default();
    };
    let Ok(json) = std::fs::read_to_string(path) else {
        return Settings::default();
    };
    serde_json::from_str(&json).unwrap_or_else(|error| {
        log::warn!("settings.json is not readable, using defaults: {error}");
        Settings::default()
    })
}

/// The settings as they stand, out of managed state.
pub fn current(app: &AppHandle) -> Settings {
    app.state::<SettingsState>().0.lock().unwrap().clone()
}

/// Seed managed state from disk. Called once at startup, before anything reads.
pub fn hydrate(app: &AppHandle, settings: Settings) {
    *app.state::<SettingsState>().0.lock().unwrap() = settings;
}

/// Read the file into managed state and put the stored auto-lock in force.
///
/// Runs at startup — the auto-lock is enforced here, so the timeout the user
/// picked has to be armed before a session can exist rather than waiting for
/// the frontend to push it — and again after an E2E reset has taken the file
/// away, which would otherwise leave the previous spec's preferences in memory.
pub fn boot(app: &AppHandle) {
    let stored = load(app);
    crate::autolock::set_timeout(app, stored.autolock_secs);
    hydrate(app, stored);
}

/// Apply `patch` over the current settings, persist the result and hand it back.
///
/// The patch is a partial object keyed the way the struct serializes, so the
/// merge is a top-level key overwrite on the JSON form. `generator` is replaced
/// whole — the frontend sends the group it edited, not a single knob.
pub fn set(app: &AppHandle, patch: &Value) -> Result<Settings> {
    let merged = merge(&current(app), patch)?;
    storage::write_settings(app, &serde_json::to_string_pretty(&merged)?)?;
    hydrate(app, merged.clone());
    Ok(merged)
}

fn merge(base: &Settings, patch: &Value) -> Result<Settings> {
    let mut json = serde_json::to_value(base)?;
    if let (Some(target), Some(fields)) = (json.as_object_mut(), patch.as_object()) {
        for (key, value) in fields {
            target.insert(key.clone(), value.clone());
        }
    }
    Ok(serde_json::from_value(json)?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_match_what_a_fresh_install_shows() {
        let settings = Settings::default();
        assert_eq!(settings.autolock_secs, 60);
        assert_eq!(settings.clipboard_timeout_ms, 30_000);
        assert_eq!(settings.date_format, "MM/DD/YYYY");
        assert_eq!(settings.list_sort, "recent");
        assert_eq!(settings.theme, "light");
        assert_eq!(settings.locale, None);
        assert!(!settings.breach_check);
        assert_eq!(settings.generator, GeneratorDefaults::default());
        assert_eq!(settings.generator.length, 20);
    }

    #[test]
    fn round_trips_through_camel_case_json() {
        let settings = Settings {
            locale: Some("de-DE".into()),
            breach_check: true,
            ..Settings::default()
        };
        let json = serde_json::to_string(&settings).unwrap();
        assert!(json.contains("\"clipboardTimeoutMs\""));
        assert!(json.contains("\"excludeSimilarCharacters\""));
        assert_eq!(serde_json::from_str::<Settings>(&json).unwrap(), settings);
    }

    #[test]
    fn a_partial_or_junk_file_degrades_to_the_defaults() {
        // `#[serde(default)]` on the struct: a file written by an older build
        // keeps whatever it does carry and fills the rest in.
        let partial: Settings = serde_json::from_str(r#"{"theme":"dark"}"#).unwrap();
        assert_eq!(partial.theme, "dark");
        assert_eq!(partial.autolock_secs, 60);

        assert!(serde_json::from_str::<Settings>("{").is_err());
    }

    #[test]
    fn a_patch_overwrites_only_the_keys_it_names() {
        let base = Settings::default();
        let merged = merge(
            &base,
            &serde_json::json!({ "autolockSecs": 900, "locale": "fr-FR" }),
        )
        .unwrap();

        assert_eq!(merged.autolock_secs, 900);
        assert_eq!(merged.locale, Some("fr-FR".into()));
        assert_eq!(merged.clipboard_timeout_ms, base.clipboard_timeout_ms);
        assert_eq!(merged.generator, base.generator);
    }

    #[test]
    fn a_generator_patch_replaces_the_group() {
        let merged = merge(
            &Settings::default(),
            &serde_json::json!({
                "generator": {
                    "length": 32,
                    "numbers": true,
                    "symbols": false,
                    "uppercase": true,
                    "exclude": "",
                    "excludeSimilarCharacters": true
                }
            }),
        )
        .unwrap();

        assert_eq!(merged.generator.length, 32);
        assert!(!merged.generator.symbols);
        assert!(merged.generator.exclude_similar_characters);
    }

    #[test]
    fn clearing_the_locale_goes_back_to_following_the_os() {
        let pinned = Settings {
            locale: Some("uk-UA".into()),
            ..Settings::default()
        };
        let merged = merge(&pinned, &serde_json::json!({ "locale": null })).unwrap();
        assert_eq!(merged.locale, None);
    }
}

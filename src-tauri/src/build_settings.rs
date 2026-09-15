//! Values a release build is handed through the Tauri CLI's `--config` patch,
//! under `plugins.swifty` in the merged config the binary embeds.
//!
//! This exists for iOS. There, `tauri ios build` compiles inside xcodebuild
//! with a replaced environment, and the CLI forwards only `TAURI*`, `WRY*`,
//! `CARGO_*` and `RUST_*` names into it — so `option_env!("GOOGLE_API_KEY")`
//! is `None` however the shell was set up. The config patch is forwarded (it
//! rides in `TAURI_CONFIG`), which makes it the one channel a build-time
//! value has onto the phone. `scripts/ios-build-config.mjs` writes the patch;
//! the keys it uses are named here.
//!
//! The Google OAuth client id is *not* one of these: on mobile it is derived
//! from the deep-link scheme (see `sync::auth`), which the same patch sets.

use tauri::{utils::config::PluginConfig, AppHandle};

/// The `plugins` entry these live under. Not a real plugin — `plugins` is the
/// only free-form section of the Tauri config, and the CLI passes every entry
/// through untouched.
const PLUGIN_KEY: &str = "swifty";

/// The public Google API key share receiving downloads with (`share::remote`).
pub const GOOGLE_API_KEY: &str = "googleApiKey";

/// A non-empty string setting from the build's config, or `None`.
pub fn build_setting(app: &AppHandle, key: &str) -> Option<String> {
    setting(&app.config().plugins, key)
}

fn setting(plugins: &PluginConfig, key: &str) -> Option<String> {
    plugins
        .0
        .get(PLUGIN_KEY)?
        .get(key)?
        .as_str()
        .filter(|s| !s.is_empty())
        .map(str::to_owned)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::{Map, Value};
    use std::collections::HashMap;

    /// `plugins.swifty` holding exactly `key: value`.
    fn plugins(key: &str, value: Value) -> PluginConfig {
        let mut entry = Map::new();
        entry.insert(key.to_owned(), value);
        PluginConfig(HashMap::from([(PLUGIN_KEY.to_owned(), Value::Object(entry))]))
    }

    #[test]
    fn a_set_key_is_read() {
        let p = plugins(GOOGLE_API_KEY, Value::String("AIza-test".into()));
        assert_eq!(setting(&p, GOOGLE_API_KEY).as_deref(), Some("AIza-test"));
    }

    #[test]
    fn empty_missing_and_non_string_are_absent() {
        let empty = plugins(GOOGLE_API_KEY, Value::String(String::new()));
        assert!(setting(&empty, GOOGLE_API_KEY).is_none());
        let other = plugins("somethingElse", Value::String("x".into()));
        assert!(setting(&other, GOOGLE_API_KEY).is_none());
        let number = plugins(GOOGLE_API_KEY, Value::from(7));
        assert!(setting(&number, GOOGLE_API_KEY).is_none());
        assert!(setting(&PluginConfig(HashMap::new()), GOOGLE_API_KEY).is_none());
    }
}

//! The OS locale, read from the operating system rather than guessed from the
//! webview. `navigator.language` reflects whatever the embedded browser engine
//! was configured with — WebKitGTK and WebView2 do not always agree with the
//! user's actual system setting — so the OS is the only authority worth asking.
//!
//! This is the *system* locale only, used when the user has never chosen one.
//! An explicit choice is a preference the frontend persists and pushes back
//! down, the same way the autolock timeout works.

use sys_locale::get_locale;

/// Locales the app ships a catalogue for. A system locale outside this list
/// falls back to en-US rather than leaving the UI half-translated.
const SUPPORTED: [&str; 10] = [
    "en-US", "de-DE", "fr-FR", "pl-PL", "pt-BR", "ru-RU", "sv-SE", "tr-TR", "uk-UA", "zh-CN",
];

const DEFAULT: &str = "en-US";

/// Map one OS locale tag onto a catalogue we ship.
///
/// The OS hands these back in assorted shapes — `de_DE`, `de-DE`, `de`, and on
/// macOS sometimes `de-DE.UTF-8` — so normalise, then prefer an exact match and
/// fall back to any catalogue sharing the language subtag. That maps `pt-PT`
/// onto `pt-BR`: an imperfect match, but a closer one than English.
fn resolve(raw: &str) -> &'static str {
    let normalized = raw.trim().replace('_', "-");
    let language = normalized.split(['-', '.']).next().unwrap_or("");

    if language.is_empty() {
        return DEFAULT;
    }

    SUPPORTED
        .iter()
        .find(|tag| tag.eq_ignore_ascii_case(&normalized))
        .or_else(|| {
            SUPPORTED.iter().find(|tag| {
                tag.split('-')
                    .next()
                    .is_some_and(|s| s.eq_ignore_ascii_case(language))
            })
        })
        .copied()
        .unwrap_or(DEFAULT)
}

pub fn system_locale() -> String {
    get_locale()
        .map(|raw| resolve(&raw))
        .unwrap_or(DEFAULT)
        .to_string()
}

#[tauri::command]
pub fn os_locale() -> String {
    system_locale()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn matches_an_exact_tag() {
        assert_eq!(resolve("de-DE"), "de-DE");
        assert_eq!(resolve("zh-CN"), "zh-CN");
    }

    #[test]
    fn normalises_posix_and_encoding_suffixes() {
        assert_eq!(resolve("de_DE"), "de-DE");
        assert_eq!(resolve("de-DE.UTF-8"), "de-DE");
        assert_eq!(resolve("  fr-FR  "), "fr-FR");
    }

    #[test]
    fn falls_back_to_the_language_subtag() {
        // No pt-PT catalogue, but pt-BR is far closer than English.
        assert_eq!(resolve("pt-PT"), "pt-BR");
        assert_eq!(resolve("de"), "de-DE");
        assert_eq!(resolve("zh-TW"), "zh-CN");
    }

    #[test]
    fn is_case_insensitive() {
        assert_eq!(resolve("DE-de"), "de-DE");
        assert_eq!(resolve("RU"), "ru-RU");
    }

    #[test]
    fn defaults_for_unshipped_or_junk_input() {
        assert_eq!(resolve("ja-JP"), DEFAULT);
        assert_eq!(resolve(""), DEFAULT);
        assert_eq!(resolve("   "), DEFAULT);
        assert_eq!(resolve("-"), DEFAULT);
    }

    #[test]
    fn system_locale_is_always_a_shipped_catalogue() {
        assert!(SUPPORTED.contains(&system_locale().as_str()));
    }
}

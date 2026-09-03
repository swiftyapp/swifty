/**
 * User facing application name — the single place the frontend spells it.
 *
 * Translations never hardcode it either: locale values interpolate `%{appName}`
 * (see `@/i18n`). Identifiers that happen to share the name are deliberately
 * not derived from this: the bundle identity (`productName` in
 * `tauri.conf.json`), the Google Drive folder, and the legacy Electron data
 * directory must survive a rename.
 */
export const APP_NAME = 'Swifty'

/**
 * User facing application name — the single place the frontend spells it.
 *
 * Translations never hardcode it either: locale values interpolate `%{appName}`
 * (see `@/i18n`). Identifiers that happen to share the name (the bundle identity
 * in `tauri.conf.json`, the Google Drive folder) are deliberately not derived
 * from this: they are persisted, so changing them is a migration, not a rename.
 */
export const APP_NAME = 'Rowel'

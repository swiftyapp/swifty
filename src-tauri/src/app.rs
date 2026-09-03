//! User facing application name — the single place the backend spells it.
//!
//! Deliberately *not* the source for anything an installed app is identified
//! by: `productName`/bundle id in `tauri.conf.json`, the Google Drive folder
//! (`sync::FOLDER_NAME`), the legacy Electron data directory, and the HTTP
//! user agent all have to survive a rename, so they keep their own literals.
//! The frontend has its own copy of this name in `src/lib/app.ts`.

pub const APP_NAME: &str = "Swifty";

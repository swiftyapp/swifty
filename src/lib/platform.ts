// Which Tauri target this bundle was built for. `__TAURI_PLATFORM__` is baked
// in by vite.config.ts from the CLI's TAURI_ENV_PLATFORM, so these are compile
// -time constants rather than a user-agent guess: the same WKWebView serves
// macOS and iOS, and its UA cannot tell them apart.
export const isIOS = __TAURI_PLATFORM__ === 'ios'
export const isAndroid = __TAURI_PLATFORM__ === 'android'
export const isMobile = isIOS || isAndroid

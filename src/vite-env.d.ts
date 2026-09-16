/// <reference types="vite/client" />

// Baked in by vite.config.ts from the Tauri CLI's TAURI_ENV_PLATFORM.
declare const __TAURI_PLATFORM__: string

// This file is a script, not a module (no top-level import/export), so the
// declarations above and below are global as written.
interface Window {
  /**
   * The OS locale, narrowed to a catalogue the app ships, written by the main
   * window's initialization script (see `src-tauri/src/window.rs`). Absent in a
   * plain browser and under tests.
   */
  __ROWEL_LOCALE__?: string
}

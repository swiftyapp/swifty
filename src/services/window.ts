import { getCurrentWindow } from '@tauri-apps/api/window'
import { LogicalSize } from '@tauri-apps/api/dpi'

// Resizes the window to the main-view size after unlock (legacy `enlarge()`).
export const enlarge = () =>
  getCurrentWindow().setSize(new LogicalSize(900, 700))

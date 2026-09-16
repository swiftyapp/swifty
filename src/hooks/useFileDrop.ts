import { useWebviewDragDrop } from './useWebviewDragDrop'

/**
 * Files dropped onto the window, as OS paths.
 *
 * The drop half of the webview's drag-drop stream, which is all most targets
 * want: Import minds an export file, the env editor a `.env`. A target that
 * also has something to draw while a file is over the window (the scanner's
 * overlay) takes `useWebviewDragDrop` directly.
 */
export function useFileDrop(onPaths: (paths: string[]) => void, enabled = true) {
  useWebviewDragDrop(payload => {
    if (payload.type === 'drop') onPaths(payload.paths)
  }, enabled)
}

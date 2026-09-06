import { t } from '@/i18n'
import { IMAGE_EXTENSIONS } from './fields'
import { runScan } from './run'

/**
 * Choose an image and scan it — the picked-file twin of dropping a photo on
 * the window, and on a phone the only way in, since there is nothing to drop.
 *
 * The filters are all image types, which is exactly what makes iOS show the
 * Photos picker rather than the Files browser: the dialog plugin switches to
 * `PHPickerViewController` when no filter names a non-media type
 * (`tauri-plugin-dialog` 2.7.2, `ios/Sources/DialogPlugin.swift:82-114`).
 *
 * Resolves to whether a file was picked, so a caller can dismiss itself only
 * when the window is actually being handed over. Never throws — the outcome of
 * the scan itself is the status in the store (see `run.ts`).
 */
export const pickAndScan = async (): Promise<boolean> => {
  const { open } = await import('@tauri-apps/plugin-dialog')
  const path = await open({
    multiple: false,
    directory: false,
    // The native dialog's own chrome, so the filter is named in the user's
    // language like everything else in it.
    filters: [{ name: t('Images'), extensions: IMAGE_EXTENSIONS }]
  })
  if (typeof path !== 'string') return false
  void runScan(path)
  return true
}

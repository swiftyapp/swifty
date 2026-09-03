import { useTranslation } from 'react-i18next'
import { useStore, closeAddPicker } from '@/store'
import { IMAGE_EXTENSIONS } from '../Scan/fields'
import { runScan } from '../Scan/run'
import { ScanGlyph } from '../icons'

/**
 * "Scan a card or document…": the picked-file twin of dropping a photo on the
 * window, for the file that is already on disk rather than in hand.
 *
 * Deliberately outside the tile grid — the digits and arrows are bound to the
 * tiles, and this is not an nth kind. It owns its own divider so that nothing
 * is left framing an empty space where the OS cannot scan at all.
 */
export default function ScanAction() {
  const { t } = useTranslation()
  const supported = useStore(state => state.ui.scan.supported)

  if (!supported) return null

  const pick = async () => {
    const { open } = await import('@tauri-apps/plugin-dialog')
    const path = await open({
      multiple: false,
      directory: false,
      // The native dialog's own chrome, so the filter is named in the user's
      // language like everything else in it.
      filters: [{ name: t('Images'), extensions: IMAGE_EXTENSIONS }]
    })
    // A cancelled dialog leaves the picker as it was; a chosen file hands the
    // window over to the editor the scan is about to fill.
    if (typeof path !== 'string') return
    closeAddPicker()
    void runScan(path)
  }

  return (
    <div className="mt-5 border-t border-line pt-4">
      <button
        type="button"
        data-testid="add-scan-image"
        onClick={() => void pick()}
        className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-base text-text2 transition-colors hover:bg-hover hover:text-text"
      >
        <ScanGlyph size={16} className="flex-none text-text3" />
        <span>{t('Scan a card or document…')}</span>
      </button>
      <p className="mt-1 pl-[30px] text-base text-text3">
        {t('A photo or screenshot, read on this device.')}
      </p>
    </div>
  )
}

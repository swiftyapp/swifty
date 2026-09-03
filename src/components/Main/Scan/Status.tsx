import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { TKey } from '@/i18n'
import { useStore, dismissScan } from '@/store'
import type { ScanError } from '@/store/uiSlice'
import { TOAST } from '@/components/elements/tokens'
import { ScanGlyph } from '../icons'

const COPY: Record<ScanError, TKey> = {
  unreadable: 'Nothing recognized in that image.',
  unsupported: 'Scanning is not available on this device.',
  failed: 'That image could not be read.'
}

// Only "nothing recognized" is worth advising about: it is the one failure the
// user can answer by taking a better photo.
const HINT: TKey =
  'Good, even light helps — with the whole card, or the two or three machine-readable lines, inside the frame.'

// How long a complaint stays up. Long enough to read twice, short enough that
// it is gone by the time the next photo is dropped.
const DISMISS_MS = 8000

// Bottom-left, opposite the update toast: recognition runs while the user keeps
// working, so neither state may block anything or move the pane underneath.
export default function Status() {
  const { t } = useTranslation()
  const { busy, error } = useStore(state => state.ui.scan)

  useEffect(() => {
    if (!error) return
    const timer = setTimeout(dismissScan, DISMISS_MS)
    return () => clearTimeout(timer)
  }, [error])

  if (busy)
    return (
      <div
        data-testid="scan-status"
        role="status"
        className={`${TOAST} bottom-5 left-5 flex items-center gap-3 px-4 py-3`}
      >
        {/* The comet ring the sync chip spins, at toast scale. */}
        <span
          aria-hidden
          className="h-3.5 w-3.5 flex-none animate-spin rounded-full border-2 border-accent/25 border-l-accent"
        />
        <span className="text-base text-text2">{t('Reading the image…')}</span>
      </div>
    )

  if (!error) return null

  return (
    <div
      data-testid="scan-error"
      role="alert"
      className={`${TOAST} bottom-5 left-5 flex gap-3 px-4 py-3`}
    >
      <ScanGlyph size={16} className="mt-0.5 flex-none text-text3" />
      <div className="flex flex-col gap-1">
        <span className="text-base text-text2">{t(COPY[error])}</span>
        {error === 'unreadable' && <span className="text-base text-text3">{t(HINT)}</span>}
      </div>
    </div>
  )
}

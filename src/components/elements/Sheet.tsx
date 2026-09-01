import { useEffect, type ReactNode } from 'react'
import { t } from '@/i18n'
import { CloseGlyph } from '../Main/icons'
import IconButton from './IconButton'

interface Props {
  title: string
  // Close *request* — from Esc, the scrim, or the header button. The caller
  // decides whether to actually close (so it can run a dirty guard first).
  onClose: () => void
  // ⌘⏎ / Ctrl+⏎ while the sheet is open.
  onSubmit?: () => void
  // Pinned action row at the bottom of the panel.
  footer?: ReactNode
  children: ReactNode
}

// Full-height 520px panel sliding in from the right over a blurred scrim, with
// a fixed header, a scrollable body and a pinned footer. Sibling of Modal:
// same overlay language, different anchor.
export default function Sheet({ title, onClose, onSubmit, footer, children }: Props) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') return onClose()
      if (onSubmit && event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        onSubmit()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, onSubmit])

  return (
    <div
      className="animate-fade fixed inset-0 z-40 flex justify-end bg-[var(--scrim)] backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="animate-sheet flex h-full w-[520px] flex-col border-l border-line2 bg-detail text-text shadow-[var(--shadow)]"
        onClick={event => event.stopPropagation()}
      >
        <div className="flex flex-none items-center gap-3 border-b border-line px-5 py-[17px]">
          <div className="flex-1 text-lg font-semibold tracking-display">{title}</div>
          <IconButton title={t('Close')} onClick={onClose}>
            <CloseGlyph />
          </IconButton>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pt-[18px] pb-6">{children}</div>

        {footer && (
          <div className="flex flex-none items-center gap-2 border-t border-line px-5 py-[13px]">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

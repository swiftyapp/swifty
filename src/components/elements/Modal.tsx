import { useEffect, type ReactNode } from 'react'
import { cx } from '@/utils/cx'
import { CloseGlyph } from '../Main/icons'

interface Props {
  onClose: () => void
  // Replaces the card's default sizing (`w-full max-w-[720px]`) rather than
  // adding to it, so a narrower dialog does not fight the default width.
  className?: string
  // id of the element that names the dialog, for `aria-labelledby`.
  labelledBy?: string
  testid?: string
  children: ReactNode
}

export default function Modal({ onClose, className, labelledBy, testid, children }: Props) {
  // Escape closes every modal — the scrim and the X are pointer-only exits.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div
      className="animate-fade fixed inset-0 z-50 flex items-start justify-center bg-[var(--scrim)] p-4 pt-[10vh] backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        data-testid={testid}
        className={cx(
          'animate-pop relative flex max-h-[80vh] overflow-hidden rounded-xl border border-line2 bg-detail text-text shadow-[var(--shadow)]',
          className ?? 'w-full max-w-[720px]'
        )}
        onClick={e => e.stopPropagation()}
      >
        <button
          type="button"
          data-testid="modal-close"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 grid h-7 w-7 cursor-pointer place-items-center rounded-sm text-text3 transition-colors hover:bg-hover hover:text-text"
        >
          <CloseGlyph />
        </button>
        {children}
      </div>
    </div>
  )
}

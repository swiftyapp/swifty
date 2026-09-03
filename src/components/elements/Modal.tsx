import { useEffect, useRef, type ReactNode } from 'react'
import { cx } from '@/utils/cx'
import { CloseGlyph } from '../Main/icons'

const TABBABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

interface Props {
  onClose: () => void
  // Replaces the card's default sizing (`w-full max-w-[720px]`) rather than
  // adding to it, so a narrower dialog does not fight the default width.
  className?: string
  // id of the element that names the dialog, for `aria-labelledby`.
  labelledBy?: string
  testid?: string
  // For layouts that carry their own close control in a header row.
  hideClose?: boolean
  children: ReactNode
}

export default function Modal({
  onClose,
  className,
  labelledBy,
  testid,
  hideClose,
  children
}: Props) {
  const card = useRef<HTMLDivElement>(null)

  const tabbables = () =>
    Array.from(card.current?.querySelectorAll<HTMLElement>(TABBABLE) ?? [])

  // A modal owns the keyboard while it is up, so focus starts inside it and
  // goes back to whatever opened it on close — otherwise the tab order resumes
  // at the top of the document.
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null
    const first = tabbables()[0]
    if (first) first.focus()
    else card.current?.focus()
    return () => trigger?.focus()
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Escape closes every modal — the scrim and the X are pointer-only exits.
      // Only the topmost dialog reacts, or a stacked one would take the surface
      // underneath it down as well.
      if (e.key === 'Escape') {
        const dialogs = document.querySelectorAll('[role="dialog"]')
        if (dialogs[dialogs.length - 1] === card.current) onClose()
        return
      }
      // Arrow keys are left alone: the add-secret picker steers its grid with
      // them.
      if (e.key !== 'Tab') return
      const all = tabbables()
      if (all.length === 0) return
      const edge = e.shiftKey ? all[0] : all[all.length - 1]
      const inside = card.current?.contains(document.activeElement)
      if (!inside || document.activeElement === edge) {
        e.preventDefault()
        ;(e.shiftKey ? all[all.length - 1] : all[0]).focus()
      }
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
        ref={card}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        aria-labelledby={labelledBy}
        data-testid={testid}
        className={cx(
          'animate-pop relative flex max-h-[80vh] overflow-hidden rounded-xl border border-line2 bg-detail text-text shadow-[var(--shadow)]',
          className ?? 'w-full max-w-[720px]'
        )}
        onClick={e => e.stopPropagation()}
      >
        {!hideClose && (
          <button
            type="button"
            data-testid="modal-close"
            onClick={onClose}
            className="absolute right-3 top-3 z-10 grid h-7 w-7 cursor-pointer place-items-center rounded-sm text-text3 transition-colors hover:bg-hover hover:text-text"
          >
            <CloseGlyph />
          </button>
        )}
        {children}
      </div>
    </div>
  )
}

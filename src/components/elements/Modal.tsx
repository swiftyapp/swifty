import { useRef, type ReactNode } from 'react'
import { cx } from '@/utils/cx'
import { useDialogFocus } from '@/hooks/useDialogFocus'
import { CloseGlyph } from '../Main/icons'
import IconButton from './IconButton'

interface Props {
  onClose: () => void
  // Replaces the card's default sizing (`w-full max-w-dialog-lg`) rather than
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
  useDialogFocus(card, onClose)

  return (
    <div
      className="animate-fade fixed inset-0 z-50 flex items-start justify-center bg-scrim p-4 pt-[10vh] backdrop-blur-sm"
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
          'animate-pop relative flex max-h-[80vh] overflow-hidden rounded-xl border border-line2 bg-detail text-text shadow-float',
          className ?? 'w-full max-w-dialog-lg'
        )}
        onClick={e => e.stopPropagation()}
      >
        {!hideClose && (
          <IconButton
            muted
            testid="modal-close"
            onClick={onClose}
            className="absolute right-3 top-3 z-10"
          >
            <CloseGlyph />
          </IconButton>
        )}
        {children}
      </div>
    </div>
  )
}

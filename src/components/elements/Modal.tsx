import type { ReactNode, Ref } from 'react'
import { cx } from '@/utils/cx'
import { useDialogFocus } from '@/hooks/useDialogFocus'
import { useForwardedRef } from '@/hooks/useForwardedRef'
import { CloseGlyph } from '../Main/icons'
import IconButton from './IconButton'

interface Props {
  onClose: () => void
  // Replaces the card's default box (`flex max-h-[80vh] w-full max-w-dialog-lg`)
  // rather than adding to it, so neither a narrower card nor one that lays its
  // own body out has to fight the default.
  className?: string
  // id of the element that names the dialog, for `aria-labelledby`.
  labelledBy?: string
  testid?: string
  // For layouts that carry their own close control in a header row.
  hideClose?: boolean
  // Pickers hang from the top, where the window chrome is; a small card that is
  // all there is to look at sits in the middle instead.
  align?: 'top' | 'center'
  // The card element, for a caller that runs its own topmost-dialog check.
  ref?: Ref<HTMLDivElement>
  children: ReactNode
}

export default function Modal({
  onClose,
  className,
  labelledBy,
  testid,
  hideClose,
  align = 'top',
  ref,
  children
}: Props) {
  const [card, setCard] = useForwardedRef<HTMLDivElement>(ref)
  useDialogFocus(card, onClose)

  return (
    <div
      className={cx(
        'animate-fade fixed inset-0 z-50 flex justify-center bg-scrim p-4 backdrop-blur-sm',
        align === 'center' ? 'items-center' : 'items-start pt-[10vh]'
      )}
      onClick={onClose}
    >
      <div
        ref={setCard}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        aria-labelledby={labelledBy}
        data-testid={testid}
        className={cx(
          'animate-pop relative overflow-hidden rounded-xl border border-line2 bg-detail text-text shadow-float',
          className ?? 'flex max-h-[80vh] w-full max-w-dialog-lg'
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
